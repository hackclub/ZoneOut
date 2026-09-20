ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS approved_hours numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
    ALTER TABLE projects
        ADD CONSTRAINT projects_approved_hours_check
        CHECK (approved_hours >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
