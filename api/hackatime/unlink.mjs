import { requireUser } from "../../lib/guard.mjs";
import { readToken, revokeToken, clearLink } from "../../lib/hackatime.mjs";

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

    try {
        const token = await readToken(user.user_id);

        // a provider that refuses the revocation must not strand the link on our side
        if (token) {
            try {
                await revokeToken(token);
            } catch (err) {
                console.warn("hackatime revoke failed:", err.message);
            }
        }

        await clearLink(user.user_id);
        return res.status(200).json({ ok: true, linked: false });
    } catch (err) {
        console.error("hackatime unlink failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
