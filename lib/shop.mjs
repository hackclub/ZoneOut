import { query, withTransaction } from "./db.mjs";
import { ValidationError } from "./users.mjs";
import { isAdminEmail } from "./admin.mjs";
import { findItem, itemHours, itemInRegion, itemLimit, itemUnlocked, MAX_QUANTITY } from "../catalog.js";

// restricted items
export function grantsFor(user) {
    const list = [];
    if (user && (user.cg_access || isAdminEmail(user.email))) list.push("cg");
    return list;
}

// per-user order ceiling, so nobody can fill the table
export const MAX_OPEN_ORDERS = 60;

// the atomic debit
const ORDER_SQL = `WITH charged AS (
             UPDATE users
                SET balance_hours = balance_hours - $2::numeric,
                    updated_at    = now()
              WHERE user_id = $1
                AND is_banned = false
                AND balance_hours >= $2::numeric
                AND ($6::boolean = false OR cg_access = true)
                AND (SELECT count(*) FROM shop_orders o
                     WHERE o.user_id = $1 AND o.order_status = 'pending') < ${MAX_OPEN_ORDERS}
          RETURNING user_id, name, region, balance_hours
         ), placed AS (
             INSERT INTO shop_orders (user_id, user_name, region, item_id, item_name, quantity, hours_spent)
             SELECT user_id, name, region, $3::text, $4::text, $5::int, $2::numeric FROM charged
             RETURNING order_id
         )
         SELECT c.balance_hours::float8 AS balance_hours, p.order_id
         FROM charged c JOIN placed p ON true`;

// only read when the write above matched nothing, so a refusal can say why
const REFUSAL_SQL = `SELECT is_banned, cg_access, balance_hours::float8 AS balance_hours,
                            (SELECT count(*)::int FROM shop_orders o
                             WHERE o.user_id = $1 AND o.order_status = 'pending') AS open_orders
                     FROM users WHERE user_id = $1`;

const ORDERED_SQL = `SELECT COALESCE(SUM(quantity), 0)::int AS ordered
                     FROM shop_orders WHERE user_id = $1 AND item_id = $2`;

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
    const params = [user.user_id, cost, item.id, item.name, qty, needsCg];

    // per-user order caps, admins exempt
    const cap = isAdminEmail(user.email) ? null : itemLimit(item);
    if (cap !== null && qty > cap) throw new OrderRejected(capMessage(item, cap));

    const rows = cap === null
        ? (await query(ORDER_SQL, params)).rows
        : await withTransaction(async client => {
            const charged = await client.query(ORDER_SQL, params);
            if (!charged.rows[0]) return charged.rows;

            const counted = await client.query(ORDERED_SQL, [user.user_id, item.id]);
            if (counted.rows[0].ordered > cap) throw new OrderRejected(capMessage(item, cap));

            return charged.rows;
        });

    if (!rows[0]) throw new OrderRejected(await refusalReason(user.user_id, cost));

    return {
        orderId: rows[0].order_id,
        balanceHours: rows[0].balance_hours,
        item,
        quantity: qty,
        hoursSpent: cost
    };
}

function capMessage(item, cap) {
    return "you can only order " + cap + " " + item.name + " in total";
}

// the write matched nothing; one read explains which predicate refused
async function refusalReason(userId, cost) {
    let row;
    try {
        row = (await query(REFUSAL_SQL, [userId])).rows[0];
    } catch {
        return "insufficient hours";
    }

    if (!row) return "insufficient hours";
    if (row.is_banned) return "this account cannot place orders";
    if (row.open_orders >= MAX_OPEN_ORDERS) {
        return "you already have " + MAX_OPEN_ORDERS + " orders waiting on a decision";
    }
    if (row.balance_hours < cost) return "insufficient hours";
    return "that order was refused";
}

// error type
export class OrderRejected extends Error {
    constructor(message) {
        super(message);
        this.name = "OrderRejected";
    }
}

// section for the participant's own order history
const ORDER_COLUMNS = `order_id, user_id, user_name, region, item_id, item_name,
                       quantity, hours_spent::float8 AS hours_spent,
                       order_status, reviewed_at, refunded_at, created_at`;

export async function listOrdersForUser(userId) {
    const { rows } = await query(
        `SELECT ${ORDER_COLUMNS} FROM shop_orders WHERE user_id = $1 ORDER BY order_id DESC`,
        [userId]
    );
    return rows;
}

// one statement: the refund and the removal cannot come apart
export async function cancelOrder(userId, orderId) {
    const { rows } = await query(
        `WITH removed AS (
             DELETE FROM shop_orders o
             WHERE o.order_id = $2
               AND o.user_id = $1
               AND o.order_status = 'pending'
               AND EXISTS (SELECT 1 FROM users u WHERE u.user_id = $1 AND u.is_banned = false)
             RETURNING o.order_id, o.item_name, o.quantity, o.hours_spent
         ), refunded AS (
             UPDATE users
                SET balance_hours = balance_hours + (SELECT hours_spent FROM removed),
                    updated_at    = now()
              WHERE user_id = $1 AND EXISTS (SELECT 1 FROM removed)
          RETURNING balance_hours::float8 AS balance_hours
         )
         SELECT r.balance_hours, m.order_id, m.item_name, m.quantity,
                m.hours_spent::float8 AS hours_spent
         FROM refunded r JOIN removed m ON true`,
        [userId, orderId]
    );

    if (!rows[0]) throw new OrderRejected("that order can no longer be cancelled");
    return rows[0];
}

// section for the admin orders panel
export async function listAllOrdersForAdmin() {
    const { rows } = await query(
        `SELECT o.order_id, o.user_id, o.user_name, o.region, o.item_id, o.item_name,
                o.quantity, o.hours_spent::float8 AS hours_spent,
                o.order_status, o.reviewed_at, o.refunded_at, o.created_at,
                u.email, u.slack_id
         FROM shop_orders o
         JOIN users u ON u.user_id = o.user_id
         ORDER BY o.order_id DESC`
    );
    return rows;
}

export async function setOrderStatus(orderId, status, actorId, client = null, refund = false) {
    const run = client ? client.query.bind(client) : query;

    if (status !== "approved" && status !== "rejected") {
        throw new ValidationError("An order is either approved or rejected.");
    }

    const { rows } = await run(
        `WITH eligible AS (
             SELECT o.order_id, o.user_id, o.hours_spent
             FROM shop_orders o
             WHERE o.order_id = $1
               AND o.refunded_at IS NULL
               AND $4::boolean = true
               AND $2::text = 'rejected'
             FOR UPDATE
         ), credited AS (
             UPDATE users u
                SET balance_hours = u.balance_hours + e.hours_spent,
                    updated_at    = now()
             FROM eligible e
             WHERE u.user_id = e.user_id
             RETURNING u.user_id
         ), decided AS (
             UPDATE shop_orders o
                SET order_status = $2::text,
                    reviewed_at  = now(),
                    reviewed_by  = $3::int,
                    refunded_at  = CASE WHEN EXISTS (SELECT 1 FROM eligible)
                                        THEN now() ELSE o.refunded_at END
              WHERE o.order_id = $1
          RETURNING ${ORDER_COLUMNS}
         )
         SELECT d.*, EXISTS (SELECT 1 FROM credited) AS refund_paid FROM decided d`,
        [orderId, status, actorId, refund === true]
    );
    return rows[0] ?? null;
}

// suggestions
const ITEM_NAME_MAX = 120;
const REASON_MAX = 1000;
export const MAX_SUGGESTIONS = 30;

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
           AND (SELECT count(*) FROM shop_suggestions s WHERE s.user_id = $1) < ${MAX_SUGGESTIONS}
         RETURNING suggestion_id, created_at`,
        [userId, name, why]
    );

    if (!rows[0]) {
        throw new ValidationError(
            "This suggestion could not be recorded. You may send at most " + MAX_SUGGESTIONS + "."
        );
    }

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
