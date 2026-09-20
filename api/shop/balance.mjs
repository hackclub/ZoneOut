import { readSession } from "../../lib/session.mjs";
import { getBalanceHours, grantsFor } from "../../lib/shop.mjs";
import { limited } from "../../lib/ratelimit.mjs";
import { readEventState, derive } from "../../lib/event.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const session = readSession(req);
    if (!session) {
        return res.status(401).json({ ok: false, error: "not authenticated" });
    }

    // rate limit
    if (await limited(res, "shop-balance", session.userId, 60, 60)) return;

    try {
        // balance and ban state, plus the corruption knobs the shop polls for
        const [row, fxState] = await Promise.all([
            getBalanceHours(session.userId),
            readEventState().catch(() => null)
        ]);
        if (!row) {
            return res.status(401).json({ ok: false, error: "not authenticated" });
        }
        if (row.is_banned) {
            return res.status(403).json({
                ok: false,
                error: "banned",
                reason: row.ban_reason || "No reason was given."
            });
        }
        const fx = fxState ? derive(fxState, null) : null;

        return res.status(200).json({
            ok: true,
            balanceHours: row.balance_hours,
            region: row.region ?? null,
            grants: grantsFor(row),
            fxEnabled: fx ? fx.fxEnabled : false,
            fxIntensity: fx ? fx.fxIntensity : 0,
            fxBeatSeconds: fx ? fx.fxBeatSeconds : 45,
            fxLevelScale: fx ? fx.fxLevelScale : 1
        });
    } catch (err) {
        console.error("balance lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
