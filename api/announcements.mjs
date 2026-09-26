import { requireUser } from "../lib/guard.mjs";
import { listAnnouncements, presentAnnouncements } from "../lib/announcements.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    // identity first
    const user = await requireUser(req, res);
    if (!user) return;

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    try {
        return res.status(200).json({
            ok: true,
            announcements: presentAnnouncements(await listAnnouncements(undefined, user.user_id))
        });
    } catch (err) {
        console.error("announcement list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
