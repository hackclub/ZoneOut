import { requireAdmin } from "../../lib/guard.mjs";
import { withTransaction } from "../../lib/db.mjs";
import { setBalanceHours, listAllUsersForAdmin, MAX_BALANCE_HOURS } from "../../lib/users.mjs";
import { parseCommand, applyCommand, CommandError } from "../../lib/adminCommands.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { presentUsers } from "./users.mjs";

const MAX_BATCH = 200;

// a browser sends Origin on every cross-site POST, so a mismatch is never this page
function sameOrigin(req) {
    const origin = req.headers?.origin;
    if (!origin) return true;

    const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

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

    if (balances.length + rawCommands.length === 0) {
        return res.status(400).json({ ok: false, error: "nothing to save" });
    }
    if (balances.length + rawCommands.length > MAX_BATCH) {
        return res.status(400).json({ ok: false, error: "too many changes in one save" });
    }

    // validate the batch before touching the database
    let staged;
    try {
        staged = {
            balances: balances.map(readBalanceEdit),
            commands: rawCommands.map(line => parseCommand(line))
        };
    } catch (err) {
        if (err instanceof CommandError || err instanceof RangeError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        throw err;
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
    try {
        await withTransaction(async client => {
            for (const edit of staged.balances) {
                const row = await setBalanceHours(edit.userId, edit.balanceHours, client);
                if (!row) throw new CommandError(`no user ${edit.userId}`);
                applied.push(`set user ${edit.userId} to ${edit.balanceHours} hours`);
            }

            for (const command of staged.commands) {
                applied.push(await applyCommand(command, client));
            }
        });
    } catch (err) {
        if (err instanceof CommandError) {
            return res.status(400).json({ ok: false, error: err.message, applied: [] });
        }
        console.error("admin batch failed:", err.message);
        return res.status(503).json({ ok: false, error: "the batch could not be applied" });
    }

    try {
        return res.status(200).json({
            ok: true,
            applied,
            users: presentUsers(await listAllUsersForAdmin())
        });
    } catch (err) {
        console.error("admin reload failed:", err.message);
        return res.status(200).json({ ok: true, applied, users: null });
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
