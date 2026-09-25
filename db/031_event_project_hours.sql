-- per-project event hours, the board deflation ledger and the meter ceiling

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS event_hours    numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS event_deducted numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
    ALTER TABLE projects
        ADD CONSTRAINT projects_event_hours_check CHECK (event_hours >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE projects
        ADD CONSTRAINT projects_event_deducted_check CHECK (event_deducted >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE event_participants
    ADD COLUMN IF NOT EXISTS deflation_adjust numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
    ALTER TABLE event_participants
        ADD CONSTRAINT event_participants_deflation_check CHECK (deflation_adjust >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE event_state
    ADD COLUMN IF NOT EXISTS hours_ceiling numeric;

DO $$
BEGIN
    ALTER TABLE event_state
        ADD CONSTRAINT event_state_ceiling_check
        CHECK (hours_ceiling IS NULL OR hours_ceiling >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- the board index follows the summed expression
DROP INDEX IF EXISTS event_participants_board_idx;

CREATE INDEX IF NOT EXISTS event_participants_board_idx
    ON event_participants(hidden,
        (GREATEST(event_hours + hours_adjust - deflation_adjust, 0)) DESC);

-- projects whose event window hours are not yet known
CREATE INDEX IF NOT EXISTS projects_event_hours_idx
    ON projects(user_id) WHERE event_hours > 0 OR event_deducted > 0;
