-- +goose Up
ALTER TABLE ai_motion_sticker_generations
  ADD COLUMN IF NOT EXISTS generation_mode VARCHAR(16) NOT NULL DEFAULT 'video';

ALTER TABLE ai_motion_sticker_generations
  ADD COLUMN IF NOT EXISTS image_protocol VARCHAR(40) NOT NULL DEFAULT 'auto';

ALTER TABLE ai_motion_sticker_generations
  ADD COLUMN IF NOT EXISTS frame_count INTEGER NOT NULL DEFAULT 0;
