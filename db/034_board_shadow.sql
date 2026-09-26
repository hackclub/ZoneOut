-- leaderboard shadow ban

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS board_shadowed boolean NOT NULL DEFAULT false;
