-- shop order verdicts

ALTER TABLE shop_orders
    ADD COLUMN IF NOT EXISTS order_status text        NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz,
    ADD COLUMN IF NOT EXISTS reviewed_by  integer REFERENCES users(user_id) ON DELETE SET NULL;

DO $$
BEGIN
    ALTER TABLE shop_orders
        ADD CONSTRAINT shop_orders_status_check
        CHECK (order_status IN ('pending', 'approved', 'rejected'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- the admin panel reads by state
CREATE INDEX IF NOT EXISTS shop_orders_status_idx
    ON shop_orders(order_status, order_id DESC);
