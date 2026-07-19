-- 062: durable lifecycle records for cancellable workbench copilot requests.
CREATE TABLE IF NOT EXISTS ai_workbench_copilot_runs (
  id BIGINT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  scope VARCHAR(20) NOT NULL,
  target_id VARCHAR(80) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workbench_copilot_runs_owner_status
  ON ai_workbench_copilot_runs (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workbench_copilot_runs_session_created
  ON ai_workbench_copilot_runs (session_id, created_at DESC);
