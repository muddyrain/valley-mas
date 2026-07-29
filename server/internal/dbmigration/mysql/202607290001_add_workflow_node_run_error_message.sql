-- +goose Up
CALL valley_managed_add_column_if_missing(
  'workflow_node_runs', 'error_message', 'VARCHAR(500) NOT NULL DEFAULT '''''
);
