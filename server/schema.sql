CREATE SCHEMA IF NOT EXISTS office_v3;
CREATE TABLE IF NOT EXISTS office_v3.jobs (
  owner text NOT NULL,
  id text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payload text,
  PRIMARY KEY (owner, id)
);
CREATE INDEX IF NOT EXISTS office_jobs_created ON office_v3.jobs(owner, created_at);
CREATE TABLE IF NOT EXISTS office_v3.audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner text NOT NULL,
  job_id text NOT NULL,
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  previous text NOT NULL,
  signature text NOT NULL
);
-- Apply with an administrative migration role; the runtime role needs only
-- SELECT/INSERT/UPDATE on jobs and SELECT/INSERT on audit, plus sequence USAGE.
-- No DELETE/ALTER permission is required by the runtime.
