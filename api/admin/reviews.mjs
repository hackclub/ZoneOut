import { requireAdmin } from "../../lib/guard.mjs";
import { listProjectsForReview } from "../../lib/users.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    // admin gate
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    try {
        return res.status(200).json({ ok: true, reviews: presentReviews(await listProjectsForReview()) });
    } catch (err) {
        console.error("admin review list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// row shape for the reviews panel
export function presentReviews(rows) {
    return rows.map(row => ({
        projectId: row.project_id,
        userId: row.user_id,
        name: row.name,
        ownerName: row.owner_name,
        email: row.email,
        slackId: row.slack_id,
        reviewStatus: row.review_status,
        reviewRemarks: row.review_remarks,
        reviewedAt: row.reviewed_at,
        submittedAt: row.submitted_at,
        hackatimeHours: row.hackatime_hours ?? 0,
        submittedHours: row.submitted_hours ?? 0
    }));
}
