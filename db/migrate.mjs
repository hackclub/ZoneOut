// section for the migration runner

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { readEnv } from "../lib/env.mjs";

const dbDir = dirname(fileURLToPath(import.meta.url));

const unpooled = readEnv("DATABASE_URL_UNPOOLED", { required: false });
const connectionString = unpooled ?? readEnv("DATABASE_URL", { required: false });
if (!connectionString) {
    console.error(
        "Missing DATABASE_URL_UNPOOLED (or DATABASE_URL). Run `npx neon env pull`,\n" +
        "or copy .env.example to .env.local and fill it in."
    );
    process.exit(1);
}
if (!unpooled) {
    console.warn("DATABASE_URL_UNPOOLED not set - falling back to the pooled URL for DDL.");
}

function stripSslParams(url) {
    try {
        const u = new URL(url);
        u.searchParams.delete("sslmode");
        u.searchParams.delete("channel_binding");
        return u.toString();
    } catch {
        console.error(
            "DATABASE_URL_UNPOOLED is not a valid connection URL. It must look like\n" +
            "postgresql://user:password@host/dbname, with no surrounding quotes."
        );
        process.exit(1);
    }
}

const client = new pg.Client({
    connectionString: stripSslParams(connectionString),
    ssl: { rejectUnauthorized: true }
});

async function main() {
    await client.connect();

    await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            filename    text PRIMARY KEY,
            applied_at  timestamptz NOT NULL DEFAULT now()
        )
    `);

    const applied = new Set(
        (await client.query("SELECT filename FROM _migrations")).rows.map(r => r.filename)
    );

    const files = (await readdir(dbDir))
        .filter(f => f.endsWith(".sql"))
        .sort();

    let count = 0;
    for (const file of files) {
        if (applied.has(file)) continue;

        const sql = await readFile(join(dbDir, file), "utf8");
        await client.query("BEGIN");
        try {
            await client.query(sql);
            await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
            await client.query("COMMIT");
        } catch (err) {
            await client.query("ROLLBACK");
            throw new Error(`migration ${file} failed: ${err.message}`, { cause: err });
        }
        console.log(`applied ${file}`);
        count++;
    }

    console.log(count === 0 ? "already up to date" : `${count} migration(s) applied`);
}

try {
    await main();
} catch (err) {
    console.error(err.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
