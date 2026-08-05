-- +goose Up
CALL valley_managed_add_column_if_missing(
  'workflow_runs', 'run_mode', 'VARCHAR(16) NOT NULL DEFAULT '''''
);
