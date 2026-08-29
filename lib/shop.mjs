import { query } from "./db.mjs";
import { ValidationError } from "./users.mjs";
import { isAdminEmail } from "./admin.mjs";
import { findItem, itemHours, itemInRegion, itemUnlocked, MAX_QUANTITY } from "../catalog.js";

// restricted items
export function grantsFor(user) {
    const list = [];
    if (user && (user.cg_access || isAdminEmail(user.email))) list.push("cg");
    return list;
}

// the atomic debit
export async function placeOrder(user, itemId, quantity) {
    const item = findItem(itemId);
    if (!item) throw new OrderRejected("unknown item");
    if (!itemUnlocked(item, grantsFor(user))) throw new OrderRejected("unknown item");

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
        throw new OrderRejected("quantity must be a whole number from 1 to " + MAX_QUANTITY);
    }

    // the declared region decides both what is on offer and what it costs
    const shopRegion = user.region || "global";
    if (!itemInRegion(item, shopRegion)) {
        throw new OrderRejected("that item is not available in your region");
    }

    const cost = Math.round(itemHours(item, shopRegion) * qty * 100) / 100;
    const needsCg = item.access === "cg" && !isAdminEmail(user.email);

    const { rows } = await query(
        `WITH charged AS (
             UPDATE users
                SET balance_hours = balance_hours - $2::numeric,
                    updated_at    = now()
              WHERE user_id = $1
                AND is_banned = false
                AND balance_hours >= $2::numeric
                AND ($6::boolean = false OR cg_access = true)
          RETURNING user_id, name, region, balance_hours
         ), placed AS (
             INSERT INTO shop_orders (user_id, user_name, region, item_id, item_name, quantity, hours_spent)
             SELECT user_id, name, region, $3::text, $4::text, $5::int, $2::numeric FROM charged
             RETURNING order_id
         )
         SELECT c.balance_hours::float8 AS balance_hours, p.order_id
         FROM charged c JOIN placed p ON true`,
        [user.user_id, cost, item.id, item.name, qty, needsCg]
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

// suggestions
const ITEM_NAME_MAX = 120;
const REASON_MAX = 1000;

function readField(value, label, limit) {
    const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
    if (!text) throw new ValidationError(label + " is required.");
    if (text.length > limit) throw new ValidationError(label + " must be " + limit + " characters or fewer.");
    return text;
}

export async function createSuggestion(userId, itemName, reason) {
    const name = readField(itemName, "The item name", ITEM_NAME_MAX);
    const why = readField(reason, "The reason", REASON_MAX);

    const { rows } = await query(
        `INSERT INTO shop_suggestions (user_id, user_name, region, item_name, reason)
         SELECT u.user_id, u.name, u.region, $2::text, $3::text
         FROM users u
         WHERE u.user_id = $1 AND u.is_banned = false
         RETURNING suggestion_id, created_at`,
        [userId, name, why]
    );

    if (!rows[0]) throw new ValidationError("This suggestion could not be recorded.");

    return { suggestionId: rows[0].suggestion_id, createdAt: rows[0].created_at };
}

export async function listSuggestions() {
    const { rows } = await query(
        `SELECT suggestion_id, user_id, user_name, region, item_name, reason, created_at
         FROM shop_suggestions
         ORDER BY suggestion_id DESC`
    );
    return rows;
}

// balance
export async function getBalanceHours(userId) {
    const { rows } = await query(
        `SELECT email, balance_hours::float8 AS balance_hours, is_banned, ban_reason,
                region, cg_access
         FROM users WHERE user_id = $1`,
        [userId]
    );
    return rows[0] ?? null;
}
