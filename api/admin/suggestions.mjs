import { requireAdmin } from "../../lib/guard.mjs";
import { listSuggestions } from "../../lib/shop.mjs";

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
        return res.status(200).json({ ok: true, suggestions: present(await listSuggestions()) });
    } catch (err) {
        console.error("admin suggestion list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// row shape for the admin table
function present(rows) {
    return rows.map(row => ({
        suggestionId: row.suggestion_id,
        userId: row.user_id,
        userName: row.user_name,
        region: row.region,
        itemName: row.item_name,
        reason: row.reason,
        createdAt: row.created_at
    }));
}
