import { query } from "./db.mjs";
import { ValidationError } from "./users.mjs";
import { LOG_COLUMNS } from "./activity.mjs";
import { EVENT_HOUR_GOAL } from "../catalog.js";

const STATE_COLUMNS = `state_id,
                       hour_goal::float8           AS hour_goal,
                       hours_override::float8      AS hours_override,
                       corruption_override::float8 AS corruption_override,
                       hours_ceiling::float8       AS hours_ceiling,
                       corruption_fx_enabled,
                       corruption_fx_intensity::float8 AS corruption_fx_intensity,
                       corruption_fx_beat_seconds,
                       corruption_fx_level_scale::float8 AS corruption_fx_level_scale,
                       starts_at,
                       ends_at,
                       updated_at`;

const BOARD_LIMIT = 100;
export const MAX_EVENT_HOURS = 99999;

// the corruption tuning bounds, matched by db/022's own checks
export const MAX_FX_INTENSITY = 5;
export const MIN_FX_BEAT = 5;
export const MAX_FX_BEAT = 3600;
export const MIN_FX_SCALE = 0.05;
export const MAX_FX_SCALE = 20;

// hours actually credited: tracked time, the admin's signed adjustment, less the deflation ledger
const EFFECTIVE_HOURS = "GREATEST(event_hours + hours_adjust - deflation_adjust, 0)";

// state
export async function readEventState() {
    const { rows } = await query(`SELECT ${STATE_COLUMNS} FROM event_state WHERE state_id = 1`);
    return rows[0] ?? null;
}

export async function writeEventState(patch, client = null, actorId = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `WITH tuned AS (
         UPDATE event_state
            SET hour_goal           = COALESCE($1::numeric, hour_goal),
                hours_override      = CASE WHEN $2::boolean THEN $3::numeric ELSE hours_override END,
                corruption_override = CASE WHEN $4::boolean THEN $5::numeric ELSE corruption_override END,
                hours_ceiling       = CASE WHEN $14::boolean THEN $15::numeric ELSE hours_ceiling END,
                corruption_fx_enabled   = COALESCE($8::boolean, corruption_fx_enabled),
                corruption_fx_intensity = COALESCE($9::numeric, corruption_fx_intensity),
                corruption_fx_beat_seconds = COALESCE($10::int, corruption_fx_beat_seconds),
                corruption_fx_level_scale  = COALESCE($11::numeric, corruption_fx_level_scale),
                starts_at           = COALESCE($6::timestamptz, starts_at),
                ends_at             = COALESCE($7::timestamptz, ends_at),
                updated_at          = now()
          WHERE state_id = 1
      RETURNING ${STATE_COLUMNS}
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'event.tuned', $12::int, NULL, NULL, NULL, NULL, NULL, $13::text
               FROM tuned
         )
         SELECT * FROM tuned`,
        [
            patch.hourGoal ?? null,
            patch.setHoursOverride === true,
            patch.hoursOverride ?? null,
            patch.setCorruptionOverride === true,
            patch.corruptionOverride ?? null,
            patch.startsAt ?? null,
            patch.endsAt ?? null,
            patch.fxEnabled ?? null,
            patch.fxIntensity ?? null,
            patch.fxBeatSeconds ?? null,
            patch.fxLevelScale ?? null,
            actorId,
            describePatch(patch),
            patch.setHoursCeiling === true,
            patch.hoursCeiling ?? null
        ]
    );

    if (!rows[0]) throw new ValidationError("The event state could not be updated.");
    return rows[0];
}

// what changed, in words, for the log row
function describePatch(patch) {
    const parts = [];
    if (patch.hourGoal !== undefined) parts.push("goal " + patch.hourGoal);
    if (patch.setHoursOverride === true) {
        parts.push("hour meter " + (patch.hoursOverride === null ? "auto" : patch.hoursOverride));
    }
    if (patch.setHoursCeiling === true) {
        parts.push("ceiling " + (patch.hoursCeiling === null ? "off" : patch.hoursCeiling));
    }
    if (patch.setCorruptionOverride === true) {
        parts.push("corruption meter " + (patch.corruptionOverride === null ? "auto" : patch.corruptionOverride));
    }
    if (patch.fxEnabled !== undefined) parts.push("fx " + (patch.fxEnabled ? "on" : "off"));
    if (patch.fxIntensity !== undefined) parts.push("probability " + patch.fxIntensity);
    if (patch.fxBeatSeconds !== undefined) parts.push("beat " + patch.fxBeatSeconds + "s");
    if (patch.fxLevelScale !== undefined) parts.push("ramp " + patch.fxLevelScale);
    if (patch.startsAt) parts.push("start " + patch.startsAt);
    if (patch.endsAt) parts.push("end " + patch.endsAt);
    return parts.join(", ") || "no change";
}

// the goal and the ceiling, validated the same way for /api/event/state and the admin batch
export function readMeterSettings(body) {
    const patch = {};
    const given = key => Object.prototype.hasOwnProperty.call(body ?? {}, key);

    if (given("hourGoal")) {
        patch.hourGoal = fxNumber(body.hourGoal, "The hour goal", 0.01, MAX_EVENT_HOURS);
    }

    if (given("hoursCeiling")) {
        patch.setHoursCeiling = true;
        const raw = body.hoursCeiling;
        patch.hoursCeiling = raw === null || raw === "" || raw === undefined
            ? null
            : fxNumber(raw, "The hour ceiling", 0, MAX_EVENT_HOURS);
    }

    return patch;
}

// the corruption knobs, validated the same way for /api/event/state and the admin batch
export function readFxSettings(body) {
    const patch = {};
    const given = key => Object.prototype.hasOwnProperty.call(body ?? {}, key);

    if (given("fxEnabled")) {
        const value = body.fxEnabled;
        if (value === true || value === "true") patch.fxEnabled = true;
        else if (value === false || value === "false") patch.fxEnabled = false;
        else throw new ValidationError("Corruption FX must be on or off.");
    }

    if (given("fxIntensity")) {
        patch.fxIntensity = fxNumber(body.fxIntensity, "The FX intensity", 0, MAX_FX_INTENSITY);
    }

    if (given("fxBeatSeconds")) {
        patch.fxBeatSeconds = Math.round(
            fxNumber(body.fxBeatSeconds, "The FX beat", MIN_FX_BEAT, MAX_FX_BEAT)
        );
    }

    if (given("fxLevelScale")) {
        patch.fxLevelScale = fxNumber(body.fxLevelScale, "The FX ramp", MIN_FX_SCALE, MAX_FX_SCALE);
    }

    return patch;
}

function fxNumber(value, label, min, max) {
    const number = typeof value === "string" ? Number(value.trim()) : Number(value);
    if (!Number.isFinite(number)) throw new ValidationError(`${label} must be a number.`);
    if (number < min || number > max) {
        throw new ValidationError(`${label} must be between ${min} and ${max}.`);
    }
    return Math.round(number * 100) / 100;
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
                ${EFFECTIVE_HOURS}::float8                          AS hours,
                p.event_hours::float8                               AS tracked_hours,
                p.hours_adjust::float8                              AS adjust,
                p.deflation_adjust::float8                          AS deflation,
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

export async function setParticipantAdjust(userId, adjust, actorId = null, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `WITH moved AS (
             UPDATE event_participants p
                SET hours_adjust = $2::numeric
              WHERE p.user_id = $1
          RETURNING p.user_id, ${EFFECTIVE_HOURS}::float8 AS hours, p.hours_adjust
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'event.adjusted', $3::int, m.user_id, u.name, NULL, NULL,
                    m.hours_adjust, 'board total ' || m.hours
               FROM moved m JOIN users u ON u.user_id = m.user_id
         )
         SELECT user_id, hours FROM moved`,
        [userId, adjust, actorId]
    );
    if (!rows[0]) throw new ValidationError(`No event participant with user id ${userId}.`);
    return rows[0];
}

export async function removeParticipant(userId, actorId = null, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `WITH gone AS (
             DELETE FROM event_participants p WHERE p.user_id = $1
          RETURNING p.user_id, ${EFFECTIVE_HOURS}::float8 AS hours
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'event.removed', $2::int, g.user_id, u.name, NULL, NULL,
                    g.hours, 'taken off the board'
               FROM gone g JOIN users u ON u.user_id = g.user_id
         )
         SELECT user_id FROM gone`,
        [userId, actorId]
    );
    if (!rows[0]) throw new ValidationError(`No event participant with user id ${userId}.`);
    return rows[0];
}

export async function addParticipantByEmail(email, actorId = null) {
    const { rows } = await query(
        `WITH joined AS (
             INSERT INTO event_participants (user_id)
             SELECT u.user_id FROM users u
              WHERE lower(u.email) = lower($1) AND u.is_banned = false
             ON CONFLICT (user_id) DO NOTHING
          RETURNING user_id
         ), audited AS (
             INSERT INTO activity_log (${LOG_COLUMNS})
             SELECT 'event.added', $2::int, j.user_id, u.name, NULL, NULL,
                    NULL, 'put on the board by email'
               FROM joined j JOIN users u ON u.user_id = j.user_id
         )
         SELECT user_id FROM joined`,
        [email, actorId]
    );
    if (!rows[0]) throw new ValidationError("No such account, or it is already on the board.");
    return rows[0];
}

// every project whose time reaches the board, under its owner
export async function boardProjects() {
    const { rows } = await query(
        `SELECT u.user_id,
                u.name                                  AS owner_name,
                u.slack_id,
                COALESCE(p.event_hours, 0)::float8       AS board_tracked,
                COALESCE(p.hours_adjust, 0)::float8      AS board_adjust,
                COALESCE(p.deflation_adjust, 0)::float8  AS board_deflation,
                CASE WHEN p.user_id IS NULL THEN NULL
                     ELSE GREATEST(p.event_hours + p.hours_adjust - p.deflation_adjust, 0)::float8
                END                                      AS board_hours,
                pr.project_id,
                pr.name                                  AS project_name,
                pr.hackatime_project,
                pr.event_hours::float8                    AS event_hours,
                pr.event_deducted::float8                 AS event_deducted
         FROM projects pr
         JOIN users u ON u.user_id = pr.user_id
         LEFT JOIN event_participants p ON p.user_id = pr.user_id
         WHERE pr.event_hours > 0 OR pr.event_deducted > 0
         ORDER BY board_hours DESC NULLS LAST, u.user_id, pr.project_id
         LIMIT 1000`
    );
    return rows;
}

// hackatime sync
export async function writeEventHours(userId, hours, perProject = []) {
    const ids = perProject.map(row => row.projectId);
    const each = perProject.map(row => row.hours);

    await query(
        `WITH incoming AS (
             SELECT unnest($3::int[]) AS project_id, unnest($4::numeric[]) AS hours
         ), settled AS (
             UPDATE projects p
                SET event_hours = COALESCE(
                        (SELECT i.hours FROM incoming i WHERE i.project_id = p.project_id), 0)
              WHERE p.user_id = $1 AND p.hackatime_project IS NOT NULL
          RETURNING p.project_id
         ), stamped AS (
             UPDATE event_participants
                SET event_hours = $2::numeric,
                    synced_at   = now()
              WHERE user_id = $1
          RETURNING user_id
         )
         SELECT (SELECT count(*) FROM settled)::int AS projects`,
        [userId, hours, ids, each]
    );
}

// the derived figures
export function derive(state, totals) {
    const goal = Number(state?.hour_goal) > 0 ? Number(state.hour_goal) : EVENT_HOUR_GOAL;

    const live = Number(totals?.hours) || 0;
    const ceiling = state?.hours_ceiling === null || state?.hours_ceiling === undefined
        ? null
        : Number(state.hours_ceiling);
    const capped = ceiling === null ? live : Math.min(live, ceiling);

    const hours = state?.hours_override === null || state?.hours_override === undefined
        ? capped
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
        hoursCapped: round(capped),
        goal: round(goal),
        hoursPercent: round(clamp((hours / goal) * 100)),
        corruptionPercent: round(corruption),
        phase: hours >= goal ? 2 : hours >= goal / 2 ? 1 : 0,
        startsAt: state?.starts_at ?? null,
        endsAt: state?.ends_at ?? null,
        participants: Number(totals?.participants) || 0,
        hoursAuto: state?.hours_override === null || state?.hours_override === undefined,
        hoursCeiling: ceiling === null ? null : round(ceiling),
        hoursFrozen: ceiling !== null,
        corruptionAuto: state?.corruption_override === null || state?.corruption_override === undefined,
        fxEnabled: state?.corruption_fx_enabled === true,
        fxIntensity: bounded(state?.corruption_fx_intensity, 0, MAX_FX_INTENSITY, 0),
        fxBeatSeconds: bounded(state?.corruption_fx_beat_seconds, MIN_FX_BEAT, MAX_FX_BEAT, 45),
        fxLevelScale: bounded(state?.corruption_fx_level_scale, MIN_FX_SCALE, MAX_FX_SCALE, 1)
    };
}

function bounded(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(number, min), max);
}

function clamp(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), 100);
}

function round(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
}
