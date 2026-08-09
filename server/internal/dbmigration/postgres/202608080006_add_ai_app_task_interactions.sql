-- +goose Up
ALTER TABLE ai_app_conversation_tool_traces
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS error_message VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS ai_app_task_clarifications (
  id BIGINT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  app_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  question VARCHAR(500) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  answer_type VARCHAR(32) NOT NULL,
  suggestions TEXT NOT NULL DEFAULT '[]',
  allow_custom_answer BOOLEAN NOT NULL DEFAULT FALSE,
  blocking BOOLEAN NOT NULL DEFAULT TRUE,
  round INTEGER NOT NULL,
  max_rounds INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  decision VARCHAR(20) NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_ai_app_task_clarification_request
  ON ai_app_task_clarifications (request_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_task_clarifications_task_id
  ON ai_app_task_clarifications (task_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_task_clarifications_run_id
  ON ai_app_task_clarifications (run_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_task_clarifications_user_id
  ON ai_app_task_clarifications (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_task_clarifications_app_id
  ON ai_app_task_clarifications (app_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_task_clarifications_conversation_id
  ON ai_app_task_clarifications (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_task_clarifications_status
  ON ai_app_task_clarifications (status);
CREATE INDEX IF NOT EXISTS idx_ai_app_task_clarifications_deleted_at
  ON ai_app_task_clarifications (deleted_at);
