import { requireUser } from "../../lib/guard.mjs";
import { setUserRegion } from "../../lib/users.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { isRegion } from "../../catalog.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const user = await requireUser(req, res);
    if (!user) return;

    // request body
    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        if (err instanceof BadRequest) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        throw err;
    }

    if (!isRegion(body.region)) {
        return res.status(400).json({ ok: false, error: "unknown region" });
    }

    try {
        const row = await setUserRegion(user.user_id, body.region);
        if (!row) return res.status(403).json({ ok: false, error: "banned" });

        return res.status(200).json({ ok: true, region: row.region });
    } catch (err) {
        console.error("region update failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
