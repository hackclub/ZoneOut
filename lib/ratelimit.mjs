import { query } from "./db.mjs";

// section for rate limiting
const HIT_SQL = `INSERT INTO rate_limits (bucket, subject, window_start, hits)
                 VALUES ($1::text, $2::text, now(), 1)
            ON CONFLICT (bucket, subject) DO UPDATE
                    SET hits = CASE
                            WHEN rate_limits.window_start <= now() - make_interval(secs => $3::int) THEN 1
                            ELSE rate_limits.hits + 1
                        END,
                        window_start = CASE
                            WHEN rate_limits.window_start <= now() - make_interval(secs => $3::int) THEN now()
                            ELSE rate_limits.window_start
                        END
              RETURNING hits,
                        GREATEST(CEIL(EXTRACT(EPOCH FROM
                            (window_start + make_interval(secs => $3::int)) - now()
                        )), 1)::int AS retry_after`;

// a subject already over its limit is refused without a round trip
const blocked = new Map();
const BLOCKED_MAX = 5000;

function key(bucket, subject) {
    return bucket + "|" + subject;
}

function heldUntil(id) {
    const until = blocked.get(id);
    if (until === undefined) return 0;
    if (until <= Date.now()) {
        blocked.delete(id);
        return 0;
    }
    return until;
}

function hold(id, seconds) {
    if (blocked.size > BLOCKED_MAX) blocked.clear();
    blocked.set(id, Date.now() + seconds * 1000);
}

// the limiter never decides a request is bad because it could not run
export async function allow(bucket, subject, max, seconds) {
    if (subject === null || subject === undefined || subject === "") return { ok: true, retryAfter: 0 };

    const id = key(bucket, String(subject));
    const until = heldUntil(id);
    if (until) return { ok: false, retryAfter: Math.max(Math.ceil((until - Date.now()) / 1000), 1) };

    let row;
    try {
        const { rows } = await query(HIT_SQL, [bucket, String(subject), seconds]);
        row = rows[0];
    } catch (err) {
        console.error("rate limit check failed:", err.message);
        return { ok: true, retryAfter: 0 };
    }

    if (!row || row.hits <= max) return { ok: true, retryAfter: 0 };

    hold(id, row.retry_after);
    return { ok: false, retryAfter: row.retry_after };
}

// true when the refusal has been written
export async function limited(res, bucket, subject, max, seconds) {
    const verdict = await allow(bucket, subject, max, seconds);
    if (verdict.ok) return false;

    res.setHeader("Retry-After", String(verdict.retryAfter));
    res.status(429).json({
        ok: false,
        error: "You are doing that too fast. Try again in " + verdict.retryAfter + "s."
    });
    return true;
}

// the sweep keeps the table from growing without bound
export async function pruneRateLimits(olderThanSeconds = 86_400) {
    try {
        const { rowCount } = await query(
            "DELETE FROM rate_limits WHERE window_start < now() - make_interval(secs => $1::int)",
            [olderThanSeconds]
        );
        return rowCount || 0;
    } catch (err) {
        console.error("rate limit prune failed:", err.message);
        return 0;
    }
}
