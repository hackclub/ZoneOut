import { requireAdmin, sameOrigin } from "../../lib/guard.mjs";
import { withTransaction } from "../../lib/db.mjs";
import { setBalanceHours, listAllUsersForAdmin, setProjectReview, updateApprovedHours, listProjectsForReview, normaliseRemarks, fraudRemarks, normaliseApprovedHours, normalisePayoutHours, MAX_BALANCE_HOURS, ValidationError } from "../../lib/users.mjs";
import { parseCommand, applyCommand, CommandError } from "../../lib/adminCommands.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { syncAllLinkedUsers, isConfigured } from "../../lib/hackatime.mjs";
import { presentUsers } from "./users.mjs";
import { presentReviews } from "./reviews.mjs";
import { presentOrders } from "./orders.mjs";
import { setOrderStatus, listAllOrdersForAdmin } from "../../lib/shop.mjs";
import { readFxSettings, readMeterSettings, writeEventState, readEventState, eventTotals, derive } from "../../lib/event.mjs";
import { createAnnouncement, deleteAnnouncement, listAnnouncements, presentAnnouncements, normaliseTitle, normaliseBody, normaliseAuthor } from "../../lib/announcements.mjs";

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
    const rawAnnouncements = Array.isArray(body.announcements) ? body.announcements : [];

    const size = balances.length + rawCommands.length + rawReviews.length + rawOrders.length
               + rawAnnouncements.length + (rawFx ? 1 : 0);

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
            announcements: rawAnnouncements.map(readAnnouncementEdit),
            fx: rawFx ? { ...readFxSettings(rawFx), ...readMeterSettings(rawFx) } : null
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
                 || staged.announcements.length > 0 || staged.fx !== null;

    try {
        if (writing) await withTransaction(async client => {
            for (const edit of staged.balances) {
                const row = await setBalanceHours(edit.userId, edit.balanceHours, client, admin.user_id);
                if (!row) throw new CommandError(`no user ${edit.userId}`);
                applied.push(`set user ${edit.userId} to ${edit.balanceHours} hours`);
            }

            for (const command of staged.commands) {
                applied.push(await applyCommand(command, client, admin.user_id));
            }

            for (const review of staged.reviews) {
                if (review.update) {
                    const fixed = await updateApprovedHours(
                        review.projectId, review.approvedHours, review.remarks, admin.user_id, client
                    );
                    if (!fixed) throw new CommandError(`project ${review.projectId} is not approved`);
                    applied.push(
                        `corrected project ${review.projectId} to ${Number(fixed.approved_hours) || 0} approved hours`
                    );
                    continue;
                }

                const row = await setProjectReview(
                    review.projectId, review.status, review.remarks, admin.user_id, client,
                    { approvedHours: review.approvedHours, payoutHours: review.payoutHours,
                      fraud: review.fraud, wipe: review.wipe, extraRemarks: review.remarks }
                );
                if (!row) throw new CommandError(`no project ${review.projectId}`);
                const shifted = row.board_hours == null ? 0
                    : (Number(row.fraud_shift) || 0) * ((Number(row.shift_event) || 0) - (Number(row.shift_deducted) || 0));
                const deflated = Math.round(((Number(row.board_hit) || 0) + shifted) * 100) / 100;
                applied.push(
                    `${review.fraud ? "permanently rejected" : review.status} project ${review.projectId}`
                    + (review.status === "approved"
                        ? ` at ${Number(row.round_approved) || 0} hours, paying ${Number(row.awarded_hours) || 0}` : "")
                    + (deflated > 0 ? `, taking ${deflated} hours off the leaderboard` : "")
                    + (deflated < 0 ? `, returning ${-deflated} hours to the leaderboard` : "")
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

            for (const note of staged.announcements) {
                if (note.remove) {
                    const gone = await deleteAnnouncement(note.announcementId, admin.user_id, client);
                    if (!gone) throw new CommandError(`no announcement ${note.announcementId}`);
                    applied.push(`pulled announcement ${note.announcementId}`);
                    continue;
                }

                const posted = await createAnnouncement(
                    note.title, note.body, admin.user_id, client, note.author
                );
                applied.push(`posted announcement “${posted.title}”`);
            }

            if (staged.fx) {
                await writeEventState(staged.fx, client, admin.user_id);
                applied.push(describeMeters(staged.fx));
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
            announcements: staged.announcements.length
                ? presentAnnouncements(await listAnnouncements(undefined, admin.user_id)) : null,
            fx: await readFx()
        });
    } catch (err) {
        console.error("admin reload failed:", err.message);
        return res.status(200).json({ ok: true, applied, users: null, reviews: null, orders: null });
    }
}

// what the one event-state write actually changed
function describeMeters(patch) {
    const parts = [];
    if (patch.hourGoal !== undefined) parts.push(`set the hour goal to ${patch.hourGoal}`);
    if (patch.setHoursCeiling === true) {
        parts.push(patch.hoursCeiling === null
            ? "let the leaderboard meter run free"
            : `stopped the leaderboard meter at ${patch.hoursCeiling}`);
    }
    if (parts.length === 0) return "retuned the corruption effects";
    const tuned = Object.keys(patch).some(key => key.startsWith("fx"));
    return parts.join(", ") + (tuned ? " and retuned the corruption effects" : "");
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
            fxLevelScale: figures.fxLevelScale,
            goal: figures.goal,
            hours: figures.hours,
            liveHours: figures.liveHours,
            hoursCeiling: figures.hoursCeiling,
            hoursFrozen: figures.hoursFrozen
        };
    } catch (err) {
        console.error("fx settings lookup failed:", err.message);
        return null;
    }
}

// announcement validation
function readAnnouncementEdit(entry) {
    if (entry?.action === "delete") {
        const announcementId = Number(entry?.announcementId);
        if (!Number.isSafeInteger(announcementId) || announcementId < 1) {
            throw new RangeError(`"${entry?.announcementId}" is not an announcement id`);
        }
        return { remove: true, announcementId };
    }

    if (entry?.action !== "post") {
        throw new RangeError("an announcement must be posted or deleted");
    }

    return {
        remove: false,
        title: normaliseTitle(entry?.title),
        body: normaliseBody(entry?.body),
        author: normaliseAuthor(entry?.author)
    };
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
    const update = entry?.decision === "update";
    const status = entry?.decision === "approve" ? "approved"
                 : entry?.decision === "reject"  ? "rejected"
                 : fraud                         ? "rejected"
                 : null;

    if (!status && !update) {
        throw new RangeError(`project ${projectId} must be approved or rejected`);
    }

    // an hours correction carries no verdict: the figure and the remarks, nothing else
    if (update) {
        return {
            projectId,
            update: true,
            remarks: normaliseRemarks(entry?.remarks),
            approvedHours: normaliseApprovedHours(entry?.approvedHours)
        };
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
