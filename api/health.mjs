// section for GET /api/health

import { timingSafeEqual } from "node:crypto";

async function isAuthorised(req) {
    let expected;
    try {
        const { readEnv } = await import("../lib/env.mjs");
        expected = readEnv("HEALTH_TOKEN", { required: false });
    } catch {
        return false;
    }
    if (!expected) return false;

    const url = new URL(req.url ?? "/", "http://localhost");
    const supplied = url.searchParams.get("token") ?? "";

    const a = Buffer.from(expected);
    const b = Buffer.from(supplied);
    return a.length === b.length && timingSafeEqual(a, b);
}

async function envReport() {
    try {
        const { hasEnv } = await import("../lib/env.mjs");
        return {
            sessionSecret: hasEnv("SESSION_SECRET"),
            hcClientId: hasEnv("HC_CLIENT_ID"),
            hcClientSecret: hasEnv("HC_CLIENT_SECRET"),
            databaseUrl: hasEnv("DATABASE_URL")
        };
    } catch (err) {
        console.error("env module failed to load:", err.message);
        return { error: "env module failed to load" };
    }
}

async function databaseReport(env) {
    if (env.databaseUrl === false) return { connectionString: "missing" };

    try {
        await import("../lib/db.mjs");
        return { connectionString: "ok" };
    } catch (err) {
        console.error("database module failed to load:", err.message);
        return { connectionString: "malformed" };
    }
}

async function oauthReport(req) {
    try {
        const { REDIRECT_URIS, resolveRedirectUri, redirectUriMatchesHost } =
            await import("../lib/oauth.mjs");

        return {
            redirectUris: REDIRECT_URIS.length,
            resolvedRedirectUri: resolveRedirectUri(req),
            hostMatched: redirectUriMatchesHost(req)
        };
    } catch (err) {
        console.error("oauth module failed to load:", err.message);
        return { error: "oauth module failed to load" };
    }
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    const [env, detailed] = await Promise.all([envReport(), isAuthorised(req)]);
    const [database, oauth] = await Promise.all([databaseReport(env), oauthReport(req)]);

    const full = { ...env, ...database, ...oauth };
    const config = detailed ? full : undefined;

    const configOk = database.connectionString === "ok"
        && env.sessionSecret === true
        && env.hcClientId === true
        && env.hcClientSecret === true
        && oauth.hostMatched === true;

    if (database.connectionString !== "ok") {
        return res.status(503).json({ ok: false, error: "database not configured", config });
    }

    const startedAt = Date.now();
    try {
        const { query } = await import("../lib/db.mjs");
        const { rows } = await query("SELECT now() AS server_time");

        return res.status(configOk ? 200 : 503).json({
            ok: configOk,
            serverTime: rows[0].server_time,
            latencyMs: Date.now() - startedAt,
            config
        });
    } catch (err) {
        console.error("health check failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable", config });
    }
}
