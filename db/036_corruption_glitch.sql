-- the glitch mode multiplier

ALTER TABLE event_state
    ADD COLUMN IF NOT EXISTS corruption_glitch_boost numeric NOT NULL DEFAULT 1;

DO $$
BEGIN
    ALTER TABLE event_state
        ADD CONSTRAINT event_state_glitch_boost_check
        CHECK (corruption_glitch_boost >= 0 AND corruption_glitch_boost <= 5);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
