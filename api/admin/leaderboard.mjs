import { requireAdmin } from "../../lib/guard.mjs";
import { boardProjects, boardUsers } from "../../lib/event.mjs";

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
        const [rows, users] = await Promise.all([boardProjects(), boardUsers()]);
        return res.status(200).json({ ok: true, rows: present(rows), users: presentBoardUsers(users) });
    } catch (err) {
        console.error("admin leaderboard list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// section for the per-account board standing
function presentBoardUsers(rows) {
    return rows.map(row => ({
        userId: row.user_id,
        name: row.name || "Unnamed",
        slackId: row.slack_id ?? null,
        email: row.email ?? null,
        onBoard: row.on_board === true,
        hidden: row.hidden === true,
        tracked: row.tracked ?? 0,
        adjust: row.adjust ?? 0,
        deflation: row.deflation ?? 0,
        hours: row.hours ?? null,
        projects: row.projects ?? 0,
        projectHours: row.project_hours ?? 0,
        joinedAt: row.joined_at ?? null,
        syncedAt: row.synced_at ?? null
    }));
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
        eventDeducted: row.event_deducted ?? 0,
        fraudRejected: row.fraud_rejected === true
    }));
}
