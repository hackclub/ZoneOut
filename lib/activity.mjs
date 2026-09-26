import { query } from "./db.mjs";

// section for the audit trail vocabulary
export const ACTIVITY_KINDS = [
    "project.created",
    "project.submitted",
    "project.queued",
    "project.approved",
    "project.rejected",
    "project.fraud",
    "project.wiped",
    "project.remarks",
    "project.updated",
    "project.deleted",
    "order.placed",
    "order.cancelled",
    "order.approved",
    "order.rejected",
    "balance.set",
    "user.banned",
    "user.unbanned",
    "user.shadowbanned",
    "user.unshadowbanned",
    "user.access",
    "event.tuned",
    "event.adjusted",
    "event.removed",
    "event.added",
    "event.deflated",
    "event.shadowed",
    "event.unshadowed",
    "event.restored",
    "announcement.posted",
    "announcement.pulled"
];

const KIND_SET = new Set(ACTIVITY_KINDS);
const PAGE = 100;
const MAX_PAGE = 500;

// the insert every write path mounts as a CTE, so a record cannot come apart from the act
export const LOG_COLUMNS =
    "kind, actor_id, subject_id, subject_name, project_id, order_id, hours, detail";

// section for the read path
const READ_COLUMNS = `a.event_id, a.kind, a.actor_id, a.subject_id, a.subject_name,
                      a.project_id, a.order_id, a.hours::float8 AS hours,
                      a.detail, a.created_at,
                      actor.name AS actor_name, actor.email AS actor_email,
                      subject.email AS subject_email, subject.slack_id AS subject_slack_id`;

export async function listActivity({ kind = null, userId = null, projectId = null,
                                     before = null, limit = PAGE } = {}) {
    const size = Math.min(Math.max(Number(limit) || PAGE, 1), MAX_PAGE);
    const wanted = KIND_SET.has(kind) ? kind : null;
    const subject = Number.isSafeInteger(Number(userId)) && Number(userId) > 0 ? Number(userId) : null;
    const project = Number.isSafeInteger(Number(projectId)) && Number(projectId) > 0 ? Number(projectId) : null;
    const cursor = Number.isSafeInteger(Number(before)) && Number(before) > 0 ? Number(before) : null;

    const { rows } = await query(
        `SELECT ${READ_COLUMNS}
           FROM activity_log a
           LEFT JOIN users actor   ON actor.user_id = a.actor_id
           LEFT JOIN users subject ON subject.user_id = a.subject_id
          WHERE ($1::text IS NULL OR a.kind = $1::text)
            AND ($2::int  IS NULL OR a.subject_id = $2::int OR a.actor_id = $2::int)
            AND ($3::int  IS NULL OR a.project_id = $3::int)
            AND ($4::bigint IS NULL OR a.event_id < $4::bigint)
          ORDER BY a.event_id DESC
          LIMIT ${size}`,
        [wanted, subject, project, cursor]
    );
    return rows;
}

export async function activityTotals() {
    const { rows } = await query(
        `SELECT count(*)::int AS total,
                (SELECT count(*)::int FROM activity_log
                  WHERE created_at > now() - interval '24 hours') AS today
           FROM activity_log`
    );
    return rows[0] ?? { total: 0, today: 0 };
}

// a record the panel can render without another lookup
export function presentActivity(rows) {
    return (rows || []).map(row => ({
        eventId: String(row.event_id),
        kind: row.kind,
        actorId: row.actor_id ?? null,
        actorName: row.actor_name ?? null,
        actorEmail: row.actor_email ?? null,
        subjectId: row.subject_id ?? null,
        subjectName: row.subject_name ?? null,
        subjectEmail: row.subject_email ?? null,
        subjectSlackId: row.subject_slack_id ?? null,
        projectId: row.project_id ?? null,
        orderId: row.order_id ?? null,
        hours: row.hours ?? null,
        detail: row.detail ?? null,
        createdAt: row.created_at
    }));
}
