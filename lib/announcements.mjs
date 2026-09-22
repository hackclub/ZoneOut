import { query } from "./db.mjs";
import { LOG_COLUMNS } from "./activity.mjs";
import { ValidationError } from "./users.mjs";

// section for the limits
export const TITLE_MAX = 120;
export const BODY_MAX = 8000;
const PAGE = 25;

const READ_COLUMNS = `a.announcement_id, a.title, a.body, a.created_at,
                      actor.name AS actor_name`;

export async function listAnnouncements(limit = PAGE) {
    const size = Math.floor(Math.min(Math.max(Number(limit) || PAGE, 1), 100));

    const { rows } = await query(
        `SELECT ${READ_COLUMNS}
           FROM announcements a
           LEFT JOIN users actor ON actor.user_id = a.actor_id
          ORDER BY a.announcement_id DESC
          LIMIT ${size}`
    );
    return rows;
}

export function normaliseTitle(value) {
    const title = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
    if (!title) throw new ValidationError("An announcement needs a title.");
    if (title.length > TITLE_MAX) {
        throw new ValidationError(`The title must be ${TITLE_MAX} characters or fewer.`);
    }
    return title;
}

export function normaliseBody(value) {
    const body = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
    if (!body) throw new ValidationError("An announcement needs a body.");
    if (body.length > BODY_MAX) {
        throw new ValidationError(`The body must be ${BODY_MAX} characters or fewer.`);
    }
    return body;
}

export async function createAnnouncement(title, body, actorId, client = null) {
    const run = client ? client.query.bind(client) : query;

    const { rows } = await run(
        `WITH posted AS (
             INSERT INTO announcements (title, body, actor_id)
             VALUES ($1::text, $2::text, $3::int)
             RETURNING announcement_id, title, created_at
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'announcement.posted', $3::int, NULL, NULL, NULL, NULL, NULL, title
               FROM posted
         )
         SELECT announcement_id, title, created_at FROM posted`,
        [normaliseTitle(title), normaliseBody(body), actorId]
    );
    return rows[0] ?? null;
}

export async function deleteAnnouncement(announcementId, actorId, client = null) {
    const run = client ? client.query.bind(client) : query;

    const { rows } = await run(
        `WITH removed AS (
             DELETE FROM announcements WHERE announcement_id = $1::int
             RETURNING announcement_id, title
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'announcement.pulled', $2::int, NULL, NULL, NULL, NULL, NULL, title
               FROM removed
         )
         SELECT announcement_id FROM removed`,
        [announcementId, actorId]
    );
    return rows[0] ?? null;
}

// section for the shape the browser receives
export function presentAnnouncements(rows) {
    return rows.map(row => ({
        id: row.announcement_id,
        title: row.title,
        body: row.body,
        author: row.actor_name || "ZONEOUT",
        createdAt: row.created_at
    }));
}
