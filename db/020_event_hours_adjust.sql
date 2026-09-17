-- the board adjustment became additive, not a replacement

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'event_participants'
          AND column_name = 'hours_override'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'event_participants'
          AND column_name = 'hours_adjust'
    ) THEN
        ALTER TABLE event_participants ADD COLUMN hours_adjust numeric;

        UPDATE event_participants
           SET hours_adjust = COALESCE(hours_override - event_hours, 0);

        ALTER TABLE event_participants ALTER COLUMN hours_adjust SET DEFAULT 0;
        ALTER TABLE event_participants ALTER COLUMN hours_adjust SET NOT NULL;
        ALTER TABLE event_participants DROP COLUMN hours_override;
    END IF;
END $$;

ALTER TABLE event_participants
    ADD COLUMN IF NOT EXISTS hours_adjust numeric NOT NULL DEFAULT 0;

-- the board index follows the summed expression
DROP INDEX IF EXISTS event_participants_board_idx;

CREATE INDEX IF NOT EXISTS event_participants_board_idx
    ON event_participants(hidden, (GREATEST(event_hours + hours_adjust, 0)) DESC);
