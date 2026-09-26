import { query } from "./db.mjs";
import { LOG_COLUMNS } from "./activity.mjs";
import { ValidationError } from "./users.mjs";
import { MAIL_AUTHOR } from "./mailbox.mjs";

// section for the limits
export const TITLE_MAX = 120;
export const BODY_MAX = 8000;
export const AUTHOR_MAX = 60;
const PAGE = 25;

const READ_COLUMNS = `a.announcement_id, a.title, a.body, a.created_at, a.author_name, a.user_id,
                      actor.name AS actor_name`;

const FROM_CLAUSE = `FROM announcements a
                     LEFT JOIN users actor ON actor.user_id = a.actor_id`;

// section for the two lists a reader gets: every broadcast, plus their own mail
export async function listAnnouncements(limit = PAGE, userId = null) {
    const size = Math.floor(Math.min(Math.max(Number(limit) || PAGE, 1), 100));
    const reader = Number(userId);

    if (!Number.isSafeInteger(reader) || reader < 1) {
        const { rows } = await query(
            `SELECT ${READ_COLUMNS} ${FROM_CLAUSE}
              WHERE a.user_id IS NULL
              ORDER BY a.announcement_id DESC
              LIMIT ${size}`
        );
        return rows;
    }

    const { rows } = await query(
        `SELECT * FROM (
             (SELECT ${READ_COLUMNS} ${FROM_CLAUSE}
               WHERE a.user_id IS NULL
               ORDER BY a.announcement_id DESC
               LIMIT ${size})
             UNION ALL
             (SELECT ${READ_COLUMNS} ${FROM_CLAUSE}
               WHERE a.user_id = $1::int
               ORDER BY a.announcement_id DESC
               LIMIT ${size})
         ) mail
          ORDER BY announcement_id DESC`,
        [reader]
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

export function normaliseAuthor(value) {
    const author = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
    if (!author) return null;
    if (author.length > AUTHOR_MAX) {
        throw new ValidationError(`The author name must be ${AUTHOR_MAX} characters or fewer.`);
    }
    return author;
}

export async function createAnnouncement(title, body, actorId, client = null, authorName = null) {
    const run = client ? client.query.bind(client) : query;

    const { rows } = await run(
        `WITH posted AS (
             INSERT INTO announcements (title, body, actor_id, author_name)
             VALUES ($1::text, $2::text, $3::int, $4::text)
             RETURNING announcement_id, title, created_at
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'announcement.posted', $3::int, NULL, NULL, NULL, NULL, NULL, title
               FROM posted
         )
         SELECT announcement_id, title, created_at FROM posted`,
        [normaliseTitle(title), normaliseBody(body), actorId, normaliseAuthor(authorName)]
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
        author: row.author_name || row.actor_name || MAIL_AUTHOR,
        personal: row.user_id !== null && row.user_id !== undefined,
        createdAt: row.created_at
    }));
}
