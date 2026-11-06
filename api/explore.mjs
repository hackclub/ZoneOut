import { listExploreProjects, exploreOrder } from "../lib/event.mjs";

// the public gallery, nothing a project page does not already show
export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    try {
        const rows = exploreOrder(await listExploreProjects());
        res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
        return res.status(200).json({
            ok: true,
            projects: rows.map((row) => ({
                projectId: row.project_id,
                name: row.name,
                ownerName: row.owner ?? null,
                approvedHours: row.approved_hours ?? 0
            }))
        });
    } catch (err) {
        res.setHeader("Cache-Control", "no-store");
        console.error("explore lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
