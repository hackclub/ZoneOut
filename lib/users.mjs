// section for users

import { query } from "./db.mjs";

const USER_COLUMNS = "user_id, email, slack_id, name, status, created_at, updated_at";

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
             )
             SELECT * FROM by_slack
             UNION ALL
             SELECT * FROM by_email`,
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
                COALESCE((
                    SELECT json_agg(json_build_object(
                               'project_id', p.project_id,
                               'created_at', p.created_at
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

// section for projects
export async function createProject(userId) {
    const { rows } = await query(
        `INSERT INTO projects (user_id)
         VALUES ($1)
         RETURNING project_id, user_id, created_at`,
        [userId]
    );
    return rows[0];
}

export async function getProjectById(projectId) {
    const { rows } = await query(
        `SELECT project_id, user_id, created_at FROM projects WHERE project_id = $1`,
        [projectId]
    );
    return rows[0] ?? null;
}

export async function listProjectsForUser(userId) {
    const { rows } = await query(
        `SELECT project_id, user_id, created_at
         FROM projects
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
}

export async function deleteUser(userId) {
    const { rowCount } = await query("DELETE FROM users WHERE user_id = $1", [userId]);
    return rowCount > 0;
}
