-- the entity's rage window

UPDATE event_state
SET starts_at  = '2026-09-17T00:00:00Z',
    ends_at    = '2026-09-30T23:59:59Z',
    updated_at = now()
WHERE state_id = 1;
