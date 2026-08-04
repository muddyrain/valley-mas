-- +goose Up
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;

ALTER TABLE ai_workbench_copilot_sessions
  ADD COLUMN IF NOT EXISTS canonical BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS context_reset_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_ai_workbench_copilot_sessions_canonical
  ON ai_workbench_copilot_sessions(canonical);
CREATE INDEX IF NOT EXISTS idx_ai_workbench_copilot_sessions_archived_at
  ON ai_workbench_copilot_sessions(archived_at);

CREATE TABLE IF NOT EXISTS workflow_collaboration_tasks (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  user_message_id BIGINT NOT NULL,
  change_id BIGINT NULL,
  title VARCHAR(160) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  payload TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  status_message VARCHAR(500) NOT NULL DEFAULT '',
  partial_output TEXT NOT NULL DEFAULT '',
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  base_revision BIGINT NOT NULL,
  base_hash VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL UNIQUE,
  cancel_requested_at TIMESTAMPTZ NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_tasks_user_id ON workflow_collaboration_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_tasks_workflow_id ON workflow_collaboration_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_tasks_session_id ON workflow_collaboration_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_tasks_status ON workflow_collaboration_tasks(status);

CREATE TABLE IF NOT EXISTS workflow_collaboration_attachments (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_attachments_user_id ON workflow_collaboration_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_attachments_workflow_id ON workflow_collaboration_attachments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_attachments_session_id ON workflow_collaboration_attachments(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_attachments_message_id ON workflow_collaboration_attachments(message_id);

CREATE TABLE IF NOT EXISTS workflow_collaboration_approvals (
  id BIGINT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  action VARCHAR(100) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL UNIQUE,
  summary VARCHAR(500) NOT NULL,
  arguments TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  note VARCHAR(500) NOT NULL DEFAULT '',
  decided_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_approvals_task_id ON workflow_collaboration_approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_approvals_user_id ON workflow_collaboration_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_approvals_workflow_id ON workflow_collaboration_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_approvals_status ON workflow_collaboration_approvals(status);

CREATE TABLE IF NOT EXISTS workflow_collaboration_changes (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  workflow_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  task_id BIGINT NOT NULL UNIQUE,
  base_revision BIGINT NOT NULL,
  applied_revision BIGINT NOT NULL,
  reverted_revision BIGINT NULL,
  base_hash VARCHAR(64) NOT NULL,
  applied_hash VARCHAR(64) NOT NULL,
  applied_graph TEXT NOT NULL,
  forward_operations TEXT NOT NULL,
  inverse_operations TEXT NOT NULL,
  diff TEXT NOT NULL DEFAULT '{}',
  conflict_paths TEXT NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'applied',
  reverted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_changes_user_id ON workflow_collaboration_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_changes_workflow_id ON workflow_collaboration_changes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_changes_session_id ON workflow_collaboration_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_collaboration_changes_status ON workflow_collaboration_changes(status);
