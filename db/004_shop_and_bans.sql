-- hours as currency, and bans

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS balance_hours numeric(7,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_banned     boolean      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ban_reason    text;

-- balance floor
DO $$
BEGIN
    ALTER TABLE users
        ADD CONSTRAINT users_balance_hours_check CHECK (balance_hours >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- orders
CREATE TABLE IF NOT EXISTS shop_orders (
    order_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    item_id     text    NOT NULL,
    item_name   text    NOT NULL,
    quantity    integer NOT NULL CHECK (quantity BETWEEN 1 AND 5),
    hours_spent numeric(7,2) NOT NULL CHECK (hours_spent >= 0),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- index
CREATE INDEX IF NOT EXISTS shop_orders_user_id_idx ON shop_orders(user_id);
