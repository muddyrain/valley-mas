-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_app_runs', 'knowledge_status', "VARCHAR(24) NOT NULL DEFAULT 'not_used'"
);

CALL valley_managed_add_column_if_missing(
  'ai_app_runs', 'knowledge_error_code', "VARCHAR(80) NOT NULL DEFAULT ''"
);
