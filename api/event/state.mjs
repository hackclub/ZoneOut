import { readSession } from "../../lib/session.mjs";
import { requireAdmin, sameOrigin } from "../../lib/guard.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { ValidationError } from "../../lib/users.mjs";
import { readEventState, writeEventState, eventTotals, isParticipant, derive,
         readFxSettings, MAX_EVENT_HOURS } from "../../lib/event.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "GET" || req.method === "HEAD") return read(req, res);
    if (req.method === "POST") return write(req, res);

    res.setHeader("Allow", "GET, HEAD, POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
}

// the public figures, no personal data at all
async function read(req, res) {
    try {
        const [state, totals] = await Promise.all([readEventState(), eventTotals()]);
        if (!state) return res.status(503).json({ ok: false, error: "event not configured" });

        const payload = { ok: true, ...derive(state, totals) };

        const session = readSession(req);
        if (session) payload.joined = await isParticipant(session.userId);

        return res.status(200).json(payload);
    } catch (err) {
        console.error("event state lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// admin only, and every refusal is a 404
async function write(req, res) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (!sameOrigin(req)) {
        return res.status(403).json({ ok: false, error: "bad origin" });
    }

    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        if (err instanceof BadRequest) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("event state body failed:", err.message);
        return res.status(400).json({ ok: false, error: "bad request" });
    }

    let patch;
    try {
        patch = readPatch(body);
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        throw err;
    }

    try {
        const state = await writeEventState(patch, null, admin.user_id);
        const totals = await eventTotals();
        return res.status(200).json({ ok: true, ...derive(state, totals) });
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("event state write failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// every field validated before anything is written
function readPatch(body) {
    const patch = {};

    if (body.hourGoal !== undefined && body.hourGoal !== null && body.hourGoal !== "") {
        patch.hourGoal = readNumber(body.hourGoal, "The hour goal", 0.01, MAX_EVENT_HOURS);
    }

    if (Object.prototype.hasOwnProperty.call(body, "hoursOverride")) {
        patch.setHoursOverride = true;
        patch.hoursOverride = readOptional(body.hoursOverride, "The hour meter", 0, MAX_EVENT_HOURS);
    }

    if (Object.prototype.hasOwnProperty.call(body, "corruptionOverride")) {
        patch.setCorruptionOverride = true;
        patch.corruptionOverride = readOptional(body.corruptionOverride, "The corruption meter", 0, 100);
    }

    Object.assign(patch, readFxSettings(body));

    if (body.startsAt) patch.startsAt = readDate(body.startsAt, "The start date");
    if (body.endsAt) patch.endsAt = readDate(body.endsAt, "The end date");

    if (patch.startsAt && patch.endsAt && new Date(patch.endsAt) <= new Date(patch.startsAt)) {
        throw new ValidationError("The end date must be after the start date.");
    }

    if (Object.keys(patch).length === 0) {
        throw new ValidationError("Nothing to change.");
    }

    return patch;
}

function readOptional(value, label, min, max) {
    if (value === null || value === "") return null;
    return readNumber(value, label, min, max);
}

function readNumber(value, label, min, max) {
    const number = typeof value === "string" ? Number(value.trim()) : Number(value);
    if (!Number.isFinite(number)) throw new ValidationError(`${label} must be a number.`);
    if (number < min || number > max) {
        throw new ValidationError(`${label} must be between ${min} and ${max}.`);
    }
    return Math.round(number * 100) / 100;
}

function readDate(value, label) {
    const stamp = new Date(value);
    if (Number.isNaN(stamp.getTime())) throw new ValidationError(`${label} is not a date.`);
    return stamp.toISOString();
}
