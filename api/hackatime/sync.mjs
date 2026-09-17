import { requireUser } from "../../lib/guard.mjs";
import { readToken, fetchProjectStats, writeProjectHours, eventHoursFor, syncedRecently } from "../../lib/hackatime.mjs";
import { isParticipant, writeEventHours } from "../../lib/event.mjs";
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

    // rate limit, beside the sixty second floor below
    if (await limited(res, "ht-sync", user.user_id, 30, 60)) return;

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

        // both windows in parallel, so the event figure costs no extra latency
        const joined = await isParticipant(user.user_id);
        const [stats, eventHours] = await Promise.all([
            fetchProjectStats(token),
            joined ? eventHoursFor(user.user_id, token) : Promise.resolve(null)
        ]);

        const settled = await writeProjectHours(user.user_id, stats);
        if (eventHours !== null) await writeEventHours(user.user_id, eventHours);

        return res.status(200).json({
            ok: true,
            linked: true,
            eventHours,
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
