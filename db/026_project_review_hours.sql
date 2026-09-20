-- the tracked figure at the moment each review row was appended

ALTER TABLE project_reviews
    ADD COLUMN IF NOT EXISTS hours numeric;

UPDATE project_reviews r
   SET hours = p.submitted_hours
  FROM projects p
 WHERE r.hours IS NULL
   AND r.status = 'under_review'
   AND p.project_id = r.project_id
   AND r.review_id = (SELECT max(review_id) FROM project_reviews m
                       WHERE m.project_id = r.project_id AND m.status = 'under_review');
