-- +goose Up
ALTER TABLE ai_app_tasks
  ADD COLUMN IF NOT EXISTS partial_output TEXT NOT NULL DEFAULT '';
