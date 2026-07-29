-- +goose Up
ALTER TABLE workflow_node_runs
  ADD COLUMN IF NOT EXISTS error_message VARCHAR(500) NOT NULL DEFAULT '';
