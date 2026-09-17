-- one hackatime account per zoneout account

-- release every duplicate but the earliest link
UPDATE users u
SET hackatime_user_id   = NULL,
    hackatime_token     = NULL,
    hackatime_linked_at = NULL,
    hackatime_synced_at = NULL,
    updated_at          = now()
WHERE u.hackatime_user_id IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM users k
      WHERE k.hackatime_user_id = u.hackatime_user_id
        AND k.user_id <> u.user_id
        AND (k.hackatime_linked_at, k.user_id) < (u.hackatime_linked_at, u.user_id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS users_hackatime_user_id_key
    ON users(hackatime_user_id)
    WHERE hackatime_user_id IS NOT NULL;
