import { requireAdmin } from "../../lib/guard.mjs";
import { listActivity, activityTotals, presentActivity, ACTIVITY_KINDS } from "../../lib/activity.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    // admin gate, before the method check
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    const params = new URL(req.url, "http://localhost").searchParams;

    try {
        const [rows, totals] = await Promise.all([
            listActivity({
                kind: params.get("kind"),
                userId: params.get("userId"),
                projectId: params.get("projectId"),
                before: params.get("before"),
                limit: params.get("limit")
            }),
            activityTotals()
        ]);

        const events = presentActivity(rows);

        return res.status(200).json({
            ok: true,
            events,
            kinds: ACTIVITY_KINDS,
            total: totals.total,
            today: totals.today,
            next: events.length ? events[events.length - 1].eventId : null
        });
    } catch (err) {
        console.error("admin activity list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
