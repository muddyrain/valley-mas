-- +goose Up
ALTER TABLE ai_app_version_tool_bindings
  ADD COLUMN IF NOT EXISTS approval_mode VARCHAR(20) NOT NULL DEFAULT 'auto';

CREATE TABLE IF NOT EXISTS ai_app_tasks (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  app_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL UNIQUE,
  user_message_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  payload TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  status_message VARCHAR(500) NOT NULL DEFAULT '',
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  cancel_requested_at TIMESTAMPTZ NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_app_tasks_user_id ON ai_app_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_tasks_app_id ON ai_app_tasks(app_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_tasks_conversation_id ON ai_app_tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_tasks_status ON ai_app_tasks(status);

CREATE TABLE IF NOT EXISTS ai_app_tool_approvals (
  id BIGINT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  arguments TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  note VARCHAR(500) NOT NULL DEFAULT '',
  decided_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uidx_ai_app_tool_approval UNIQUE (fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_ai_app_tool_approvals_task_id ON ai_app_tool_approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_tool_approvals_run_id ON ai_app_tool_approvals(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_tool_approvals_user_id ON ai_app_tool_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_tool_approvals_status ON ai_app_tool_approvals(status);

CREATE TABLE IF NOT EXISTS ai_app_conversation_attachments (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  app_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  message_id BIGINT NULL,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL,
  parsed_text TEXT NOT NULL,
  source_content BYTEA NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_app_conversation_attachments_user_id ON ai_app_conversation_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_conversation_attachments_conversation_id ON ai_app_conversation_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_conversation_attachments_message_id ON ai_app_conversation_attachments(message_id);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_app_artifacts_user_id ON ai_app_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_artifacts_conversation_id ON ai_app_artifacts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_artifacts_run_id ON ai_app_artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_artifacts_task_id ON ai_app_artifacts(task_id);
