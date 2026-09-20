-- one approval per submission round

ALTER TABLE projects
    DROP COLUMN IF EXISTS round_approved_hours,
    DROP COLUMN IF EXISTS round_paid_hours;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS round_settled boolean NOT NULL DEFAULT false;

UPDATE projects
   SET round_settled = true
 WHERE review_status = 'approved';
