import { readSession } from "../../lib/session.mjs";
import { getBalanceHours, grantsFor } from "../../lib/shop.mjs";

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

    try {
        // balance and ban state
        const row = await getBalanceHours(session.userId);
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
        return res.status(200).json({
            ok: true,
            balanceHours: row.balance_hours,
            region: row.region ?? null,
            grants: grantsFor(row)
        });
    } catch (err) {
        console.error("balance lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
