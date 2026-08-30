import { requireAdmin } from "../../lib/guard.mjs";
import { listAllProjectsForAdmin } from "../../lib/users.mjs";

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
        return res.status(200).json({ ok: true, projects: present(await listAllProjectsForAdmin()) });
    } catch (err) {
        console.error("admin project list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// row shape for the admin table
function present(rows) {
    return rows.map(row => ({
        projectId: row.project_id,
        userId: row.user_id,
        ownerName: row.owner_name,
        email: row.email,
        slackId: row.slack_id,
        region: row.region,
        isBanned: row.is_banned,
        name: row.name,
        description: row.description,
        repoUrl: row.repo_url,
        demoUrl: row.demo_url,
        hackatimeProject: row.hackatime_project,
        hackatimeHours: row.hackatime_hours ?? 0,
        hackatimeSyncedAt: row.hackatime_synced_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}
