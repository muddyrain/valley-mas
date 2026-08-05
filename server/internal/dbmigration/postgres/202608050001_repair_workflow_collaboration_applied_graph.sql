-- +goose Up
ALTER TABLE workflow_collaboration_changes
  ADD COLUMN IF NOT EXISTS applied_graph TEXT NOT NULL DEFAULT '';

ALTER TABLE workflow_collaboration_changes
  ALTER COLUMN applied_graph DROP DEFAULT;
