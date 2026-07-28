-- +goose Up
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS runtime_state TEXT NOT NULL DEFAULT '';
