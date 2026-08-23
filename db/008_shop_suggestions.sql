-- shop suggestions

CREATE TABLE IF NOT EXISTS shop_suggestions (
    suggestion_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_name     text,
    item_name     text NOT NULL,
    reason        text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- index
CREATE INDEX IF NOT EXISTS shop_suggestions_user_id_idx ON shop_suggestions(user_id);
