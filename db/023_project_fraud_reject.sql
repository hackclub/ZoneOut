ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS fraud_rejected boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS projects_fraud_idx ON projects (fraud_rejected) WHERE fraud_rejected;
