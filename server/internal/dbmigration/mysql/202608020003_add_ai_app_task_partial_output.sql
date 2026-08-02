-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_app_tasks', 'partial_output', 'LONGTEXT NULL'
);
UPDATE ai_app_tasks SET partial_output = '' WHERE partial_output IS NULL;
ALTER TABLE ai_app_tasks MODIFY partial_output LONGTEXT NOT NULL;
