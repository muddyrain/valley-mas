-- 045: persist owner-scoped workflow runs and safe per-node execution records.
-- Existing runs remain readable; nullable columns support a staged backfill.

ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS inputs JSON;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS graph_snapshot JSON;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON workflow_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_user_started ON workflow_runs(workflow_id, user_id, started_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS workflow_node_runs (
  id BIGINT PRIMARY KEY,
  workflow_run_id BIGINT NOT NULL,
  node_id VARCHAR(120) NOT NULL,
  node_type VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL,
  input JSON,
  output JSON,
  error_code VARCHAR(80) DEFAULT '',
  duration_ms BIGINT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uidx_workflow_run_node UNIQUE (workflow_run_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_workflow_run_id ON workflow_node_runs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_status ON workflow_node_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_deleted_at ON workflow_node_runs(deleted_at);
