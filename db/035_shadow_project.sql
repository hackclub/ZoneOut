-- the project a shadow ban was issued over

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS shadow_project_id integer REFERENCES projects(project_id) ON DELETE SET NULL;
