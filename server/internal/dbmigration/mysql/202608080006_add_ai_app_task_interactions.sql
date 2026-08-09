-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_app_conversation_tool_traces', 'error_code', "VARCHAR(80) NOT NULL DEFAULT ''"
);
CALL valley_managed_add_column_if_missing(
  'ai_app_conversation_tool_traces', 'error_message', "VARCHAR(500) NOT NULL DEFAULT ''"
);
CALL valley_managed_add_column_if_missing(
  'ai_app_conversation_tool_traces', 'retryable', "TINYINT(1) NOT NULL DEFAULT 0"
);

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
  suggestions TEXT NOT NULL,
  allow_custom_answer TINYINT(1) NOT NULL DEFAULT 0,
  blocking TINYINT(1) NOT NULL DEFAULT 1,
  round INT NOT NULL,
  max_rounds INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  decision VARCHAR(20) NOT NULL DEFAULT '',
  answer TEXT NOT NULL,
  resolved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CALL valley_managed_add_index_if_missing(
  'ai_app_task_clarifications', 'uidx_ai_app_task_clarification_request',
  'UNIQUE INDEX `uidx_ai_app_task_clarification_request` (`request_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_app_task_clarifications', 'idx_ai_app_task_clarifications_task_id',
  'INDEX `idx_ai_app_task_clarifications_task_id` (`task_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_app_task_clarifications', 'idx_ai_app_task_clarifications_run_id',
  'INDEX `idx_ai_app_task_clarifications_run_id` (`run_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_app_task_clarifications', 'idx_ai_app_task_clarifications_user_id',
  'INDEX `idx_ai_app_task_clarifications_user_id` (`user_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_app_task_clarifications', 'idx_ai_app_task_clarifications_app_id',
  'INDEX `idx_ai_app_task_clarifications_app_id` (`app_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_app_task_clarifications', 'idx_ai_app_task_clarifications_conversation_id',
  'INDEX `idx_ai_app_task_clarifications_conversation_id` (`conversation_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_app_task_clarifications', 'idx_ai_app_task_clarifications_status',
  'INDEX `idx_ai_app_task_clarifications_status` (`status`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_app_task_clarifications', 'idx_ai_app_task_clarifications_deleted_at',
  'INDEX `idx_ai_app_task_clarifications_deleted_at` (`deleted_at`)'
);
