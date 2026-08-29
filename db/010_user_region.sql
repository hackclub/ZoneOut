-- declared region

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS region text;

-- region snapshot

ALTER TABLE shop_orders
    ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE shop_suggestions
    ADD COLUMN IF NOT EXISTS region text;
