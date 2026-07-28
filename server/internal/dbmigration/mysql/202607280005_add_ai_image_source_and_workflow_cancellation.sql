-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'source', 'VARCHAR(20) NOT NULL DEFAULT ''studio'''
);

CALL valley_managed_add_index_if_missing(
  'ai_image_generations',
  'idx_ai_image_generations_owner_source_created',
  'INDEX `idx_ai_image_generations_owner_source_created` (`user_id`, `source`, `created_at`)'
);

CALL valley_managed_add_column_if_missing(
  'workflow_runs', 'cancel_requested_at', 'DATETIME NULL'
);

CALL valley_managed_add_index_if_missing(
  'workflow_runs',
  'idx_workflow_runs_cancel_requested_at',
  'INDEX `idx_workflow_runs_cancel_requested_at` (`cancel_requested_at`)'
);
