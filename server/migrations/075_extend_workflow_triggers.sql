-- 075: durable Webhook and owner-scoped event trigger inputs.
-- Webhook secrets are never stored in plaintext.

ALTER TABLE workflow_triggers
  ADD COLUMN IF NOT EXISTS event_key VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE workflow_triggers
  ADD COLUMN IF NOT EXISTS secret_hash VARCHAR(64) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_owner_event
  ON workflow_triggers (user_id, type, event_key, status);

ALTER TABLE workflow_run_jobs
  ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) NOT NULL DEFAULT 'cron';
ALTER TABLE workflow_run_jobs
  ADD COLUMN IF NOT EXISTS inputs JSON NOT NULL DEFAULT '{}'::json;
ALTER TABLE workflow_run_jobs
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(80) NOT NULL DEFAULT '';

ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS app_id BIGINT;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS version_id BIGINT;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS trigger_id BIGINT;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS run_job_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_workflow_runs_run_job_id
  ON workflow_runs (run_job_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_trigger_id
  ON workflow_runs (trigger_id);

CREATE TABLE IF NOT EXISTS workflow_approvals (
  id BIGINT PRIMARY KEY,
  workflow_run_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  node_id VARCHAR(120) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  note VARCHAR(1000) NOT NULL DEFAULT '',
  decided_at TIMESTAMPTZ NULL,
  resumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uidx_workflow_approval_run_node UNIQUE (workflow_run_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_owner_status
  ON workflow_approvals (user_id, workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_resume
  ON workflow_approvals (status, resumed_at);
