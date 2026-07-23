-- 072: preserve loop-body provenance in immutable workflow execution traces.
ALTER TABLE workflow_run_events
  ADD COLUMN IF NOT EXISTS loop_iteration INTEGER NULL,
  ADD COLUMN IF NOT EXISTS loop_depth INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS body_node_id VARCHAR(120) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_workflow_run_events_body_node_id
  ON workflow_run_events (body_node_id);
