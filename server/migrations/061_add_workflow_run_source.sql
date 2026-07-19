-- 061: link a retried run to the immutable run it was started from.
-- Inputs remain safe summaries; raw inputs and uploaded file contents are never retained.

ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS source_run_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_source_run_id
  ON workflow_runs(source_run_id);
