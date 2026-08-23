import { requireUser } from "../../lib/guard.mjs";
import { placeOrder, OrderRejected } from "../../lib/shop.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";

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

    try {
        // the order
        const order = await placeOrder(user.user_id, body.itemId, body.quantity);

        return res.status(200).json({
            ok: true,
            orderId: order.orderId,
            balanceHours: order.balanceHours,
            item: { id: order.item.id, name: order.item.name },
            quantity: order.quantity,
            hoursSpent: order.hoursSpent
        });
    } catch (err) {
        if (err instanceof OrderRejected) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("order failed:", err.message);
        return res.status(503).json({ ok: false, error: "the shop could not reach ZoneOut" });
    }
}
