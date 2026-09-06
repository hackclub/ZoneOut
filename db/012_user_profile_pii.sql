-- identity name parts

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name text,
    ADD COLUMN IF NOT EXISTS last_name  text;

-- submission profile, sealed

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS submit_profile    text,
    ADD COLUMN IF NOT EXISTS submit_profile_id text,
    ADD COLUMN IF NOT EXISTS submit_profile_at timestamptz;
