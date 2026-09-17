import { requireUser, sameOrigin } from "../../lib/guard.mjs";
import { joinEvent, readEventState, eventTotals, derive } from "../../lib/event.mjs";
import { limited } from "../../lib/ratelimit.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // session
    const user = await requireUser(req, res);
    if (!user) return;

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    if (!sameOrigin(req)) {
        return res.status(403).json({ ok: false, error: "bad origin" });
    }

    // rate limit
    if (await limited(res, "event-join", user.user_id, 10, 60)) return;

    try {
        // the user id comes from the verified session and nowhere else
        await joinEvent(user.user_id);

        const [state, totals] = await Promise.all([readEventState(), eventTotals()]);
        const figures = state ? derive(state, totals) : {};

        return res.status(200).json({ ok: true, joined: true, ...figures });
    } catch (err) {
        console.error("event join failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
