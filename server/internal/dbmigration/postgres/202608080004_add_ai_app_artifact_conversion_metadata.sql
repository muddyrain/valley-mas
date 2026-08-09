-- +goose Up
ALTER TABLE ai_app_artifacts
  ADD COLUMN IF NOT EXISTS kind VARCHAR(30) NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS source_format VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_format VARCHAR(20) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_ai_app_artifacts_kind
  ON ai_app_artifacts (kind);
