-- +goose Up
CALL valley_managed_add_column_if_missing(
  'workflow_run_events', 'loop_iteration', 'INT NULL'
);
CALL valley_managed_add_column_if_missing(
  'workflow_run_events', 'loop_depth', 'INT NOT NULL DEFAULT 0'
);
CALL valley_managed_add_column_if_missing(
  'workflow_run_events', 'body_node_id', 'VARCHAR(120) NOT NULL DEFAULT '''''
);
CALL valley_managed_add_index_if_missing(
  'workflow_run_events',
  'idx_workflow_run_events_body_node_id',
  'INDEX `idx_workflow_run_events_body_node_id` (`body_node_id`)'
);
