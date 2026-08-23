-- owner name on projects

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS owner_name text;

-- backfill
UPDATE projects p
SET owner_name = u.name
FROM users u
WHERE u.user_id = p.user_id
  AND p.owner_name IS DISTINCT FROM u.name;
