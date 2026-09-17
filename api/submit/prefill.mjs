import { requireUser } from "../../lib/guard.mjs";
import { readSubmitProfile, clearSubmitProfile } from "../../lib/users.mjs";
import { openProfile, sealRef } from "../../lib/secretbox.mjs";
import { hasEnv } from "../../lib/env.mjs";
import { CAPTURED_FIELDS } from "../../submitFields.js";
import { limited } from "../../lib/ratelimit.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
        res.setHeader("Allow", "GET, HEAD, DELETE");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const user = await requireUser(req, res);
    if (!user) return;

    // rate limit
    if (await limited(res, "submit-prefill", user.user_id, 30, 60)) return;

    if (req.method === "DELETE") return forget(user, res);
    return prefill(user, res, readProjectId(req.query?.project));
}

// the project this submission belongs to, if the form was opened from one
function readProjectId(raw) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!/^\d+$/.test(value ?? "")) return null;

    const id = Number(value);
    return Number.isSafeInteger(id) && id >= 1 ? id : null;
}

// what we hold for this session's own user, and nobody else's
async function prefill(user, res, projectId) {
    const params = {};
    const put = (key, value) => {
        const text = typeof value === "string" ? value.trim() : "";
        if (text) params[key] = text;
    };

    put("first_name", user.first_name);
    put("last_name", user.last_name);
    put("email", user.email);
    put("slack_id", user.slack_id);

    // the sealed half, absent on a deployment with no key
    let ref = null;

    if (hasEnv("PII_KEY")) {
        let row;
        try {
            row = await readSubmitProfile(user.user_id);
        } catch (err) {
            console.error("submit profile read failed:", err.message);
            return res.status(503).json({ ok: false, error: "database unreachable" });
        }

        if (row?.submit_profile) {
            const opened = openProfile(row.submit_profile, user.user_id);

            if (opened === null) {
                console.error(`submit profile could not be opened for user_id ${user.user_id}`);
            } else {
                let stored = null;
                try {
                    stored = JSON.parse(opened);
                } catch {
                    console.error(`submit profile is not valid JSON for user_id ${user.user_id}`);
                }
                for (const key of Object.keys(CAPTURED_FIELDS)) put(key, stored?.[key]);
            }
        }

        const parts = [user.user_id, Date.now()];
        if (projectId) parts.push(projectId);

        ref = sealRef(parts.join("."));
    }

    return res.status(200).json({ ok: true, params, ref });
}

// forget what we captured
async function forget(user, res) {
    try {
        const row = await clearSubmitProfile(user.user_id);
        if (!row) return res.status(403).json({ ok: false, error: "banned" });

        return res.status(200).json({ ok: true, cleared: true });
    } catch (err) {
        console.error("submit profile clear failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
