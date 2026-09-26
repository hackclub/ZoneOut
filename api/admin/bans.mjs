import { requireAdmin } from "../../lib/guard.mjs";
import { listBans } from "../../lib/users.mjs";

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
        return res.status(200).json({ ok: true, bans: present(await listBans()) });
    } catch (err) {
        console.error("admin ban list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// row shape for the bans panel
function present(rows) {
    return rows.map(row => ({
        userId: row.user_id,
        name: row.name || "Unnamed",
        email: row.email ?? null,
        slackId: row.slack_id ?? null,
        isBanned: row.is_banned === true,
        banReason: row.ban_reason ?? null,
        bannedAt: row.banned_at ?? null,
        bannedBy: row.banned_by ?? null,
        shadowBanned: row.shadow_banned === true,
        shadowProjectId: row.shadow_project_id ?? null,
        shadowProjectName: row.shadow_project_name ?? null,
        shadowedAt: row.shadowed_at ?? null,
        shadowedBy: row.shadowed_by ?? null,
        boardShadowed: row.board_shadowed === true,
        hammeredAt: row.hammered_at ?? null,
        hammeredBy: row.hammered_by ?? null
    }));
}
