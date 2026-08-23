-- account status

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- status constraint
DO $$
BEGIN
    ALTER TABLE users
        ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'verified'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
