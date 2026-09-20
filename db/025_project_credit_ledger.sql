-- what each project has already paid into its owner's balance

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS credited_hours numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
    ALTER TABLE projects
        ADD CONSTRAINT projects_credited_hours_check
        CHECK (credited_hours >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

UPDATE projects
   SET credited_hours = approved_hours
 WHERE review_status = 'approved' AND credited_hours = 0 AND approved_hours > 0;
