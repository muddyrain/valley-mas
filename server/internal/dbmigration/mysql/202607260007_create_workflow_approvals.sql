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
  decided_at DATETIME(3) NULL,
  resumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE INDEX uidx_workflow_approval_run_node (workflow_run_id, node_id),
  INDEX idx_workflow_approvals_workflow_run_id (workflow_run_id),
  INDEX idx_workflow_approvals_workflow_id (workflow_id),
  INDEX idx_workflow_approvals_user_id (user_id),
  INDEX idx_workflow_approvals_status (status),
  INDEX idx_workflow_approvals_resumed_at (resumed_at),
  INDEX idx_workflow_approvals_deleted_at (deleted_at)
);

CALL valley_managed_add_index_if_missing(
  'workflow_approvals',
  'uidx_workflow_approval_run_node',
  'UNIQUE INDEX `uidx_workflow_approval_run_node` (`workflow_run_id`, `node_id`)'
);
CALL valley_managed_add_index_if_missing(
  'workflow_approvals',
  'idx_workflow_approvals_workflow_run_id',
  'INDEX `idx_workflow_approvals_workflow_run_id` (`workflow_run_id`)'
);
CALL valley_managed_add_index_if_missing(
  'workflow_approvals',
  'idx_workflow_approvals_workflow_id',
  'INDEX `idx_workflow_approvals_workflow_id` (`workflow_id`)'
);
CALL valley_managed_add_index_if_missing(
  'workflow_approvals',
  'idx_workflow_approvals_user_id',
  'INDEX `idx_workflow_approvals_user_id` (`user_id`)'
);
CALL valley_managed_add_index_if_missing(
  'workflow_approvals',
  'idx_workflow_approvals_status',
  'INDEX `idx_workflow_approvals_status` (`status`)'
);
CALL valley_managed_add_index_if_missing(
  'workflow_approvals',
  'idx_workflow_approvals_resumed_at',
  'INDEX `idx_workflow_approvals_resumed_at` (`resumed_at`)'
);
CALL valley_managed_add_index_if_missing(
  'workflow_approvals',
  'idx_workflow_approvals_deleted_at',
  'INDEX `idx_workflow_approvals_deleted_at` (`deleted_at`)'
);
