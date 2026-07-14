-- 049: preserve a link from unified app summaries to legacy node-level workflow traces.
ALTER TABLE ai_app_runs ADD COLUMN IF NOT EXISTS workflow_run_id BIGINT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_app_runs_workflow_run_id ON ai_app_runs(workflow_run_id);
