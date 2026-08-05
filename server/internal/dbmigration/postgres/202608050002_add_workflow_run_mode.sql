-- +goose Up
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS run_mode VARCHAR(16) NOT NULL DEFAULT '';
