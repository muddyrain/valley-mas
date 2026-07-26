-- +goose Up
ALTER TABLE ai_image_generations
  ADD COLUMN IF NOT EXISTS parent_generation_id BIGINT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_image_generations_parent
  ON ai_image_generations (parent_generation_id);
