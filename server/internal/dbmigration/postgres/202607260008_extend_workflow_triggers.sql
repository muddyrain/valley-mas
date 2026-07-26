-- +goose Up
ALTER TABLE workflow_triggers
  ADD COLUMN IF NOT EXISTS event_key VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS secret_hash VARCHAR(64) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_owner_event
  ON workflow_triggers (user_id, type, event_key, status);

ALTER TABLE workflow_run_jobs
  ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) NOT NULL DEFAULT 'cron',
  ADD COLUMN IF NOT EXISTS inputs JSON NOT NULL DEFAULT '{}'::json,
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(80) NOT NULL DEFAULT '';

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS app_id BIGINT,
  ADD COLUMN IF NOT EXISTS version_id BIGINT,
  ADD COLUMN IF NOT EXISTS trigger_id BIGINT,
  ADD COLUMN IF NOT EXISTS run_job_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_workflow_runs_run_job_id
  ON workflow_runs (run_job_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_trigger_id
  ON workflow_runs (trigger_id);
