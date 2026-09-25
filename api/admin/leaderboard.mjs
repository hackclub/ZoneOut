import { requireAdmin } from "../../lib/guard.mjs";
import { boardProjects } from "../../lib/event.mjs";

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
        return res.status(200).json({ ok: true, rows: present(await boardProjects()) });
    } catch (err) {
        console.error("admin leaderboard list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// row shape for the admin table
function present(rows) {
    return rows.map(row => ({
        userId: row.user_id,
        ownerName: row.owner_name || "Unnamed",
        slackId: row.slack_id ?? null,
        boardHours: row.board_hours ?? null,
        boardTracked: row.board_tracked ?? 0,
        boardAdjust: row.board_adjust ?? 0,
        boardDeflation: row.board_deflation ?? 0,
        projectId: row.project_id,
        projectName: row.project_name,
        hackatimeProject: row.hackatime_project ?? null,
        eventHours: row.event_hours ?? 0,
        eventDeducted: row.event_deducted ?? 0
    }));
}
