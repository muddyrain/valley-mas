-- +goose Up
ALTER TABLE ai_app_artifacts
  ADD COLUMN IF NOT EXISTS storage_key VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS persisted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_ai_app_artifacts_expires_at
  ON ai_app_artifacts (expires_at);
