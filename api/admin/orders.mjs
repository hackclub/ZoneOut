import { requireAdmin } from "../../lib/guard.mjs";
import { listAllOrdersForAdmin } from "../../lib/shop.mjs";

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
        return res.status(200).json({ ok: true, orders: presentOrders(await listAllOrdersForAdmin()) });
    } catch (err) {
        console.error("admin order list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// row shape for the orders panel
export function presentOrders(rows) {
    return rows.map(row => ({
        orderId: row.order_id,
        userId: row.user_id,
        userName: row.user_name,
        email: row.email,
        slackId: row.slack_id,
        region: row.region,
        itemId: row.item_id,
        itemName: row.item_name,
        quantity: row.quantity,
        hoursSpent: row.hours_spent,
        status: row.order_status,
        refunded: row.refunded_at != null,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at
    }));
}
