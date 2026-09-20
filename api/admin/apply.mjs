import { requireAdmin, sameOrigin } from "../../lib/guard.mjs";
import { withTransaction } from "../../lib/db.mjs";
import { setBalanceHours, listAllUsersForAdmin, setProjectReview, listProjectsForReview, normaliseRemarks, fraudRemarks, normaliseApprovedHours, normalisePayoutHours, MAX_BALANCE_HOURS, ValidationError } from "../../lib/users.mjs";
import { parseCommand, applyCommand, CommandError } from "../../lib/adminCommands.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { syncAllLinkedUsers, isConfigured } from "../../lib/hackatime.mjs";
import { presentUsers } from "./users.mjs";
import { presentReviews } from "./reviews.mjs";
import { presentOrders } from "./orders.mjs";
import { setOrderStatus, listAllOrdersForAdmin } from "../../lib/shop.mjs";
import { readFxSettings, writeEventState, readEventState, eventTotals, derive } from "../../lib/event.mjs";

const MAX_BATCH = 200;

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    // admin gate
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // origin
    if (!sameOrigin(req)) {
        return res.status(403).json({ ok: false, error: "bad origin" });
    }

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

    const balances = Array.isArray(body.balances) ? body.balances : [];
    const rawCommands = Array.isArray(body.commands) ? body.commands : [];
    const rawReviews = Array.isArray(body.reviews) ? body.reviews : [];
    const rawOrders = Array.isArray(body.orders) ? body.orders : [];
    const rawFx = body.fx && typeof body.fx === "object" ? body.fx : null;

    const size = balances.length + rawCommands.length + rawReviews.length + rawOrders.length
               + (rawFx ? 1 : 0);

    if (size === 0) {
        return res.status(400).json({ ok: false, error: "nothing to save" });
    }
    if (size > MAX_BATCH) {
        return res.status(400).json({ ok: false, error: "too many changes in one save" });
    }

    // validate the batch before touching the database
    let staged;
    try {
        staged = {
            balances: balances.map(readBalanceEdit),
            commands: rawCommands.map(line => parseCommand(line)),
            reviews: rawReviews.map(readReviewEdit),
            orders: rawOrders.map(readOrderEdit),
            fx: rawFx ? readFxSettings(rawFx) : null
        };

        if (staged.fx && Object.keys(staged.fx).length === 0) staged.fx = null;
    } catch (err) {
        if (err instanceof CommandError || err instanceof RangeError || err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        throw err;
    }

    // the sweep talks to hackatime, so it runs outside the transaction
    const sweeping = staged.commands.some(command => command.verb === "HACKATIME");
    staged.commands = staged.commands.filter(command => command.verb !== "HACKATIME");

    if (sweeping && !isConfigured()) {
        return res.status(400).json({ ok: false, error: "hackatime is not configured on this deployment" });
    }

    // an administrator who banned themselves could never reach the panel to undo it
    const selfBan = staged.commands.find(
        command => command.verb === "BAN" && command.userId === admin.user_id
    );
    if (selfBan) {
        return res.status(400).json({ ok: false, error: "you cannot ban your own account" });
    }

    // apply balances and commands in one transaction
    const applied = [];
    const writing = staged.balances.length > 0 || staged.commands.length > 0
                 || staged.reviews.length > 0 || staged.orders.length > 0
                 || staged.fx !== null;

    try {
        if (writing) await withTransaction(async client => {
            for (const edit of staged.balances) {
                const row = await setBalanceHours(edit.userId, edit.balanceHours, client);
                if (!row) throw new CommandError(`no user ${edit.userId}`);
                applied.push(`set user ${edit.userId} to ${edit.balanceHours} hours`);
            }

            for (const command of staged.commands) {
                applied.push(await applyCommand(command, client));
            }

            for (const review of staged.reviews) {
                const row = await setProjectReview(
                    review.projectId, review.status, review.remarks, admin.user_id, client,
                    { approvedHours: review.approvedHours, payoutHours: review.payoutHours,
                      fraud: review.fraud, wipe: review.wipe, extraRemarks: review.remarks }
                );
                if (!row) throw new CommandError(`no project ${review.projectId}`);
                applied.push(
                    `${review.fraud ? "permanently rejected" : review.status} project ${review.projectId}`
                    + (review.status === "approved"
                        ? ` at ${Number(row.round_approved) || 0} hours, paying ${Number(row.awarded_hours) || 0}` : "")
                    + (review.wipe ? " and wiped the balance and pending orders" : "")
                );
            }

            for (const order of staged.orders) {
                const row = await setOrderStatus(
                    order.orderId, order.status, admin.user_id, client, order.refund
                );
                if (!row) throw new CommandError(`no order ${order.orderId}`);
                applied.push(
                    `${order.status} order ${order.orderId}`
                    + (row.refund_paid ? ` and refunded ${row.hours_spent} hours` : "")
                );
            }

            if (staged.fx) {
                await writeEventState(staged.fx, client);
                applied.push("retuned the corruption effects");
            }
        });
    } catch (err) {
        if (err instanceof CommandError || err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message, applied: [] });
        }
        console.error("admin batch failed:", err.message);
        return res.status(503).json({ ok: false, error: "the batch could not be applied" });
    }

    if (sweeping) applied.push(await sweep());

    try {
        return res.status(200).json({
            ok: true,
            applied,
            users: presentUsers(await listAllUsersForAdmin()),
            reviews: staged.reviews.length ? presentReviews(await listProjectsForReview()) : null,
            orders: staged.orders.length ? presentOrders(await listAllOrdersForAdmin()) : null,
            fx: await readFx()
        });
    } catch (err) {
        console.error("admin reload failed:", err.message);
        return res.status(200).json({ ok: true, applied, users: null, reviews: null, orders: null });
    }
}

// the corruption knobs as they now stand
async function readFx() {
    try {
        const state = await readEventState();
        if (!state) return null;
        const figures = derive(state, await eventTotals());
        return {
            fxEnabled: figures.fxEnabled,
            fxIntensity: figures.fxIntensity,
            fxBeatSeconds: figures.fxBeatSeconds,
            fxLevelScale: figures.fxLevelScale
        };
    } catch (err) {
        console.error("fx settings lookup failed:", err.message);
        return null;
    }
}

// order decision validation
function readOrderEdit(entry) {
    const orderId = Number(entry?.orderId);

    if (!Number.isSafeInteger(orderId) || orderId < 1) {
        throw new RangeError(`"${entry?.orderId}" is not an order id`);
    }

    const status = entry?.decision === "approve" ? "approved"
                 : entry?.decision === "reject"  ? "rejected"
                 : null;

    if (!status) {
        throw new RangeError(`order ${orderId} must be approved or rejected`);
    }

    return { orderId, status, refund: status === "rejected" && entry?.refund === true };
}

// review edit validation
function readReviewEdit(entry) {
    const projectId = Number(entry?.projectId);

    if (!Number.isSafeInteger(projectId) || projectId < 1) {
        throw new RangeError(`"${entry?.projectId}" is not a project id`);
    }

    const fraud  = entry?.decision === "fraud";
    const status = entry?.decision === "approve" ? "approved"
                 : entry?.decision === "reject"  ? "rejected"
                 : fraud                         ? "rejected"
                 : null;

    if (!status) {
        throw new RangeError(`project ${projectId} must be approved or rejected`);
    }

    // thrown here, before the transaction opens; the write re-runs the same validators
    if (fraud) fraudRemarks(entry?.remarks); else normaliseRemarks(entry?.remarks);

    return {
        projectId,
        status,
        fraud,
        remarks: entry?.remarks,
        wipe: fraud && entry?.wipe === true,
        approvedHours: status === "approved" ? normaliseApprovedHours(entry?.approvedHours) : 0,
        payoutHours: status === "approved" ? normalisePayoutHours(entry?.payoutHours) : 0
    };
}

// the hackatime sweep, reported rather than thrown: the batch has already committed
async function sweep() {
    try {
        const result = await syncAllLinkedUsers();

        if (!result.linked) return "hackatime: nobody has a linked project to refresh";

        const parts = [`refreshed ${result.users} of ${result.linked} linked users`];
        if (result.projects) parts.push(`${result.projects} projects`);
        if (result.event) parts.push(`${result.event} event participants`);
        if (result.failed) parts.push(`${result.failed} failed`);
        if (result.skipped) parts.push(`${result.skipped} left for the next run`);

        return `hackatime: ${parts.join(", ")}`;
    } catch (err) {
        console.error("hackatime sweep failed:", err.message);
        return "hackatime: the refresh could not run";
    }
}

// balance edit validation
function readBalanceEdit(entry) {
    const userId = Number(entry?.userId);
    const balanceHours = Number(entry?.balanceHours);

    if (!Number.isSafeInteger(userId) || userId < 1) {
        throw new RangeError(`"${entry?.userId}" is not a user id`);
    }
    if (!Number.isFinite(balanceHours) || balanceHours < 0 || balanceHours > MAX_BALANCE_HOURS) {
        throw new RangeError(
            `balance for user ${userId} must be a number between 0 and ${MAX_BALANCE_HOURS}`
        );
    }

    return { userId, balanceHours: Math.round(balanceHours * 100) / 100 };
}
