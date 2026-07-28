-- +goose Up
CALL valley_managed_add_column_if_missing(
  'workflow_runs', 'runtime_state', 'LONGTEXT NULL'
);
