-- completion grant access

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS cg_access boolean NOT NULL DEFAULT false;
