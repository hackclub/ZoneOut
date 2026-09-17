-- refunded rejections

ALTER TABLE shop_orders
    ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
