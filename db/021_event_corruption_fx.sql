-- periodic corruption tuning, off until an admin turns it on

ALTER TABLE event_state
    ADD COLUMN IF NOT EXISTS corruption_fx_enabled   boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS corruption_fx_intensity numeric NOT NULL DEFAULT 0.5;

DO $$
BEGIN
    ALTER TABLE event_state
        ADD CONSTRAINT event_state_fx_intensity_check
        CHECK (corruption_fx_intensity >= 0 AND corruption_fx_intensity <= 1);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
