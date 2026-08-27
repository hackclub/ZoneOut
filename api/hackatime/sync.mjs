import { requireUser } from "../../lib/guard.mjs";
import { readToken, fetchProjectStats, writeProjectHours, syncedRecently } from "../../lib/hackatime.mjs";

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

    if (!user.hackatime_user_id) {
        return res.status(200).json({ ok: true, linked: false, projects: [] });
    }

    // the polling floor, so a reload loop cannot hammer the provider
    if (syncedRecently(user)) {
        return res.status(200).json({ ok: true, linked: true, throttled: true, projects: [] });
    }

    try {
        const token = await readToken(user.user_id);
        if (!token) {
            return res.status(200).json({ ok: true, linked: false, projects: [] });
        }

        const stats = await fetchProjectStats(token);
        const settled = await writeProjectHours(user.user_id, stats);

        return res.status(200).json({
            ok: true,
            linked: true,
            projects: settled.map(row => ({
                projectId: row.project_id,
                hackatimeHours: row.hackatime_hours
            }))
        });
    } catch (err) {
        console.error("hackatime sync failed:", err.message);
        return res.status(503).json({ ok: false, error: "hackatime unreachable" });
    }
}
