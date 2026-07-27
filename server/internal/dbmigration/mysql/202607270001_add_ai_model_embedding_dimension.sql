-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_models', 'embedding_dimension', 'INT NOT NULL DEFAULT 0'
);
