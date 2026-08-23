-- project fields

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS name        text,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS repo_url    text,
    ADD COLUMN IF NOT EXISTS demo_url    text,
    ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- backfill, then constrain
UPDATE projects SET name        = 'Untitled project' WHERE name IS NULL;
UPDATE projects SET description = ''                 WHERE description IS NULL;

ALTER TABLE projects
    ALTER COLUMN name        SET NOT NULL,
    ALTER COLUMN description SET NOT NULL;

-- index
CREATE INDEX IF NOT EXISTS projects_user_created_idx ON projects(user_id, created_at DESC);
