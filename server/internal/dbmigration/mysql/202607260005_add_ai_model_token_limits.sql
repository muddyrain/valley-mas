-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_models', 'context_window_tokens', 'INT NOT NULL DEFAULT 0'
);
CALL valley_managed_add_column_if_missing(
  'ai_models', 'max_output_tokens', 'INT NOT NULL DEFAULT 0'
);
