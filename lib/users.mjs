import { query } from "./db.mjs";
import { LOG_COLUMNS } from "./activity.mjs";
import { MAIL_COLUMNS, MAIL_AUTHOR, projectMail } from "./mailbox.mjs";

// column lists
const USER_COLUMNS =
    "user_id, email, slack_id, name, first_name, last_name, status, balance_hours::float8 AS balance_hours, " +
    "is_banned, ban_reason, region, cg_access, hackatime_user_id, hackatime_linked_at, hackatime_synced_at, " +
    "created_at, updated_at";

const PROJECT_COLUMNS =
    "project_id, user_id, owner_name, name, description, repo_url, demo_url, " +
    "hackatime_project, hackatime_hours::float8 AS hackatime_hours, hackatime_synced_at, " +
    "review_status, review_remarks, reviewed_at, reviewed_by, submitted_at, fraud_rejected, " +
    "submitted_hours::float8 AS submitted_hours, approved_hours::float8 AS approved_hours, " +
    "credited_hours::float8 AS credited_hours, " +
    "judged_hours::float8 AS judged_hours, " +
    "event_hours::float8 AS event_hours, event_deducted::float8 AS event_deducted, " +
    "round_settled, round_locked, " +
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
                               'fraud_rejected', p.fraud_rejected,
                               'approved_hours', p.approved_hours::float8,
                               'credited_hours', p.credited_hours::float8,
                               'judged_hours', p.judged_hours::float8,
                               'event_hours', p.event_hours::float8,
                               'event_deducted', p.event_deducted::float8,
                               'round_settled', p.round_settled,
                               'round_locked', p.round_locked,
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
        `WITH made AS (
             INSERT INTO projects (user_id, owner_name, name, description, repo_url, demo_url,
                               hackatime_project, hackatime_hours, hackatime_synced_at)
         SELECT u.user_id, u.name, $2, $3, $4, $5,
                $6, $7::numeric, CASE WHEN $6::text IS NULL THEN NULL ELSE now() END
         FROM users u
         WHERE u.user_id = $1
           AND u.is_banned = false
           AND (SELECT count(*) FROM projects p WHERE p.user_id = $1) < ${MAX_PROJECTS_PER_USER}
         RETURNING ${PROJECT_COLUMNS}
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'project.created', user_id, user_id, owner_name, project_id, NULL, NULL, name
               FROM made
         )
         SELECT * FROM made`,
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

export async function deleteProjectAsAdmin(projectId, actorId = null, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `WITH removed AS (
             DELETE FROM projects
             WHERE project_id = $1
             RETURNING project_id, user_id, owner_name, name
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'project.deleted', $2::int, user_id, owner_name, project_id, NULL, NULL, name
               FROM removed
         )
         SELECT project_id FROM removed`,
        [projectId, actorId]
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
                (SELECT u.is_banned FROM users u WHERE u.user_id = $2) AS viewer_banned,
                (SELECT o.slack_id FROM users o WHERE o.user_id = projects.user_id) AS owner_slack_id,
                EXISTS (SELECT 1 FROM event_participants e
                         WHERE e.user_id = projects.user_id) AS owner_on_board,
                (SELECT o.balance_hours::float8 FROM users o WHERE o.user_id = projects.user_id) AS owner_balance_hours,
                (SELECT count(*)::int FROM shop_orders s
                  WHERE s.user_id = projects.user_id AND s.order_status = 'pending') AS owner_pending_orders,
                (SELECT json_agg(json_build_object('at', r.created_at, 'hours', r.hours::float8)
                                 ORDER BY r.created_at)
                   FROM project_reviews r
                  WHERE r.project_id = projects.project_id AND r.status = 'under_review') AS submissions,
                (SELECT json_build_object('at', r.created_at, 'hours', r.hours::float8,
                                          'approved', r.approved_hours::float8,
                                          'payout', r.payout_hours::float8)
                   FROM project_reviews r
                  WHERE r.project_id = projects.project_id AND r.status = 'approved'
                  ORDER BY r.created_at DESC, r.review_id DESC LIMIT 1) AS previous_round
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

// section for review awards
export const FRAUD_PREFIX = "Rejected by fraud squad.";

export function normaliseApprovedHours(value) {
    if (value === null || value === undefined || value === "") {
        throw new ValidationError("The approved hours are required.");
    }

    const hours = Number(value);

    if (!Number.isFinite(hours) || hours < 0) {
        throw new ValidationError("The approved hours must be zero or more.");
    }
    if (hours > MAX_BALANCE_HOURS) {
        throw new ValidationError(`The approved hours must be ${MAX_BALANCE_HOURS} or fewer.`);
    }
    return Math.round(hours * 100) / 100;
}

export function normalisePayoutHours(value) {
    if (value === null || value === undefined || value === "") {
        throw new ValidationError("The payout hours are required.");
    }

    const hours = Number(value);

    if (!Number.isFinite(hours) || hours < 0) {
        throw new ValidationError("The payout must be zero or more.");
    }
    if (hours > MAX_BALANCE_HOURS) {
        throw new ValidationError(`The payout must be ${MAX_BALANCE_HOURS} or fewer.`);
    }
    return Math.round(hours * 100) / 100;
}

export function fraudRemarks(extra) {
    const cleaned = typeof extra === "string" ? extra.replace(/\s+/g, " ").trim() : "";
    if (!cleaned) throw new ValidationError("Remarks are required.");
    return normaliseRemarks(`${FRAUD_PREFIX} ${cleaned}`);
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
                 round_settled        = false,
                 round_locked         = false,
                 review_submission_id = $3::text
             WHERE project_id = $1 AND user_id = $2
               AND fraud_rejected = false
               AND hackatime_project IS NOT NULL
               AND hackatime_hours > 0
               AND repo_url IS NOT NULL AND repo_url <> ''
               AND demo_url IS NOT NULL AND demo_url <> ''
               AND review_submission_id IS DISTINCT FROM $3::text
             RETURNING project_id, user_id, owner_name, hackatime_hours
         ), logged AS (
             INSERT INTO project_reviews (project_id, status, remarks, actor_id, hours)
             SELECT project_id, 'under_review', NULL, $2, hackatime_hours FROM moved
             RETURNING review_id
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'project.submitted', $2::int, user_id, owner_name, project_id, NULL,
                    hackatime_hours, NULL
               FROM moved
         )
         SELECT project_id FROM moved`,
        [projectId, userId, submissionId]
    );
    return rows[0] ?? null;
}

// an administrator putting a project into the review queue, one statement
export async function queueProjectForReview(projectId, actorId, client = null) {
    const run = client ? client.query.bind(client) : query;

    const { rows } = await run(
        `WITH queued AS (
             UPDATE projects SET
                 review_status   = 'under_review',
                 review_remarks  = NULL,
                 reviewed_at     = NULL,
                 reviewed_by     = NULL,
                 submitted_at    = now(),
                 submitted_hours = hackatime_hours,
                 round_settled   = false,
                 round_locked    = (round_settled OR credited_hours > 0 OR approved_hours > 0),
                 fraud_rejected  = false
             WHERE project_id = $1
             RETURNING ${PROJECT_COLUMNS}
         ), logged AS (
             INSERT INTO project_reviews (project_id, status, remarks, actor_id, hours)
             SELECT project_id, 'under_review', NULL, $2::int, hackatime_hours FROM queued
             RETURNING review_id
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'project.queued', $2::int, user_id, owner_name, project_id, NULL,
                    hackatime_hours, NULL
               FROM queued
         )
         SELECT * FROM queued`,
        [projectId, actorId]
    );
    return rows[0] ?? null;
}

// an administrator's verdict, one statement: the verdict, the log row and the payout cannot come apart
export async function setProjectReview(projectId, status, remarks, actorId, client = null, options = {}) {
    const run = client ? client.query.bind(client) : query;

    if (status !== "approved" && status !== "rejected") {
        throw new ValidationError("A review is either approved or rejected.");
    }

    const fraud = status === "rejected" && options.fraud === true;
    const wipe  = fraud && options.wipe === true;
    const credited = status === "approved" ? normaliseApprovedHours(options.approvedHours) : 0;
    const payout   = status === "approved" ? normalisePayoutHours(options.payoutHours) : 0;
    const text  = fraud ? fraudRemarks(options.extraRemarks ?? remarks) : normaliseRemarks(remarks);
    const mail  = projectMail(status, { remarks: text, fraud, wipe });

    const { rows } = await run(
        `WITH prior AS (
             SELECT project_id AS prior_id, user_id AS prior_user,
                    round_settled AS prior_settled,
                    round_locked AS prior_locked,
                    approved_hours AS prior_approved,
                    credited_hours AS prior_paid,
                    judged_hours AS prior_judged,
                    event_hours AS prior_event,
                    event_deducted AS prior_deducted,
                    EXISTS (SELECT 1 FROM event_participants ep
                             WHERE ep.user_id = projects.user_id) AS prior_on_board,
                    CASE WHEN submitted_at IS NULL THEN hackatime_hours
                         ELSE submitted_hours END AS prior_snapshot
             FROM projects
             WHERE project_id = $1
             FOR UPDATE
         ), figures AS (
             SELECT prior.*,
                    CASE WHEN prior_locked THEN 0
                         ELSE GREATEST(0, LEAST($5::numeric, prior_snapshot - prior_judged))
                    END AS round_approved
             FROM prior
         ), money AS (
             SELECT figures.*,
                    CASE WHEN prior_locked THEN 0
                         ELSE GREATEST(0, LEAST($8::numeric, round_approved))
                    END AS round_pay
             FROM figures
         ), board AS (
             SELECT money.*,
                    CASE WHEN $2::text <> 'approved' OR prior_locked
                              OR NOT prior_on_board THEN 0
                         ELSE LEAST(
                             GREATEST(0, (prior_snapshot - prior_judged) - round_approved),
                             GREATEST(0, prior_event - prior_deducted))
                    END AS board_hit
             FROM money
         ), decided AS (
             UPDATE projects SET
                 review_status  = $2::text,
                 review_remarks = $3::text,
                 reviewed_at    = now(),
                 reviewed_by    = $4::int,
                 fraud_rejected = $6::boolean,
                 round_settled  = CASE WHEN $2::text = 'approved' THEN true
                                       ELSE round_settled END,
                 judged_hours   = CASE WHEN $2::text = 'approved' AND NOT prior_locked
                                       THEN GREATEST(prior_judged, prior_snapshot)
                                       ELSE prior_judged END,
                 approved_hours = CASE WHEN $2::text = 'approved'
                                       THEN prior_approved + round_approved
                                       ELSE prior_approved END,
                 credited_hours = CASE WHEN $7::boolean THEN 0
                                       WHEN $2::text = 'approved'
                                       THEN prior_paid + round_pay
                                       ELSE prior_paid END,
                 event_deducted = prior_deducted + board_hit
             FROM board
             WHERE projects.project_id = prior_id
               AND NOT ($2::text = 'approved' AND prior_settled)
             RETURNING ${PROJECT_COLUMNS},
                       (CASE WHEN $2::text = 'approved' THEN round_approved ELSE NULL END) AS round_approved,
                       (CASE WHEN $2::text = 'approved' THEN round_pay ELSE NULL END) AS round_pay,
                       (CASE WHEN $2::text = 'approved' THEN round_pay ELSE 0 END)::float8 AS awarded_hours,
                       board_hit::float8 AS board_hit
         ), boarded AS (
             UPDATE event_participants e
                SET deflation_adjust = e.deflation_adjust + d.board_hit::numeric
               FROM decided d
              WHERE e.user_id = d.user_id AND d.board_hit > 0
          RETURNING e.user_id,
                    GREATEST(e.event_hours + e.hours_adjust - e.deflation_adjust, 0)::float8 AS board_hours
         ), ledger AS (
             UPDATE projects p SET credited_hours = 0
             FROM prior
             WHERE $7::boolean AND p.user_id = prior_user AND p.project_id <> prior_id
             RETURNING p.project_id
         ), seized AS (
             UPDATE shop_orders o SET
                 order_status = 'rejected',
                 reviewed_at  = now(),
                 reviewed_by  = $4::int
             FROM prior
             WHERE $7::boolean AND o.user_id = prior_user AND o.order_status = 'pending'
             RETURNING o.order_id
         ), mailed AS (
             INSERT INTO announcements (${MAIL_COLUMNS})
             SELECT replace($9::text, '{name}', d.name),
                    replace($10::text, '{name}', d.name),
                    $4::int, $11::text, d.user_id
               FROM decided d
         ), logged AS (
             INSERT INTO project_reviews (project_id, status, remarks, actor_id, hours,
                                          approved_hours, payout_hours)
             SELECT project_id, $2::text, $3::text, $4::int, hackatime_hours,
                    round_approved, round_pay
               FROM decided
             RETURNING review_id
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT CASE WHEN $2::text = 'approved' THEN 'project.approved'
                         WHEN $7::boolean THEN 'project.wiped'
                         WHEN $6::boolean THEN 'project.fraud'
                         ELSE 'project.rejected' END,
                    $4::int, user_id, owner_name, project_id, NULL,
                    CASE WHEN $2::text = 'approved' THEN round_pay ELSE NULL END,
                    $3::text
               FROM decided
         ), deflated AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'event.deflated', $4::int, d.user_id, d.owner_name, d.project_id, NULL,
                    (0 - d.board_hit)::numeric,
                    'leaderboard now ' || b.board_hours
               FROM decided d JOIN boarded b ON b.user_id = d.user_id
         ), settled AS (
             UPDATE users u SET
                 balance_hours = CASE WHEN $7::boolean THEN 0
                                      WHEN u.is_banned THEN u.balance_hours
                                      ELSE GREATEST(0, u.balance_hours + d.awarded_hours::numeric) END,
                 updated_at    = now()
             FROM decided d
             WHERE u.user_id = d.user_id AND ($7::boolean OR d.awarded_hours <> 0)
             RETURNING u.user_id, u.balance_hours::float8 AS balance_hours
         )
         SELECT (d.project_id IS NOT NULL) AS applied, d.*,
                (SELECT balance_hours FROM settled) AS balance_hours,
                (SELECT board_hours FROM boarded) AS board_hours,
                (SELECT count(*) FROM seized)::int AS seized_orders
         FROM prior p LEFT JOIN decided d ON d.project_id = p.prior_id`,
        [projectId, status, text, actorId, credited, fraud, wipe, payout,
         mail.title, mail.body, MAIL_AUTHOR]
    );

    const row = rows[0] ?? null;
    if (!row) return null;

    // the round has already been paid; only a re-submission opens a new one
    if (!row.applied) {
        throw new ValidationError(
            "This round has already been approved. Add the project back to the queue " +
            "or wait for a re-submission before approving again."
        );
    }
    return row;
}

// an approved round's hours corrected after the fact: the figure and the remarks, no money
export async function updateApprovedHours(projectId, hours, remarks, actorId, client = null) {
    const run = client ? client.query.bind(client) : query;

    const wanted = normaliseApprovedHours(hours);
    const text = normaliseRemarks(remarks);

    const { rows } = await run(
        `WITH prior AS (
             SELECT project_id AS prior_id, approved_hours AS prior_approved,
                    GREATEST(hackatime_hours, COALESCE(submitted_hours, 0), approved_hours)
                        AS prior_ceiling
             FROM projects
             WHERE project_id = $1 AND review_status = 'approved'
             FOR UPDATE
         ), figures AS (
             SELECT prior.*, GREATEST(0, LEAST($2::numeric, prior_ceiling)) AS next_approved
             FROM prior
         ), updated AS (
             UPDATE projects SET
                 approved_hours = next_approved,
                 review_remarks = $3::text
             FROM figures
             WHERE projects.project_id = prior_id
             RETURNING ${PROJECT_COLUMNS},
                       figures.prior_approved::float8 AS prior_approved,
                       (next_approved - prior_approved)::float8 AS hours_delta
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'project.updated', $4::int, user_id, owner_name, project_id, NULL,
                    hours_delta, $3::text
               FROM updated
         )
         SELECT * FROM updated`,
        [projectId, wanted, text, actorId]
    );
    return rows[0] ?? null;
}

// remarks only, touching no hours and no balance
export async function setReviewRemarks(projectId, remarks, actorId, client = null) {
    const run = client ? client.query.bind(client) : query;

    const plain = normaliseRemarks(remarks);
    const marked = fraudRemarks(remarks);

    const { rows } = await run(
        `WITH edited AS (
             UPDATE projects SET
                 review_remarks = CASE WHEN fraud_rejected THEN $3::text ELSE $2::text END
             WHERE project_id = $1 AND review_status IN ('approved', 'rejected')
             RETURNING ${PROJECT_COLUMNS}
         ), logged AS (
             INSERT INTO project_reviews (project_id, status, remarks, actor_id, hours)
             SELECT project_id, review_status, review_remarks, $4::int, hackatime_hours FROM edited
             RETURNING review_id
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'project.remarks', $4::int, user_id, owner_name, project_id, NULL,
                    NULL, review_remarks
               FROM edited
         )
         SELECT * FROM edited`,
        [projectId, plain, marked, actorId]
    );
    return rows[0] ?? null;
}

// the admin reviews panel
export async function listProjectsForReview() {
    const { rows } = await query(
        `SELECT p.project_id, p.user_id, p.name, p.owner_name,
                p.repo_url, p.demo_url,
                p.review_status, p.review_remarks, p.reviewed_at, p.submitted_at,
                p.hackatime_project, p.fraud_rejected,
                p.approved_hours::float8 AS approved_hours,
                p.credited_hours::float8 AS credited_hours,
                p.judged_hours::float8 AS judged_hours,
                p.event_hours::float8 AS event_hours,
                p.event_deducted::float8 AS event_deducted,
                (ep.user_id IS NOT NULL) AS on_leaderboard,
                p.round_settled, p.round_locked,
                p.hackatime_hours::float8 AS hackatime_hours,
                p.submitted_hours::float8 AS submitted_hours,
                (SELECT count(*)::int FROM project_reviews r
                  WHERE r.project_id = p.project_id AND r.status = 'under_review') AS submission_count,
                (SELECT json_build_object('at', r.created_at, 'hours', r.hours::float8,
                                          'approved', r.approved_hours::float8,
                                          'payout', r.payout_hours::float8)
                   FROM project_reviews r
                  WHERE r.project_id = p.project_id AND r.status = 'approved'
                  ORDER BY r.created_at DESC, r.review_id DESC LIMIT 1) AS previous_round,
                u.email, u.slack_id, u.balance_hours::float8 AS balance_hours
         FROM projects p
         JOIN users u ON u.user_id = p.user_id
         LEFT JOIN event_participants ep ON ep.user_id = p.user_id
         WHERE p.review_status <> 'draft'
         ORDER BY p.submitted_at DESC NULLS LAST, p.project_id DESC`
    );
    return rows;
}

export async function deleteProjectForUser(userId, projectId, client = null, actorId = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `WITH removed AS (
             DELETE FROM projects
             WHERE project_id = $1 AND user_id = $2
             RETURNING project_id, user_id, owner_name, name
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'project.deleted', COALESCE($3::int, $2::int), user_id, owner_name,
                    project_id, NULL, NULL, name
               FROM removed
         )
         SELECT project_id FROM removed`,
        [projectId, userId, actorId]
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

export async function setBalanceHours(userId, hours, client = null, actorId = null) {
    const run = client ? client.query.bind(client) : query;

    if (!Number.isFinite(hours) || hours < 0 || hours > MAX_BALANCE_HOURS) {
        throw new Error(`balance must be between 0 and ${MAX_BALANCE_HOURS}`);
    }

    const { rows } = await run(
        `WITH changed AS (
             UPDATE users SET balance_hours = $2::numeric, updated_at = now()
             WHERE user_id = $1
             RETURNING user_id, name, balance_hours::float8 AS balance_hours
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'balance.set', $3::int, user_id, name, NULL, NULL, $2::numeric, NULL
               FROM changed
         )
         SELECT user_id, balance_hours FROM changed`,
        [userId, hours, actorId]
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
export async function setCompletionGrantAccess(userId, granted, client = null, actorId = null) {
    const run = client ? client.query.bind(client) : query;

    const { rows } = await run(
        `WITH changed AS (
             UPDATE users SET cg_access = $2::boolean, updated_at = now()
              WHERE user_id = $1
          RETURNING user_id, name, cg_access
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'user.access', $3::int, user_id, name, NULL, NULL, NULL,
                    CASE WHEN $2::boolean THEN 'granted' ELSE 'revoked' END
               FROM changed
         )
         SELECT user_id, cg_access FROM changed`,
        [userId, Boolean(granted), actorId]
    );
    return rows[0] ?? null;
}

// bans
export const BAN_REASON_MAX = 500;

export async function setBanState(userId, isBanned, reason = null, client = null, actorId = null) {
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
        `WITH changed AS (
             UPDATE users SET is_banned = $2, ban_reason = $3, updated_at = now()
             WHERE user_id = $1
             RETURNING user_id, name, email, is_banned, ban_reason
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT CASE WHEN $2::boolean THEN 'user.banned' ELSE 'user.unbanned' END,
                    $4::int, user_id, name, NULL, NULL, NULL, $3::text
               FROM changed
         )
         SELECT * FROM changed`,
        [userId, isBanned, stored, actorId]
    );
    return rows[0] ?? null;
}
