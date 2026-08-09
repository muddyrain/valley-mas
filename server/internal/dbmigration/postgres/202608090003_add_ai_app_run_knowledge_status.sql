-- +goose Up
ALTER TABLE ai_app_runs
  ADD COLUMN IF NOT EXISTS knowledge_status VARCHAR(24) NOT NULL DEFAULT 'not_used';

ALTER TABLE ai_app_runs
  ADD COLUMN IF NOT EXISTS knowledge_error_code VARCHAR(80) NOT NULL DEFAULT '';
