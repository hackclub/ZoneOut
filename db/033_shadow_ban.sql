-- shadow ban

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS shadow_banned boolean NOT NULL DEFAULT false;
