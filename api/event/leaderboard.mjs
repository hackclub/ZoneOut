import { requireUser, requireAdmin, sameOrigin } from "../../lib/guard.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { isAdminEmail } from "../../lib/admin.mjs";
import { ValidationError } from "../../lib/users.mjs";
import {
    leaderboard,
    setParticipantAdjust,
    removeParticipant,
    setBoardShadow,
    addParticipantByEmail,
    MAX_EVENT_HOURS
} from "../../lib/event.mjs";
import { limited } from "../../lib/ratelimit.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "GET" || req.method === "HEAD") return read(req, res);
    if (req.method === "POST") return write(req, res);

    res.setHeader("Allow", "GET, HEAD, POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
}

// names are personal, so a session and a ban check are required
async function read(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;

    if (await limited(res, "event-board", user.user_id, 40, 60)) return;

    try {
        const admin = isAdminEmail(user.email) && !user.shadow_banned;
        return res.status(200).json({
            ok: true,
            isAdmin: admin,
            rows: present(await leaderboard(), user.user_id, admin)
        });
    } catch (err) {
        console.error("leaderboard lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

async function write(req, res) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (!sameOrigin(req)) {
        return res.status(403).json({ ok: false, error: "bad origin" });
    }

    if (await limited(res, "event-board-write", admin.user_id, 60, 60)) return;

    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        if (err instanceof BadRequest) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("leaderboard body failed:", err.message);
        return res.status(400).json({ ok: false, error: "bad request" });
    }

    try {
        await apply(body, admin.user_id);
        return res.status(200).json({ ok: true, isAdmin: true, rows: present(await leaderboard(), admin.user_id, true) });
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("leaderboard write failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// one edit per request, validated before it is written
async function apply(body, actorId) {
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "add") {
        const email = typeof body.email === "string" ? body.email.trim() : "";
        if (!email || email.length > 320 || !email.includes("@")) {
            throw new ValidationError("That is not an email address.");
        }
        return addParticipantByEmail(email, actorId);
    }

    const userId = readId(body?.userId);

    if (action === "remove") return removeParticipant(userId, actorId);

    if (action === "shadow") return setBoardShadow(userId, body.on === true, actorId);

    // the adjustment is signed, so an organiser can take hours away as well as give them
    if (action === "adjust") {
        const raw = typeof body.adjust === "string" ? body.adjust.trim() : body.adjust;
        const adjust = Number(raw === "" || raw === null || raw === undefined ? 0 : raw);
        if (!Number.isFinite(adjust) || adjust < -MAX_EVENT_HOURS || adjust > MAX_EVENT_HOURS) {
            throw new ValidationError(`The adjustment must be between -${MAX_EVENT_HOURS} and ${MAX_EVENT_HOURS}.`);
        }
        return setParticipantAdjust(userId, Math.round(adjust * 100) / 100, actorId);
    }

    throw new ValidationError("Unknown action.");
}

function readId(raw) {
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError("That is not a user id.");
    return id;
}

// a shadowed row reads 0 to everybody but its owner and the admins
function present(rows, viewerId, admin) {
    return rows
        .map(row => {
            const masked = row.shadowed === true && !admin && row.user_id !== viewerId;
            const shown = {
                userId: row.user_id,
                name: row.name || "Unnamed",
                hours: masked ? 0 : (row.hours ?? 0),
                trackedHours: masked ? 0 : (row.tracked_hours ?? 0),
                adjust: masked ? 0 : (row.adjust ?? 0),
                deflation: masked ? 0 : (row.deflation ?? 0),
                tickets: row.tickets ?? 0,
                joinedAt: row.joined_at
            };
            if (admin) shown.shadowed = row.shadowed === true;
            return shown;
        })
        .sort((a, b) => (b.hours - a.hours) || (new Date(a.joinedAt) - new Date(b.joinedAt)))
        .map(({ joinedAt, ...row }) => row);
}
