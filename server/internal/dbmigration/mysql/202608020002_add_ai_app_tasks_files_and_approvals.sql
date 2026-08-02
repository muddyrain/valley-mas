-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_app_version_tool_bindings', 'approval_mode', 'VARCHAR(20) NOT NULL DEFAULT ''auto'''
);

CREATE TABLE IF NOT EXISTS ai_app_tasks (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  app_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL UNIQUE,
  user_message_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  payload LONGTEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  status_message VARCHAR(500) NOT NULL DEFAULT '',
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  cancel_requested_at DATETIME(3) NULL,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_ai_app_tasks_user_id (user_id),
  INDEX idx_ai_app_tasks_app_id (app_id),
  INDEX idx_ai_app_tasks_conversation_id (conversation_id),
  INDEX idx_ai_app_tasks_status (status)
);

CREATE TABLE IF NOT EXISTS ai_app_tool_approvals (
  id BIGINT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
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
  UNIQUE KEY uidx_ai_app_tool_approval (fingerprint),
  INDEX idx_ai_app_tool_approvals_task_id (task_id),
  INDEX idx_ai_app_tool_approvals_run_id (run_id),
  INDEX idx_ai_app_tool_approvals_user_id (user_id),
  INDEX idx_ai_app_tool_approvals_status (status)
);

CREATE TABLE IF NOT EXISTS ai_app_conversation_attachments (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  app_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  message_id BIGINT NULL,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL,
  parsed_text LONGTEXT NOT NULL,
  source_content LONGBLOB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ready',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_ai_app_conversation_attachments_user_id (user_id),
  INDEX idx_ai_app_conversation_attachments_conversation_id (conversation_id),
  INDEX idx_ai_app_conversation_attachments_message_id (message_id)
);

CREATE TABLE IF NOT EXISTS ai_app_artifacts (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  app_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL,
  task_id BIGINT NULL,
  resource_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL,
  url VARCHAR(1000) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_ai_app_artifacts_user_id (user_id),
  INDEX idx_ai_app_artifacts_conversation_id (conversation_id),
  INDEX idx_ai_app_artifacts_run_id (run_id),
  INDEX idx_ai_app_artifacts_task_id (task_id)
);
