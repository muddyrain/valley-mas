-- +goose Up
CALL valley_managed_add_column_if_missing(
  'workflow_collaboration_changes', 'applied_graph', 'LONGTEXT NOT NULL'
);
