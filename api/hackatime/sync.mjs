import { requireUser } from "../../lib/guard.mjs";
import { readToken, fetchProjectStats, writeProjectHours, eventHoursFor, syncedRecently } from "../../lib/hackatime.mjs";
import { writeEventHours } from "../../lib/event.mjs";
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
        const [stats, event] = await Promise.all([
            fetchProjectStats(token),
            eventHoursFor(user.user_id, token)
        ]);

        const settled = await writeProjectHours(user.user_id, stats);
        await writeEventHours(user.user_id, event.total, event.projects);

        const eventByProject = new Map(event.projects.map(row => [row.projectId, row.hours]));

        return res.status(200).json({
            ok: true,
            linked: true,
            eventHours: event.total,
            projects: settled.map(row => ({
                projectId: row.project_id,
                hackatimeHours: row.hackatime_hours,
                eventHours: eventByProject.get(row.project_id) ?? 0
            }))
        });
    } catch (err) {
        console.error("hackatime sync failed:", err.message);
        return res.status(503).json({ ok: false, error: "hackatime unreachable" });
    }
}
