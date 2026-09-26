-- a custom byline, and announcements addressed to one person

ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS author_name text,
    ADD COLUMN IF NOT EXISTS user_id     integer REFERENCES users(user_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS announcements_for_user_idx
    ON announcements (user_id, announcement_id DESC);

CREATE INDEX IF NOT EXISTS announcements_broadcast_idx
    ON announcements (announcement_id DESC) WHERE user_id IS NULL;
