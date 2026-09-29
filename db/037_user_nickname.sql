-- public nickname

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nickname text;

DO $$
BEGIN
    ALTER TABLE users
        ADD CONSTRAINT users_nickname_length
        CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 2 AND 24);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_key
    ON users (lower(nickname))
    WHERE nickname IS NOT NULL;
