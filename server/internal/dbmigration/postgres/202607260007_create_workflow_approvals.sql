-- +goose Up
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

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow_run_id
  ON workflow_approvals (workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow_id
  ON workflow_approvals (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_user_id
  ON workflow_approvals (user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status
  ON workflow_approvals (status);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_resumed_at
  ON workflow_approvals (resumed_at);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_deleted_at
  ON workflow_approvals (deleted_at);
