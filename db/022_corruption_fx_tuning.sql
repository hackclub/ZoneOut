-- corruption tuning knobs, driven from the admin panel

ALTER TABLE event_state
    ADD COLUMN IF NOT EXISTS corruption_fx_beat_seconds integer NOT NULL DEFAULT 45,
    ADD COLUMN IF NOT EXISTS corruption_fx_level_scale  numeric NOT NULL DEFAULT 1;

ALTER TABLE event_state
    DROP CONSTRAINT IF EXISTS event_state_fx_intensity_check;

DO $$
BEGIN
    ALTER TABLE event_state
        ADD CONSTRAINT event_state_fx_intensity_check
        CHECK (corruption_fx_intensity >= 0 AND corruption_fx_intensity <= 5);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE event_state
        ADD CONSTRAINT event_state_fx_beat_check
        CHECK (corruption_fx_beat_seconds >= 5 AND corruption_fx_beat_seconds <= 3600);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE event_state
        ADD CONSTRAINT event_state_fx_level_scale_check
        CHECK (corruption_fx_level_scale > 0 AND corruption_fx_level_scale <= 20);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
