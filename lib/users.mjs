import { query } from "./db.mjs";

// column lists
const USER_COLUMNS =
    "user_id, email, slack_id, name, status, balance_hours::float8 AS balance_hours, " +
    "is_banned, ban_reason, created_at, updated_at";

const PROJECT_COLUMNS =
    "project_id, user_id, owner_name, name, description, repo_url, demo_url, created_at, updated_at";

// identity collisions
function describeCollision(err, { email, slackId }) {
    if (err.code !== "23505") return null;

    if (err.constraint === "users_email_key") {
        return `cannot move email ${email} onto the user for slack_id ${slackId}: ` +
               "another user row already owns that email; these two rows need merging";
    }
    if (err.constraint === "users_slack_id_key") {
        return `cannot attach slack_id ${slackId} to the user for ${email}: ` +
               "another user row already owns that slack_id; these two rows need merging";
    }
    return null;
}

// login upsert, one statement
export async function upsertUser({ email, slackId = null, name = null, status = null }) {
    if (!email) throw new Error("upsertUser requires an email");

    try {
        const { rows } = await query(
            `WITH by_slack AS (
                 UPDATE users SET
                     email      = $1::text,
                     name       = COALESCE($3::text, name),
                     status     = COALESCE($4::text, status),
                     updated_at = now()
                 WHERE slack_id = $2::text
                 RETURNING ${USER_COLUMNS}
             ), by_email AS (
                 INSERT INTO users (email, slack_id, name, status)
                 SELECT $1::text, $2::text, $3::text, COALESCE($4::text, 'pending')
                 WHERE NOT EXISTS (SELECT 1 FROM by_slack)
                 ON CONFLICT (email) DO UPDATE SET
                     slack_id   = COALESCE(EXCLUDED.slack_id, users.slack_id),
                     name       = COALESCE(EXCLUDED.name, users.name),
                     status     = COALESCE($4::text, users.status),
                     updated_at = now()
                 RETURNING ${USER_COLUMNS}
             ), merged AS (
                 SELECT * FROM by_slack
                 UNION ALL
                 SELECT * FROM by_email
             ), synced AS (
                 UPDATE projects p SET owner_name = m.name
                 FROM merged m
                 WHERE p.user_id = m.user_id AND p.owner_name IS DISTINCT FROM m.name
                 RETURNING p.project_id
             )
             SELECT * FROM merged`,
            [email, slackId, name, status]
        );

        if (!rows[0]) throw new Error(`upsertUser stored no row for ${email}`);
        return rows[0];
    } catch (err) {
        const collision = describeCollision(err, { email, slackId });
        if (collision) throw new Error(collision, { cause: err });
        throw err;
    }
}

// user lookups
export async function getUserById(userId) {
    const { rows } = await query(
        `SELECT ${USER_COLUMNS} FROM users WHERE user_id = $1`,
        [userId]
    );
    return rows[0] ?? null;
}

export async function getUserWithProjects(userId) {
    const { rows } = await query(
        `SELECT u.user_id, u.email, u.slack_id, u.name, u.status,
                u.balance_hours::float8 AS balance_hours,
                u.is_banned, u.ban_reason,
                COALESCE((
                    SELECT json_agg(json_build_object(
                               'project_id',  p.project_id,
                               'owner_name',  p.owner_name,
                               'name',        p.name,
                               'description', p.description,
                               'repo_url',    p.repo_url,
                               'demo_url',    p.demo_url,
                               'created_at',  p.created_at,
                               'updated_at',  p.updated_at
                           ) ORDER BY p.created_at DESC)
                    FROM projects p
                    WHERE p.user_id = u.user_id
                ), '[]'::json) AS projects
         FROM users u
         WHERE u.user_id = $1`,
        [userId]
    );
    return rows[0] ?? null;
}

export async function getUserByEmail(email) {
    const { rows } = await query(
        `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
        [email]
    );
    return rows[0] ?? null;
}

export async function getUserBySlackId(slackId) {
    const { rows } = await query(
        `SELECT ${USER_COLUMNS} FROM users WHERE slack_id = $1`,
        [slackId]
    );
    return rows[0] ?? null;
}

// error type
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}

// link validation
export function normaliseLink(value, field) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") throw new ValidationError(field + " must be a URL");

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 2048) throw new ValidationError(field + " is too long");

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new ValidationError(field + " must be a full URL beginning http:// or https://");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ValidationError(field + " must be a full URL beginning http:// or https://");
    }
    return parsed.toString();
}

// project field limits
export const PROJECT_NAME_MAX = 80;
export const PROJECT_DESCRIPTION_MAX = 2000;

function requireText(value, field, max) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) throw new ValidationError(field + " is required");
    if (trimmed.length > max) throw new ValidationError(field + " must be " + max + " characters or fewer");
    return trimmed;
}

// projects
export async function createProject(userId, { name, description, repoUrl, demoUrl } = {}) {
    const { rows } = await query(
        `INSERT INTO projects (user_id, owner_name, name, description, repo_url, demo_url)
         VALUES ($1, (SELECT name FROM users WHERE user_id = $1), $2, $3, $4, $5)
         RETURNING ${PROJECT_COLUMNS}`,
        [
            userId,
            requireText(name, "Project name", PROJECT_NAME_MAX),
            requireText(description, "Project description", PROJECT_DESCRIPTION_MAX),
            normaliseLink(repoUrl, "Repository link"),
            normaliseLink(demoUrl, "Demo link")
        ]
    );
    return rows[0];
}

export async function updateProjectForUser(projectId, ownerId, { name, description, repoUrl, demoUrl } = {}) {
    const { rows } = await query(
        `UPDATE projects SET
             owner_name  = (SELECT name FROM users WHERE user_id = $2),
             name        = $3,
             description = $4,
             repo_url    = $5,
             demo_url    = $6,
             updated_at  = now()
         WHERE project_id = $1 AND user_id = $2
         RETURNING ${PROJECT_COLUMNS}`,
        [
            projectId,
            ownerId,
            requireText(name, "Project name", PROJECT_NAME_MAX),
            requireText(description, "Project description", PROJECT_DESCRIPTION_MAX),
            normaliseLink(repoUrl, "Repository link"),
            normaliseLink(demoUrl, "Demo link")
        ]
    );
    return rows[0] ?? null;
}

export async function getProjectById(projectId) {
    const { rows } = await query(
        `SELECT ${PROJECT_COLUMNS}
         FROM projects
         WHERE project_id = $1`,
        [projectId]
    );
    return rows[0] ?? null;
}

export async function listProjectsForUser(userId) {
    const { rows } = await query(
        `SELECT ${PROJECT_COLUMNS}
         FROM projects
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
}

export async function deleteProjectForUser(userId, projectId, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `DELETE FROM projects
         WHERE project_id = $1 AND user_id = $2
         RETURNING project_id`,
        [projectId, userId]
    );
    return rows[0] ?? null;
}

export async function deleteUser(userId) {
    const { rowCount } = await query("DELETE FROM users WHERE user_id = $1", [userId]);
    return rowCount > 0;
}

// admin table
export async function listAllUsersForAdmin() {
    const { rows } = await query(
        `SELECT u.user_id, u.name, u.email, u.status,
                u.balance_hours::float8 AS balance_hours,
                u.is_banned, u.ban_reason, u.created_at,
                COALESCE((
                    SELECT json_agg(p.project_id ORDER BY p.created_at DESC)
                    FROM projects p
                    WHERE p.user_id = u.user_id
                ), '[]'::json) AS project_ids
         FROM users u
         ORDER BY u.user_id`
    );
    return rows;
}

// balances
export const MAX_BALANCE_HOURS = 99999;

export async function setBalanceHours(userId, hours, client = null) {
    const run = client ? client.query.bind(client) : query;

    if (!Number.isFinite(hours) || hours < 0 || hours > MAX_BALANCE_HOURS) {
        throw new Error(`balance must be between 0 and ${MAX_BALANCE_HOURS}`);
    }

    const { rows } = await run(
        `UPDATE users SET balance_hours = $2::numeric, updated_at = now()
         WHERE user_id = $1
         RETURNING user_id, balance_hours::float8 AS balance_hours`,
        [userId, hours]
    );
    return rows[0] ?? null;
}

// bans
export const BAN_REASON_MAX = 500;

export async function setBanState(userId, isBanned, reason = null, client = null) {
    const run = client ? client.query.bind(client) : query;

    let stored = null;
    if (isBanned) {
        stored = typeof reason === "string" ? reason.trim() : "";
        if (!stored) throw new Error("a ban needs a reason");
        if (stored.length > BAN_REASON_MAX) {
            throw new Error(`ban reason must be ${BAN_REASON_MAX} characters or fewer`);
        }
    }

    const { rows } = await run(
        `UPDATE users SET is_banned = $2, ban_reason = $3, updated_at = now()
         WHERE user_id = $1
         RETURNING user_id, name, email, is_banned, ban_reason`,
        [userId, isBanned, stored]
    );
    return rows[0] ?? null;
}
