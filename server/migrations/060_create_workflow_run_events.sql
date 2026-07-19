-- 060: persist immutable, owner-scoped workflow runtime trace events.
-- Existing workflow runs remain readable without backfilling events.

CREATE TABLE IF NOT EXISTS workflow_run_events (
  id BIGINT PRIMARY KEY,
  workflow_run_id BIGINT NOT NULL,
  sequence BIGINT NOT NULL,
  node_id VARCHAR(120) DEFAULT '',
  node_type VARCHAR(80) DEFAULT '',
  capability_id VARCHAR(120) DEFAULT '',
  status VARCHAR(20) NOT NULL,
  message VARCHAR(500) DEFAULT '',
  input JSON,
  output JSON,
  error_code VARCHAR(80) DEFAULT '',
  duration_ms BIGINT NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uidx_workflow_run_event_sequence UNIQUE (workflow_run_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_events_workflow_run_id
  ON workflow_run_events (workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_events_node_id
  ON workflow_run_events (node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_events_capability_id
  ON workflow_run_events (capability_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_events_status
  ON workflow_run_events (status);
CREATE INDEX IF NOT EXISTS idx_workflow_run_events_occurred_at
  ON workflow_run_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_workflow_run_events_deleted_at
  ON workflow_run_events (deleted_at);
