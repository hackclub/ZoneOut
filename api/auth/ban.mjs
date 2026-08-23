import { readSession } from "../../lib/session.mjs";
import { getUserById } from "../../lib/users.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const session = readSession(req);
    if (!session) {
        return res.status(401).json({ ok: false, error: "not authenticated" });
    }

    try {
        // ban state and reason
        const user = await getUserById(session.userId);

        if (!user || !user.is_banned) {
            return res.status(200).json({ ok: true, banned: false });
        }

        return res.status(200).json({
            ok: true,
            banned: true,
            reason: user.ban_reason || "No reason was given."
        });
    } catch (err) {
        console.error("ban lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
