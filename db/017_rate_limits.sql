-- one counter per bucket per subject

CREATE TABLE IF NOT EXISTS rate_limits (
    bucket       text        NOT NULL,
    subject      text        NOT NULL,
    window_start timestamptz NOT NULL DEFAULT now(),
    hits         integer     NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket, subject)
);

-- the sweep prunes by age
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits(window_start);
