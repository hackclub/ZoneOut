import pg from "pg";
import { readEnv } from "./env.mjs";

// connection string
const connectionString = readEnv("DATABASE_URL");

if (!/-pooler\./.test(connectionString)) {
    console.warn(
        "DATABASE_URL does not look like a Neon pooled connection string " +
        "(no '-pooler' in the host). Serverless functions should use the pooled URL."
    );
}

// ssl parameters are stripped so the explicit ssl object wins
export function stripSslParams(url) {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("channel_binding");
    return u.toString();
}

function parseConnectionString(raw) {
    try {
        return stripSslParams(raw);
    } catch {
        throw new Error(
            "DATABASE_URL is not a valid connection URL. It must look like " +
            "postgresql://user:password@host/dbname, with no surrounding quotes " +
            "and no leading or trailing whitespace."
        );
    }
}

// one pool per module, not per request
export const pool = new pg.Pool({
    connectionString: parseConnectionString(connectionString),

    max: 3,

    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 5_000,

    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,

    statement_timeout: 8_000,
    query_timeout: 9_000,
    idle_in_transaction_session_timeout: 10_000,

    ssl: { rejectUnauthorized: true }
});

pool.on("error", err => {
    console.error("idle postgres client error:", err.message);
});

// query
export function query(text, params) {
    return pool.query(text, params);
}

// warm-up
let warming = null;

export function warmPool() {
    if (warming) return warming;

    warming = pool.connect()
        .then(client => {
            client.release();
            return true;
        })
        .catch(err => {
            warming = null;
            console.warn("postgres warm-up failed:", err.message);
            return false;
        });

    return warming;
}

// transactions
export async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackErr) {
            console.error("rollback failed:", rollbackErr.message);
        }
        throw err;
    } finally {
        client.release();
    }
}
