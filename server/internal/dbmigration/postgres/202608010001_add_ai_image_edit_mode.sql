-- +goose Up
ALTER TABLE ai_image_generations
  ADD COLUMN IF NOT EXISTS edit_mode VARCHAR(30) NOT NULL DEFAULT '';
