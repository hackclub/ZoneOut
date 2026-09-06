import crypto from "node:crypto";
import { notFound } from "../../lib/guard.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { writeSubmitProfile } from "../../lib/users.mjs";
import { openRef, sealProfile } from "../../lib/secretbox.mjs";
import { readEnv, hasEnv } from "../../lib/env.mjs";
import { CAPTURED_FIELDS, PROFILE_MAX } from "../../submitFields.js";

const REF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // shared secret, before anything else
    if (!authorised(req)) return notFound(res);

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // request body
    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        if (err instanceof BadRequest) return res.status(400).json({ ok: false, error: err.message });
        throw err;
    }

    const userId = resolveRef(body.zo_ref);
    if (!userId) return res.status(204).end();

    const fields = collect(body);
    if (!fields) {
        console.error(
            `submission hook carried no usable fields for user_id ${userId}; ` +
            `body keys: ${keyNames(body)}; ${why(body)}`
        );
        return res.status(204).end();
    }

    const payload = JSON.stringify({ v: 1, ...fields });
    if (payload.length > PROFILE_MAX) {
        console.error(`submission hook payload too large for user_id ${userId}`);
        return res.status(204).end();
    }

    const submissionId = text(body.submission_id, 128) || digest(payload);

    try {
        await writeSubmitProfile(userId, sealProfile(payload, userId), submissionId);
    } catch (err) {
        console.error("submit profile write failed:", err.message);
    }

    return res.status(204).end();
}

// the secret fillout is configured to send
function authorised(req) {
    if (!hasEnv("FILLOUT_HOOK_SECRET") || !hasEnv("PII_KEY")) return false;

    const expected = Buffer.from(readEnv("FILLOUT_HOOK_SECRET"));
    const header = req.headers["x-zoneout-hook"];
    const supplied = Buffer.from(typeof header === "string" ? header : "");

    if (expected.length !== supplied.length) return false;
    return crypto.timingSafeEqual(expected, supplied);
}

// stands in for a submission id fillout did not send, so a retry is still a no-op
function digest(payload) {
    return "sha:" + crypto.createHash("sha256").update(payload).digest("base64url").slice(0, 32);
}

// which zoneout account this submission belongs to
function resolveRef(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) {
        console.error("submission hook carried no zo_ref: check the webhook body mapping");
        return null;
    }

    const opened = openRef(raw);
    if (!opened) {
        console.error("submission hook carried an unreadable zo_ref");
        return null;
    }

    const [rawId, rawIssued] = opened.split(".");
    const userId = Number(rawId);
    const issuedAt = Number(rawIssued);

    if (!Number.isInteger(userId) || userId <= 0) return null;
    if (!Number.isFinite(issuedAt)) return null;

    if (Date.now() - issuedAt > REF_MAX_AGE_MS) {
        console.error(`submission hook reference expired for user_id ${userId}`);
        return null;
    }

    return userId;
}

// key names only, never a value
function keyNames(body) {
    const keys = Object.keys(body).map(key => key.slice(0, 40));
    return keys.length ? keys.slice(0, 40).join(", ") : "(none)";
}

// which expected field failed and how, never a value
function why(body) {
    const notes = [];

    for (const [key, max] of Object.entries(CAPTURED_FIELDS)) {
        const raw = body[key];

        if (raw === undefined) notes.push(`${key}=absent`);
        else if (typeof raw !== "string") notes.push(`${key}=${typeof raw}`);
        else if (!raw.trim()) notes.push(`${key}=blank`);
        else if (!(key === "birthday" ? birthday(raw) : text(raw, max))) notes.push(`${key}=rejected`);
    }

    return notes.join(" ");
}

// the captured fields, never coerced
function collect(body) {
    const fields = {};

    for (const [key, max] of Object.entries(CAPTURED_FIELDS)) {
        const value = key === "birthday" ? birthday(body[key]) : text(body[key], max);
        if (value) fields[key] = value;
    }

    return Object.keys(fields).length ? fields : null;
}

function text(value, max) {
    if (typeof value !== "string") return "";

    const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
    return cleaned && cleaned.length <= max ? cleaned : "";
}

// a date, stored the one way fillout prefills it
function birthday(value) {
    const raw = text(value, CAPTURED_FIELDS.birthday);
    if (!raw) return "";

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
    const slashed = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    let year, month, day;
    if (iso) [, year, month, day] = iso;
    else if (slashed) [, month, day, year] = slashed;
    else return "";

    const stamp = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const parsed = new Date(`${stamp}T00:00:00Z`);

    if (Number.isNaN(parsed.getTime())) return "";
    if (parsed.toISOString().slice(0, 10) !== stamp) return "";
    if (Number(year) < 1900 || parsed.getTime() > Date.now()) return "";

    return stamp;
}
