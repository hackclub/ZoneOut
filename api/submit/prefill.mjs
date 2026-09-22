import { requireUser } from "../../lib/guard.mjs";
import { readSubmitProfile, clearSubmitProfile, getProjectById } from "../../lib/users.mjs";
import { openProfile, sealRef } from "../../lib/secretbox.mjs";
import { hasEnv } from "../../lib/env.mjs";
import { CAPTURED_FIELDS, PROJECT_FIELDS } from "../../submitFields.js";
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

    // the project's own half, held here rather than captured, so it is per project and current
    if (projectId) await putProject(put, user.user_id, projectId);

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

// the project the form was opened from, and only when it belongs to this session
async function putProject(put, userId, projectId) {
    let row;
    try {
        row = await getProjectById(projectId);
    } catch (err) {
        console.error("submit project read failed:", err.message);
        return;
    }

    if (!row || row.user_id !== userId) return;

    const sources = {
        project_description: row.description,
        code_url: row.repo_url,
        demo_url: row.demo_url
    };

    // PROJECT_FIELDS is the list, so a key added there with no source is skipped, never uncapped
    for (const [key, max] of Object.entries(PROJECT_FIELDS)) {
        put(key, clip(sources[key], max));
    }
}

// a cut that cannot strand half a surrogate pair, which encodeURIComponent throws on
function clip(value, max) {
    if (typeof value !== "string" || value.length <= max) return value;

    const cut = value.slice(0, max);
    return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
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
