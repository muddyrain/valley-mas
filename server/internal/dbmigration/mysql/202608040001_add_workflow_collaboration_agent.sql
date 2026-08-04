-- +goose Up
CALL valley_managed_add_column_if_missing(
  'workflows', 'revision', 'BIGINT NOT NULL DEFAULT 1'
);
CALL valley_managed_add_column_if_missing(
  'ai_workbench_copilot_sessions', 'canonical', 'BOOLEAN NOT NULL DEFAULT FALSE'
);
CALL valley_managed_add_column_if_missing(
  'ai_workbench_copilot_sessions', 'archived_at', 'DATETIME(3) NULL'
);
CALL valley_managed_add_column_if_missing(
  'ai_workbench_copilot_sessions', 'context_reset_at', 'DATETIME(3) NULL'
);

CREATE TABLE IF NOT EXISTS workflow_collaboration_tasks (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  user_message_id BIGINT NOT NULL,
  change_id BIGINT NULL,
  title VARCHAR(160) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  payload LONGTEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  status_message VARCHAR(500) NOT NULL DEFAULT '',
  partial_output LONGTEXT NOT NULL,
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  base_revision BIGINT NOT NULL,
  base_hash VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  cancel_requested_at DATETIME(3) NULL,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uidx_workflow_collaboration_tasks_idempotency_key (idempotency_key),
  INDEX idx_workflow_collaboration_tasks_user_id (user_id),
  INDEX idx_workflow_collaboration_tasks_workflow_id (workflow_id),
  INDEX idx_workflow_collaboration_tasks_session_id (session_id),
  INDEX idx_workflow_collaboration_tasks_status (status)
);

CREATE TABLE IF NOT EXISTS workflow_collaboration_attachments (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  message_id BIGINT NULL,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL,
  parsed_text LONGTEXT NOT NULL,
  source_content LONGBLOB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ready',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_workflow_collaboration_attachments_user_id (user_id),
  INDEX idx_workflow_collaboration_attachments_workflow_id (workflow_id),
  INDEX idx_workflow_collaboration_attachments_session_id (session_id),
  INDEX idx_workflow_collaboration_attachments_message_id (message_id)
);

CREATE TABLE IF NOT EXISTS workflow_collaboration_approvals (
  id BIGINT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  action VARCHAR(100) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  arguments LONGTEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  note VARCHAR(500) NOT NULL DEFAULT '',
  decided_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uidx_workflow_collaboration_approvals_fingerprint (fingerprint),
  INDEX idx_workflow_collaboration_approvals_task_id (task_id),
  INDEX idx_workflow_collaboration_approvals_user_id (user_id),
  INDEX idx_workflow_collaboration_approvals_workflow_id (workflow_id),
  INDEX idx_workflow_collaboration_approvals_status (status)
);

CREATE TABLE IF NOT EXISTS workflow_collaboration_changes (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  task_id BIGINT NOT NULL,
  base_revision BIGINT NOT NULL,
  applied_revision BIGINT NOT NULL,
  reverted_revision BIGINT NULL,
  base_hash VARCHAR(64) NOT NULL,
  applied_hash VARCHAR(64) NOT NULL,
  applied_graph LONGTEXT NOT NULL,
  forward_operations LONGTEXT NOT NULL,
  inverse_operations LONGTEXT NOT NULL,
  diff LONGTEXT NOT NULL,
  conflict_paths LONGTEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'applied',
  reverted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uidx_workflow_collaboration_changes_task_id (task_id),
  INDEX idx_workflow_collaboration_changes_user_id (user_id),
  INDEX idx_workflow_collaboration_changes_workflow_id (workflow_id),
  INDEX idx_workflow_collaboration_changes_session_id (session_id),
  INDEX idx_workflow_collaboration_changes_status (status)
);
