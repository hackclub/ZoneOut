-- the snapshot a project has been paid through, and who opened the open round

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS judged_hours numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS round_locked boolean NOT NULL DEFAULT false;

DO $$
BEGIN
    ALTER TABLE projects
        ADD CONSTRAINT projects_judged_hours_check
        CHECK (judged_hours >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE project_reviews
    ADD COLUMN IF NOT EXISTS approved_hours numeric,
    ADD COLUMN IF NOT EXISTS payout_hours numeric;

UPDATE projects
   SET judged_hours = COALESCE(submitted_hours, hackatime_hours, 0)
 WHERE review_status = 'approved' AND judged_hours = 0;

UPDATE project_reviews r
   SET approved_hours = p.approved_hours,
       payout_hours   = p.credited_hours
  FROM projects p
 WHERE r.approved_hours IS NULL
   AND r.status = 'approved'
   AND p.project_id = r.project_id
   AND r.review_id = (SELECT max(review_id) FROM project_reviews m
                       WHERE m.project_id = r.project_id AND m.status = 'approved');
