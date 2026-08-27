-- hackatime link

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hackatime_user_id   integer,
    ADD COLUMN IF NOT EXISTS hackatime_token     text,
    ADD COLUMN IF NOT EXISTS hackatime_linked_at timestamptz,
    ADD COLUMN IF NOT EXISTS hackatime_synced_at timestamptz;

-- hackatime hours on projects

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS hackatime_project   text,
    ADD COLUMN IF NOT EXISTS hackatime_hours     numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS hackatime_synced_at timestamptz;

DO $$
BEGIN
    ALTER TABLE projects
        ADD CONSTRAINT projects_hackatime_hours_check CHECK (hackatime_hours >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- index
CREATE INDEX IF NOT EXISTS projects_hackatime_project_idx
    ON projects(user_id, hackatime_project);
