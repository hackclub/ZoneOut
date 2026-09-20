-- the audit trail behind the admin LOGS panel

CREATE TABLE IF NOT EXISTS activity_log (
    event_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind         text        NOT NULL,
    actor_id     integer,
    subject_id   integer,
    subject_name text,
    project_id   integer,
    order_id     integer,
    hours        numeric,
    detail       text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_at_idx      ON activity_log (created_at DESC, event_id DESC);
CREATE INDEX IF NOT EXISTS activity_log_kind_idx    ON activity_log (kind);
CREATE INDEX IF NOT EXISTS activity_log_subject_idx ON activity_log (subject_id);
CREATE INDEX IF NOT EXISTS activity_log_project_idx ON activity_log (project_id);

-- section for the backfill, so the panel is not empty on the day it ships

INSERT INTO activity_log (kind, actor_id, subject_id, subject_name, project_id, hours, detail, created_at)
SELECT CASE WHEN r.status = 'approved' THEN 'project.approved'
            WHEN r.status = 'rejected' THEN 'project.rejected'
            WHEN r.actor_id IS DISTINCT FROM p.user_id THEN 'project.queued'
            ELSE 'project.submitted' END,
       r.actor_id, p.user_id, p.owner_name, p.project_id,
       CASE WHEN r.status = 'approved' THEN r.payout_hours ELSE r.hours END,
       r.remarks, r.created_at
  FROM project_reviews r
  JOIN projects p ON p.project_id = r.project_id
 WHERE NOT EXISTS (SELECT 1 FROM activity_log)
 ORDER BY r.created_at, r.review_id;

INSERT INTO activity_log (kind, subject_id, subject_name, order_id, hours, detail, created_at)
SELECT 'order.placed', o.user_id, o.user_name, o.order_id, o.hours_spent,
       o.item_name || ' x' || o.quantity, o.created_at
  FROM shop_orders o
 WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE kind LIKE 'order.%')
 ORDER BY o.order_id;

INSERT INTO activity_log (kind, actor_id, subject_id, subject_name, order_id, hours, detail, created_at)
SELECT CASE WHEN o.order_status = 'approved' THEN 'order.approved' ELSE 'order.rejected' END,
       o.reviewed_by, o.user_id, o.user_name, o.order_id, o.hours_spent,
       o.item_name || ' x' || o.quantity, o.reviewed_at
  FROM shop_orders o
 WHERE o.reviewed_at IS NOT NULL
   AND o.order_status IN ('approved', 'rejected')
   AND NOT EXISTS (SELECT 1 FROM activity_log WHERE kind IN ('order.approved', 'order.rejected'))
 ORDER BY o.order_id;
