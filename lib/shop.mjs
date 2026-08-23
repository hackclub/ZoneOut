import { query } from "./db.mjs";
import { findItem, MAX_QUANTITY } from "../catalog.js";

// the atomic debit
export async function placeOrder(userId, itemId, quantity) {
    const item = findItem(itemId);
    if (!item) throw new OrderRejected("unknown item");

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
        throw new OrderRejected("quantity must be a whole number from 1 to " + MAX_QUANTITY);
    }

    const cost = Math.round(item.hours * qty * 100) / 100;

    const { rows } = await query(
        `WITH charged AS (
             UPDATE users
                SET balance_hours = balance_hours - $2::numeric,
                    updated_at    = now()
              WHERE user_id = $1
                AND is_banned = false
                AND balance_hours >= $2::numeric
          RETURNING user_id, balance_hours
         ), placed AS (
             INSERT INTO shop_orders (user_id, item_id, item_name, quantity, hours_spent)
             SELECT user_id, $3::text, $4::text, $5::int, $2::numeric FROM charged
             RETURNING order_id
         )
         SELECT c.balance_hours::float8 AS balance_hours, p.order_id
         FROM charged c JOIN placed p ON true`,
        [userId, cost, item.id, item.name, qty]
    );

    if (!rows[0]) throw new OrderRejected("insufficient hours");

    return {
        orderId: rows[0].order_id,
        balanceHours: rows[0].balance_hours,
        item,
        quantity: qty,
        hoursSpent: cost
    };
}

// error type
export class OrderRejected extends Error {
    constructor(message) {
        super(message);
        this.name = "OrderRejected";
    }
}

// balance
export async function getBalanceHours(userId) {
    const { rows } = await query(
        `SELECT balance_hours::float8 AS balance_hours, is_banned, ban_reason
         FROM users WHERE user_id = $1`,
        [userId]
    );
    return rows[0] ?? null;
}
