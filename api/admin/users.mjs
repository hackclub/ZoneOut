import { requireAdmin } from "../../lib/guard.mjs";
import { listAllUsersForAdmin } from "../../lib/users.mjs";

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
        return res.status(200).json({ ok: true, users: presentUsers(await listAllUsersForAdmin()) });
    } catch (err) {
        console.error("admin user list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// row shape for the admin table
export function presentUsers(rows) {
    return rows.map(row => ({
        userId: row.user_id,
        name: row.name,
        email: row.email,
        status: row.status,
        region: row.region,
        hackatimeLinked: Boolean(row.hackatime_linked),
        cgAccess: Boolean(row.cg_access),
        balanceHours: row.balance_hours,
        isBanned: row.is_banned,
        banReason: row.ban_reason,
        projectIds: row.project_ids
    }));
}
