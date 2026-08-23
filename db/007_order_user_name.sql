-- user name on shop orders

ALTER TABLE shop_orders
    ADD COLUMN IF NOT EXISTS user_name text;

-- backfill
UPDATE shop_orders o
SET user_name = u.name
FROM users u
WHERE u.user_id = o.user_id
  AND o.user_name IS DISTINCT FROM u.name;
