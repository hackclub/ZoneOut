import { timingSafeEqual } from "node:crypto";
import { readEnv, hasEnv } from "../../lib/env.mjs";
import { resolveAdmin, notFound } from "../../lib/guard.mjs";
import { syncAllLinkedUsers, isConfigured } from "../../lib/hackatime.mjs";
import { pruneRateLimits } from "../../lib/ratelimit.mjs";

// the sweep runs unattended, so it uses more of the function than a visitor's sync does
const BUDGET_MS = 12_000;
const CONCURRENCY = 6;

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    // gate, before the method check
    if (!(await authorised(req))) return notFound(res);

    // method
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
        res.setHeader("Allow", "GET, HEAD, POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    if (!isConfigured()) {
        return res.status(503).json({ ok: false, error: "hackatime is not configured" });
    }

    // the rate limit table is pruned on the same schedule
    const pruned = await pruneRateLimits();

    try {
        const result = await syncAllLinkedUsers({ budgetMs: BUDGET_MS, concurrency: CONCURRENCY });
        console.log(
            `hackatime cron: ${result.users}/${result.linked} users, ${result.projects} projects, ` +
            `${result.event} event, ${result.failed} failed, ${result.skipped} left`
        );
        return res.status(200).json({ ok: true, pruned, ...result });
    } catch (err) {
        console.error("hackatime cron failed:", err.message);
        return res.status(503).json({ ok: false, error: "the sweep could not run" });
    }
}

// the scheduler's bearer token, or an administrator running it by hand
async function authorised(req) {
    if (bearerMatches(req)) return true;
    return Boolean(await resolveAdmin(req));
}

function bearerMatches(req) {
    if (!hasEnv("CRON_SECRET")) return false;

    const header = req.headers?.authorization;
    const raw = Array.isArray(header) ? header[0] : header;
    if (typeof raw !== "string") return false;

    const expected = Buffer.from(`Bearer ${readEnv("CRON_SECRET")}`);
    const supplied = Buffer.from(raw);

    if (expected.length !== supplied.length) return false;
    return timingSafeEqual(expected, supplied);
}
