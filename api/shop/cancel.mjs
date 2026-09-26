import { requireUser, refuseReadOnly } from "../../lib/guard.mjs";
import { cancelOrder, OrderRejected } from "../../lib/shop.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { limited } from "../../lib/ratelimit.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const user = await requireUser(req, res);
    if (!user) return;
    if (refuseReadOnly(user, res)) return;

    // rate limit
    if (await limited(res, "shop-cancel", user.user_id, 20, 60)) return;

    // request body
    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        if (err instanceof BadRequest) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        throw err;
    }

    const orderId = Number(body.orderId);
    if (!Number.isSafeInteger(orderId) || orderId < 1) {
        return res.status(400).json({ ok: false, error: "that order could not be found" });
    }

    try {
        // the owner and the state are predicates, so a forged id refunds nothing
        const cancelled = await cancelOrder(user.user_id, orderId);

        return res.status(200).json({
            ok: true,
            orderId: cancelled.order_id,
            balanceHours: cancelled.balance_hours,
            refunded: cancelled.hours_spent,
            itemName: cancelled.item_name,
            quantity: cancelled.quantity
        });
    } catch (err) {
        if (err instanceof OrderRejected) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("order cancel failed:", err.message);
        return res.status(503).json({ ok: false, error: "the shop could not reach ZoneOut" });
    }
}
