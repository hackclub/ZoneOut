-- doomsday: submissions closed site-wide, with per-user exemptions

ALTER TABLE event_state
    ADD COLUMN IF NOT EXISTS submissions_closed boolean NOT NULL DEFAULT false;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS doom_exempt boolean NOT NULL DEFAULT false;
