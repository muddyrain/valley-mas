-- +goose Up
ALTER TABLE ai_app_conversation_messages
  ADD COLUMN IF NOT EXISTS reference_image_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_generation_ids TEXT NOT NULL DEFAULT '[]';
