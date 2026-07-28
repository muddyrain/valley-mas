-- +goose Up
ALTER TABLE ai_image_generations
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'studio';

CREATE INDEX IF NOT EXISTS idx_ai_image_generations_owner_source_created
  ON ai_image_generations (user_id, source, created_at DESC);

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_cancel_requested_at
  ON workflow_runs (cancel_requested_at);
