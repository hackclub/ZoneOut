-- core tables

CREATE TABLE IF NOT EXISTS users (
    user_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text NOT NULL UNIQUE,
    slack_id    text UNIQUE,
    name        text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- projects
CREATE TABLE IF NOT EXISTS projects (
    project_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- index
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
