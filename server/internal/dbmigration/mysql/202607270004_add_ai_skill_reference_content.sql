-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_skills', 'reference_content', "TEXT NOT NULL"
);
