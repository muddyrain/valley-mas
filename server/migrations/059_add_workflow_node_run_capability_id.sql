ALTER TABLE workflow_node_runs
    ADD COLUMN IF NOT EXISTS capability_id VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_capability_id
    ON workflow_node_runs (capability_id);
