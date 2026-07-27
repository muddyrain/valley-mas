-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_prompts', 'tags', 'TEXT NULL'
);

CALL valley_managed_add_column_if_missing(
  'ai_prompts', 'source_url', 'VARCHAR(1000) NULL'
);

CALL valley_managed_add_column_if_missing(
  'ai_prompts', 'source_author', 'VARCHAR(200) NULL'
);

CALL valley_managed_add_column_if_missing(
  'ai_prompts', 'source_license', 'VARCHAR(100) NULL'
);

CALL valley_managed_add_column_if_missing(
  'ai_prompts', 'imported_at', 'DATETIME(3) NULL'
);
