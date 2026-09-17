import { query } from "./db.mjs";
import { ValidationError } from "./users.mjs";
import { EVENT_HOUR_GOAL } from "../catalog.js";

const STATE_COLUMNS = `state_id,
                       hour_goal::float8           AS hour_goal,
                       hours_override::float8      AS hours_override,
                       corruption_override::float8 AS corruption_override,
                       starts_at,
                       ends_at,
                       updated_at`;

const BOARD_LIMIT = 100;
export const MAX_EVENT_HOURS = 99999;

// hours actually credited: tracked time plus the admin's signed adjustment, never below zero
const EFFECTIVE_HOURS = "GREATEST(event_hours + hours_adjust, 0)";

// state
export async function readEventState() {
    const { rows } = await query(`SELECT ${STATE_COLUMNS} FROM event_state WHERE state_id = 1`);
    return rows[0] ?? null;
}

export async function writeEventState(patch) {
    const { rows } = await query(
        `UPDATE event_state
            SET hour_goal           = COALESCE($1::numeric, hour_goal),
                hours_override      = CASE WHEN $2::boolean THEN $3::numeric ELSE hours_override END,
                corruption_override = CASE WHEN $4::boolean THEN $5::numeric ELSE corruption_override END,
                starts_at           = COALESCE($6::timestamptz, starts_at),
                ends_at             = COALESCE($7::timestamptz, ends_at),
                updated_at          = now()
          WHERE state_id = 1
      RETURNING ${STATE_COLUMNS}`,
        [
            patch.hourGoal ?? null,
            patch.setHoursOverride === true,
            patch.hoursOverride ?? null,
            patch.setCorruptionOverride === true,
            patch.corruptionOverride ?? null,
            patch.startsAt ?? null,
            patch.endsAt ?? null
        ]
    );

    if (!rows[0]) throw new ValidationError("The event state could not be updated.");
    return rows[0];
}

// participation
export async function joinEvent(userId) {
    const { rows } = await query(
        `INSERT INTO event_participants (user_id)
         SELECT u.user_id FROM users u WHERE u.user_id = $1 AND u.is_banned = false
         ON CONFLICT (user_id) DO NOTHING
         RETURNING user_id`,
        [userId]
    );
    return rows.length > 0;
}

export async function isParticipant(userId) {
    const { rows } = await query(
        `SELECT 1 FROM event_participants WHERE user_id = $1`,
        [userId]
    );
    return rows.length > 0;
}

export async function eventTotals() {
    const { rows } = await query(
        `SELECT COALESCE(SUM(${EFFECTIVE_HOURS}), 0)::float8 AS hours,
                COUNT(*)::int                                AS participants
         FROM event_participants
         WHERE hidden = false`
    );
    return rows[0] ?? { hours: 0, participants: 0 };
}

// leaderboard
export async function leaderboard() {
    const { rows } = await query(
        `SELECT p.user_id,
                u.name,
                GREATEST(p.event_hours + p.hours_adjust, 0)::float8 AS hours,
                p.event_hours::float8                               AS tracked_hours,
                p.hours_adjust::float8                              AS adjust,
                u.tickets,
                p.joined_at
         FROM event_participants p
         JOIN users u ON u.user_id = p.user_id
         WHERE p.hidden = false
         ORDER BY hours DESC, p.joined_at ASC
         LIMIT ${BOARD_LIMIT}`
    );
    return rows;
}

export async function setParticipantAdjust(userId, adjust, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `UPDATE event_participants
            SET hours_adjust = $2::numeric
          WHERE user_id = $1
      RETURNING user_id, ${EFFECTIVE_HOURS}::float8 AS hours`,
        [userId, adjust]
    );
    if (!rows[0]) throw new ValidationError(`No event participant with user id ${userId}.`);
    return rows[0];
}

export async function removeParticipant(userId, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `DELETE FROM event_participants WHERE user_id = $1 RETURNING user_id`,
        [userId]
    );
    if (!rows[0]) throw new ValidationError(`No event participant with user id ${userId}.`);
    return rows[0];
}

export async function addParticipantByEmail(email) {
    const { rows } = await query(
        `INSERT INTO event_participants (user_id)
         SELECT u.user_id FROM users u WHERE lower(u.email) = lower($1) AND u.is_banned = false
         ON CONFLICT (user_id) DO NOTHING
         RETURNING user_id`,
        [email]
    );
    if (!rows[0]) throw new ValidationError("No such account, or it is already on the board.");
    return rows[0];
}

// hackatime sync
export async function writeEventHours(userId, hours) {
    await query(
        `UPDATE event_participants
            SET event_hours = $2::numeric,
                synced_at   = now()
          WHERE user_id = $1`,
        [userId, hours]
    );
}

// the derived figures
export function derive(state, totals) {
    const goal = Number(state?.hour_goal) > 0 ? Number(state.hour_goal) : EVENT_HOUR_GOAL;

    const live = Number(totals?.hours) || 0;
    const hours = state?.hours_override === null || state?.hours_override === undefined
        ? live
        : Number(state.hours_override);

    const startsAt = state?.starts_at ? new Date(state.starts_at).getTime() : Date.now();
    const endsAt = state?.ends_at ? new Date(state.ends_at).getTime() : Date.now();
    const span = endsAt - startsAt;
    const elapsed = span > 0 ? (Date.now() - startsAt) / span : 1;

    const corruption = state?.corruption_override === null || state?.corruption_override === undefined
        ? clamp(elapsed * 100)
        : clamp(Number(state.corruption_override));

    return {
        hours: round(hours),
        liveHours: round(live),
        goal: round(goal),
        hoursPercent: round(clamp((hours / goal) * 100)),
        corruptionPercent: round(corruption),
        phase: hours >= goal ? 2 : hours >= goal / 2 ? 1 : 0,
        startsAt: state?.starts_at ?? null,
        endsAt: state?.ends_at ?? null,
        participants: Number(totals?.participants) || 0,
        hoursAuto: state?.hours_override === null || state?.hours_override === undefined,
        corruptionAuto: state?.corruption_override === null || state?.corruption_override === undefined
    };
}

function clamp(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), 100);
}

function round(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
}
