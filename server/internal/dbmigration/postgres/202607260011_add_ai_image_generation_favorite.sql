-- +goose Up
ALTER TABLE ai_image_generations
  ADD COLUMN IF NOT EXISTS is_favorited BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ai_image_generations_is_favorited
  ON ai_image_generations (is_favorited);
