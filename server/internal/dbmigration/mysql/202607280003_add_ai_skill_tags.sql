-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_skills', 'tags', "TEXT NOT NULL"
);
