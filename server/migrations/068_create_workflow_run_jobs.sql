CREATE TABLE IF NOT EXISTS workflow_run_jobs (
  id BIGINT PRIMARY KEY, trigger_id BIGINT NOT NULL, workflow_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL, version_id BIGINT NOT NULL, graph_snapshot JSON NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued', idempotency_key VARCHAR(180) NOT NULL UNIQUE,
  scheduled_at TIMESTAMPTZ NOT NULL, lease_until TIMESTAMPTZ NULL, attempt INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_run_jobs_status_scheduled ON workflow_run_jobs (status, scheduled_at);
