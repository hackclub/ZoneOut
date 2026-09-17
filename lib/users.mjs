import { query } from "./db.mjs";

// column lists
const USER_COLUMNS =
    "user_id, email, slack_id, name, first_name, last_name, status, balance_hours::float8 AS balance_hours, " +
    "is_banned, ban_reason, region, cg_access, hackatime_user_id, hackatime_linked_at, hackatime_synced_at, " +
    "created_at, updated_at";

const PROJECT_COLUMNS =
    "project_id, user_id, owner_name, name, description, repo_url, demo_url, " +
    "hackatime_project, hackatime_hours::float8 AS hackatime_hours, hackatime_synced_at, " +
    "review_status, review_remarks, reviewed_at, reviewed_by, submitted_at, " +
    "submitted_hours::float8 AS submitted_hours, " +
    "created_at, updated_at";

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
export async function upsertUser({ email, slackId = null, name = null, firstName = null, lastName = null, status = null }) {
    if (!email) throw new Error("upsertUser requires an email");

    try {
        const { rows } = await query(
            `WITH by_slack AS (
                 UPDATE users SET
                     email      = $1::text,
                     name       = COALESCE($3::text, name),
                     first_name = COALESCE($5::text, first_name),
                     last_name  = COALESCE($6::text, last_name),
                     status     = COALESCE($4::text, status),
                     updated_at = now()
                 WHERE slack_id = $2::text
                 RETURNING ${USER_COLUMNS}
             ), by_email AS (
                 INSERT INTO users (email, slack_id, name, first_name, last_name, status)
                 SELECT $1::text, $2::text, $3::text, $5::text, $6::text, COALESCE($4::text, 'pending')
                 WHERE NOT EXISTS (SELECT 1 FROM by_slack)
                 ON CONFLICT (email) DO UPDATE SET
                     slack_id   = COALESCE(EXCLUDED.slack_id, users.slack_id),
                     name       = COALESCE(EXCLUDED.name, users.name),
                     first_name = COALESCE(EXCLUDED.first_name, users.first_name),
                     last_name  = COALESCE(EXCLUDED.last_name, users.last_name),
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
             ), synced_orders AS (
                 UPDATE shop_orders o SET user_name = m.name
                 FROM merged m
                 WHERE o.user_id = m.user_id AND o.user_name IS DISTINCT FROM m.name
                 RETURNING o.order_id
             ), synced_suggestions AS (
                 UPDATE shop_suggestions s SET user_name = m.name
                 FROM merged m
                 WHERE s.user_id = m.user_id AND s.user_name IS DISTINCT FROM m.name
                 RETURNING s.suggestion_id
             )
             SELECT * FROM merged`,
            [email, slackId, name, status, firstName, lastName]
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
                u.is_banned, u.ban_reason, u.region, u.hackatime_user_id,
                (u.submit_profile IS NOT NULL) AS submit_profile_on,
                EXISTS (SELECT 1 FROM event_participants e WHERE e.user_id = u.user_id) AS event_joined,
                COALESCE((
                    SELECT json_agg(json_build_object(
                               'project_id',  p.project_id,
                               'owner_name',  p.owner_name,
                               'name',        p.name,
                               'description', p.description,
                               'repo_url',    p.repo_url,
                               'demo_url',    p.demo_url,
                               'hackatime_project', p.hackatime_project,
                               'hackatime_hours',   p.hackatime_hours::float8,
                               'review_status',  p.review_status,
                               'review_remarks', p.review_remarks,
                               'reviewed_at',    p.reviewed_at,
                               'submitted_at',   p.submitted_at,
                               'submitted_hours', p.submitted_hours::float8,
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

// hackatime link on a project
export const HACKATIME_PROJECT_MAX = 255;

export function normaliseHackatimeProject(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") throw new ValidationError("Hackatime project must be a name");

    const trimmed = value.trim().replace(/\s+/g, " ");
    if (!trimmed) return null;
    if (trimmed.length > HACKATIME_PROJECT_MAX) {
        throw new ValidationError("Hackatime project name is too long");
    }
    return trimmed;
}

// projects
export const MAX_PROJECTS_PER_USER = 20;

export async function createProject(userId, { name, description, repoUrl, demoUrl, hackatimeProject, hackatimeHours } = {}) {
    const { rows } = await query(
        `INSERT INTO projects (user_id, owner_name, name, description, repo_url, demo_url,
                               hackatime_project, hackatime_hours, hackatime_synced_at)
         SELECT u.user_id, u.name, $2, $3, $4, $5,
                $6, $7::numeric, CASE WHEN $6::text IS NULL THEN NULL ELSE now() END
         FROM users u
         WHERE u.user_id = $1
           AND u.is_banned = false
           AND (SELECT count(*) FROM projects p WHERE p.user_id = $1) < ${MAX_PROJECTS_PER_USER}
         RETURNING ${PROJECT_COLUMNS}`,
        [
            userId,
            requireText(name, "Project name", PROJECT_NAME_MAX),
            requireText(description, "Project description", PROJECT_DESCRIPTION_MAX),
            normaliseLink(repoUrl, "Repository link"),
            normaliseLink(demoUrl, "Demo link"),
            normaliseHackatimeProject(hackatimeProject),
            Number(hackatimeHours) > 0 ? Number(hackatimeHours) : 0
        ]
    );

    if (!rows[0]) {
        throw new ValidationError(
            "This project could not be created. You may keep at most " + MAX_PROJECTS_PER_USER + "."
        );
    }

    return rows[0];
}

export async function updateProjectForUser(projectId, ownerId, { name, description, repoUrl, demoUrl, hackatimeProject, hackatimeHours } = {}) {
    const { rows } = await query(
        `UPDATE projects SET
             owner_name          = (SELECT name FROM users WHERE user_id = $2),
             name                = $3,
             description         = $4,
             repo_url            = $5,
             demo_url            = $6,
             hackatime_project   = $7,
             hackatime_hours     = $8::numeric,
             hackatime_synced_at = CASE WHEN $7::text IS NULL THEN NULL ELSE now() END,
             updated_at          = now()
         WHERE project_id = $1 AND user_id = $2
         RETURNING ${PROJECT_COLUMNS}`,
        [
            projectId,
            ownerId,
            requireText(name, "Project name", PROJECT_NAME_MAX),
            requireText(description, "Project description", PROJECT_DESCRIPTION_MAX),
            normaliseLink(repoUrl, "Repository link"),
            normaliseLink(demoUrl, "Demo link"),
            normaliseHackatimeProject(hackatimeProject),
            Number(hackatimeHours) > 0 ? Number(hackatimeHours) : 0
        ]
    );
    return rows[0] ?? null;
}

// admin overrides, any owner
export async function updateProjectAsAdmin(projectId, { name, description, repoUrl, demoUrl } = {}) {
    const { rows } = await query(
        `UPDATE projects SET
             name        = $2,
             description = $3,
             repo_url    = $4,
             demo_url    = $5,
             updated_at  = now()
         WHERE project_id = $1
         RETURNING ${PROJECT_COLUMNS}`,
        [
            projectId,
            requireText(name, "Project name", PROJECT_NAME_MAX),
            requireText(description, "Project description", PROJECT_DESCRIPTION_MAX),
            normaliseLink(repoUrl, "Repository link"),
            normaliseLink(demoUrl, "Demo link")
        ]
    );
    return rows[0] ?? null;
}

export async function deleteProjectAsAdmin(projectId, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `DELETE FROM projects
         WHERE project_id = $1
         RETURNING project_id`,
        [projectId]
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

// the project and who is looking at it, in one round trip
export async function getProjectWithViewer(projectId, viewerId) {
    const { rows } = await query(
        `SELECT ${PROJECT_COLUMNS},
                (SELECT u.email    FROM users u WHERE u.user_id = $2) AS viewer_email,
                (SELECT u.is_banned FROM users u WHERE u.user_id = $2) AS viewer_banned
         FROM projects
         WHERE project_id = $1`,
        [projectId, viewerId]
    );
    return rows[0] ?? null;
}

// hackatime links held by this user's other projects
export async function listHackatimeLinks(userId) {
    const { rows } = await query(
        `SELECT project_id, name, hackatime_project
         FROM projects
         WHERE user_id = $1 AND hackatime_project IS NOT NULL`,
        [userId]
    );
    return rows;
}

export async function findHackatimeLinkOwner(userId, hackatimeProject, excludeProjectId = null) {
    const { rows } = await query(
        `SELECT project_id, name
         FROM projects
         WHERE user_id = $1
           AND lower(hackatime_project) = lower($2)
           AND ($3::int IS NULL OR project_id <> $3::int)
         LIMIT 1`,
        [userId, hackatimeProject, excludeProjectId]
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

// project reviews
export const REVIEW_REMARKS_MAX = 500;

export function normaliseRemarks(value) {
    const cleaned = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

    if (!cleaned) throw new ValidationError("Remarks are required.");
    if (cleaned.length > REVIEW_REMARKS_MAX) {
        throw new ValidationError(`Remarks must be ${REVIEW_REMARKS_MAX} characters or fewer.`);
    }
    return cleaned;
}

// a real submission, proved by the webhook, one statement
export async function markProjectUnderReview(projectId, userId, submissionId) {
    const { rows } = await query(
        `WITH moved AS (
             UPDATE projects SET
                 review_status        = 'under_review',
                 review_remarks       = NULL,
                 reviewed_at          = NULL,
                 reviewed_by          = NULL,
                 submitted_at         = now(),
                 submitted_hours      = hackatime_hours,
                 review_submission_id = $3::text
             WHERE project_id = $1 AND user_id = $2
               AND review_submission_id IS DISTINCT FROM $3::text
             RETURNING project_id
         ), logged AS (
             INSERT INTO project_reviews (project_id, status, remarks, actor_id)
             SELECT project_id, 'under_review', NULL, $2 FROM moved
             RETURNING review_id
         )
         SELECT project_id FROM moved`,
        [projectId, userId, submissionId]
    );
    return rows[0] ?? null;
}

// an administrator's verdict, one statement
export async function setProjectReview(projectId, status, remarks, actorId, client = null) {
    const run = client ? client.query.bind(client) : query;

    if (status !== "approved" && status !== "rejected") {
        throw new ValidationError("A review is either approved or rejected.");
    }

    const { rows } = await run(
        `WITH decided AS (
             UPDATE projects SET
                 review_status  = $2::text,
                 review_remarks = $3::text,
                 reviewed_at    = now(),
                 reviewed_by    = $4::int
             WHERE project_id = $1
             RETURNING ${PROJECT_COLUMNS}
         ), logged AS (
             INSERT INTO project_reviews (project_id, status, remarks, actor_id)
             SELECT project_id, $2::text, $3::text, $4::int FROM decided
             RETURNING review_id
         )
         SELECT * FROM decided`,
        [projectId, status, normaliseRemarks(remarks), actorId]
    );
    return rows[0] ?? null;
}

// the admin reviews panel
export async function listProjectsForReview() {
    const { rows } = await query(
        `SELECT p.project_id, p.user_id, p.name, p.owner_name,
                p.review_status, p.review_remarks, p.reviewed_at, p.submitted_at,
                p.hackatime_hours::float8 AS hackatime_hours,
                p.submitted_hours::float8 AS submitted_hours,
                u.email, u.slack_id
         FROM projects p
         JOIN users u ON u.user_id = p.user_id
         WHERE p.review_status <> 'draft'
         ORDER BY p.submitted_at DESC NULLS LAST, p.project_id DESC`
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
        `SELECT u.user_id, u.name, u.email, u.slack_id, u.status,
                u.balance_hours::float8 AS balance_hours,
                u.is_banned, u.ban_reason, u.region, u.cg_access, u.created_at,
                (u.hackatime_user_id IS NOT NULL) AS hackatime_linked,
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

// admin project board
export async function listAllProjectsForAdmin() {
    const { rows } = await query(
        `SELECT p.project_id, p.user_id, p.owner_name, p.name, p.description,
                p.repo_url, p.demo_url,
                p.hackatime_project,
                p.hackatime_hours::float8 AS hackatime_hours,
                p.hackatime_synced_at, p.created_at, p.updated_at,
                u.email, u.slack_id, u.region, u.is_banned
         FROM projects p
         JOIN users u ON u.user_id = p.user_id
         ORDER BY p.project_id`
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

// region
export async function setUserRegion(userId, region) {
    const { rows } = await query(
        `UPDATE users SET region = $2::text, updated_at = now()
          WHERE user_id = $1 AND is_banned = false
      RETURNING user_id, region`,
        [userId, region]
    );
    return rows[0] ?? null;
}

// submission profile
export async function readSubmitProfile(userId) {
    const { rows } = await query(
        "SELECT submit_profile, submit_profile_at FROM users WHERE user_id = $1",
        [userId]
    );
    return rows[0] ?? null;
}

export async function writeSubmitProfile(userId, sealed, submissionId) {
    const { rows } = await query(
        `UPDATE users SET
             submit_profile    = $2::text,
             submit_profile_id = $3::text,
             submit_profile_at = now()
          WHERE user_id = $1
            AND is_banned = false
            AND submit_profile_id IS DISTINCT FROM $3::text
      RETURNING user_id`,
        [userId, sealed, submissionId]
    );
    return rows[0] ?? null;
}

export async function clearSubmitProfile(userId) {
    const { rows } = await query(
        `UPDATE users SET
             submit_profile    = NULL,
             submit_profile_id = NULL,
             submit_profile_at = NULL
          WHERE user_id = $1 AND is_banned = false
      RETURNING user_id`,
        [userId]
    );
    return rows[0] ?? null;
}

// completion grant access
export async function setCompletionGrantAccess(userId, granted, client = null) {
    const run = client ? client.query.bind(client) : query;

    const { rows } = await run(
        `UPDATE users SET cg_access = $2::boolean, updated_at = now()
          WHERE user_id = $1
      RETURNING user_id, cg_access`,
        [userId, Boolean(granted)]
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
