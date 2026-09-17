import { requireUser } from "../../lib/guard.mjs";
import { listOrdersForUser } from "../../lib/shop.mjs";
import { limited } from "../../lib/ratelimit.mjs";

// row shape for the participant's own history
function presentOrder(row) {
    return {
        orderId: row.order_id,
        itemId: row.item_id,
        itemName: row.item_name,
        quantity: row.quantity,
        hoursSpent: row.hours_spent,
        status: row.order_status,
        refunded: row.refunded_at != null,
        region: row.region ?? null,
        reviewedAt: row.reviewed_at ?? null,
        createdAt: row.created_at
    };
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const user = await requireUser(req, res);
    if (!user) return;

    // rate limit
    if (await limited(res, "shop-orders", user.user_id, 40, 60)) return;

    try {
        const rows = await listOrdersForUser(user.user_id);
        return res.status(200).json({ ok: true, orders: rows.map(presentOrder) });
    } catch (err) {
        console.error("order list failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
