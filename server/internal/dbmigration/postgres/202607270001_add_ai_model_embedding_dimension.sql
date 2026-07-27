-- +goose Up
ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS embedding_dimension INTEGER NOT NULL DEFAULT 0;
