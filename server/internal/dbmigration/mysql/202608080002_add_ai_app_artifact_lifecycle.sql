-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_app_artifacts', 'storage_key', "VARCHAR(500) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_column_if_missing(
  'ai_app_artifacts', 'expires_at', "DATETIME(3) NULL"
);

CALL valley_managed_add_column_if_missing(
  'ai_app_artifacts', 'persisted_at', "DATETIME(3) NULL"
);

CALL valley_managed_add_index_if_missing(
  'ai_app_artifacts', 'idx_ai_app_artifacts_expires_at', 'expires_at'
);
