-- entity breakout participants

CREATE TABLE IF NOT EXISTS event_participants (
    user_id      integer PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at    timestamptz NOT NULL DEFAULT now(),
    event_hours  numeric NOT NULL DEFAULT 0,
    hours_adjust numeric NOT NULL DEFAULT 0,
    hidden       boolean NOT NULL DEFAULT false,
    synced_at    timestamptz
);

DO $$
BEGIN
    ALTER TABLE event_participants
        ADD CONSTRAINT event_participants_hours_check CHECK (event_hours >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- leaderboard index
CREATE INDEX IF NOT EXISTS event_participants_board_idx
    ON event_participants(hidden, (GREATEST(event_hours + hours_adjust, 0)) DESC);

-- entity breakout state, one row

CREATE TABLE IF NOT EXISTS event_state (
    state_id            smallint PRIMARY KEY DEFAULT 1,
    hour_goal           numeric NOT NULL DEFAULT 280,
    hours_override      numeric,
    corruption_override numeric,
    starts_at           timestamptz NOT NULL,
    ends_at             timestamptz NOT NULL,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    ALTER TABLE event_state ADD CONSTRAINT event_state_one_row CHECK (state_id = 1);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE event_state ADD CONSTRAINT event_state_goal_check CHECK (hour_goal > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE event_state
        ADD CONSTRAINT event_state_hours_check CHECK (hours_override IS NULL OR hours_override >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE event_state
        ADD CONSTRAINT event_state_corruption_check
        CHECK (corruption_override IS NULL OR (corruption_override >= 0 AND corruption_override <= 100));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE event_state ADD CONSTRAINT event_state_window_check CHECK (ends_at > starts_at);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO event_state (state_id, starts_at, ends_at)
VALUES (1, '2026-09-15T00:00:00Z', '2026-09-30T23:59:59Z')
ON CONFLICT (state_id) DO NOTHING;

-- raffle tickets

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tickets integer NOT NULL DEFAULT 0;

DO $$
BEGIN
    ALTER TABLE users ADD CONSTRAINT users_tickets_check CHECK (tickets >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- order quantity cap lives in lib/shop.mjs, not in the schema

ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS shop_orders_quantity_check;

DO $$
BEGIN
    ALTER TABLE shop_orders ADD CONSTRAINT shop_orders_quantity_min CHECK (quantity >= 1);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
