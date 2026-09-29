import { requireUser, refuseReadOnly, sameOrigin } from "../../lib/guard.mjs";
import { setNickname, normaliseNickname, ValidationError } from "../../lib/users.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { limited } from "../../lib/ratelimit.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // session
    const user = await requireUser(req, res);
    if (!user) return;

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    if (!sameOrigin(req)) {
        return res.status(403).json({ ok: false, error: "bad origin" });
    }

    if (refuseReadOnly(user, res)) return;

    // rate limit
    if (await limited(res, "nickname", user.user_id, 10, 60)) return;

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

    try {
        const row = await setNickname(user.user_id, normaliseNickname(body?.nickname));
        if (!row) return res.status(403).json({ ok: false, error: "banned" });

        return res.status(200).json({ ok: true, nickname: row.nickname });
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("nickname update failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
