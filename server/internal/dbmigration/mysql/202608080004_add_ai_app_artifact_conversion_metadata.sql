-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_app_artifacts', 'kind', "VARCHAR(30) NOT NULL DEFAULT 'file'"
);

CALL valley_managed_add_column_if_missing(
  'ai_app_artifacts', 'source_format', "VARCHAR(20) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_column_if_missing(
  'ai_app_artifacts', 'target_format', "VARCHAR(20) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_index_if_missing(
  'ai_app_artifacts', 'idx_ai_app_artifacts_kind', 'kind'
);
