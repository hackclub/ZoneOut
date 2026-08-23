import { readSession, clearSessionCookie } from "./session.mjs";
import { getUserById } from "./users.mjs";
import { isAdminEmail } from "./admin.mjs";

// signed-in user, or a written 401 / 403
export async function requireUser(req, res) {
    const session = readSession(req);

    if (!session) {
        clearSessionCookie(req, res);
        res.status(401).json({ ok: false, error: "not authenticated" });
        return null;
    }

    let user;
    try {
        user = await getUserById(session.userId);
    } catch (err) {
        console.error("user lookup failed:", err.message);
        res.status(503).json({ ok: false, error: "database unreachable" });
        return null;
    }

    if (!user) {
        clearSessionCookie(req, res);
        res.status(401).json({ ok: false, error: "not authenticated" });
        return null;
    }

    if (user.is_banned) {
        res.status(403).json({
            ok: false,
            error: "banned",
            reason: user.ban_reason || "No reason was given."
        });
        return null;
    }

    return user;
}

// admin or null, sends nothing
export async function resolveAdmin(req) {
    const session = readSession(req);
    if (!session) return null;

    let user;
    try {
        user = await getUserById(session.userId);
    } catch (err) {
        console.error("admin lookup failed:", err.message);
        return null;
    }

    if (!user || user.is_banned) return null;

    if (!isAdminEmail(user.email)) {
        console.warn(`admin route refused for user_id ${user.user_id}`);
        return null;
    }

    return user;
}

// admin, or a written 404
export async function requireAdmin(req, res) {
    const admin = await resolveAdmin(req);
    if (admin) return admin;

    notFound(res);
    return null;
}

// the one refusal every admin route gives
export function notFound(res) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return res.status(404).json({ ok: false, error: "not found" });
}
