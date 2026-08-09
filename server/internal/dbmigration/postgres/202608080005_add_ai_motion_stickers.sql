-- +goose Up
ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS video_protocol VARCHAR(40) NOT NULL DEFAULT 'auto';

CREATE TABLE IF NOT EXISTS ai_motion_sticker_generations (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  model_catalog_id BIGINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  model VARCHAR(180) NOT NULL,
  video_protocol VARCHAR(40) NOT NULL DEFAULT 'auto',
  action TEXT NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio VARCHAR(16) NOT NULL DEFAULT '1:1',
  duration_seconds INTEGER NOT NULL DEFAULT 5,
  resolution VARCHAR(16) NOT NULL DEFAULT '720p',
  reference_url TEXT NOT NULL,
  reference_storage_key VARCHAR(500) NOT NULL,
  provider_task_id VARCHAR(180) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  stage VARCHAR(40) NOT NULL DEFAULT 'queued',
  mp4_url TEXT NOT NULL DEFAULT '',
  mp4_storage_key VARCHAR(500) NOT NULL DEFAULT '',
  mp4_size BIGINT NOT NULL DEFAULT 0,
  gif_url TEXT NOT NULL DEFAULT '',
  gif_storage_key VARCHAR(500) NOT NULL DEFAULT '',
  gif_size BIGINT NOT NULL DEFAULT 0,
  gif_width INTEGER NOT NULL DEFAULT 0,
  gif_height INTEGER NOT NULL DEFAULT 0,
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  error_message VARCHAR(500) NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_motion_sticker_generations_user_id
  ON ai_motion_sticker_generations (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_motion_sticker_generations_model_catalog_id
  ON ai_motion_sticker_generations (model_catalog_id);
CREATE INDEX IF NOT EXISTS idx_ai_motion_sticker_generations_provider_task_id
  ON ai_motion_sticker_generations (provider_task_id);
CREATE INDEX IF NOT EXISTS idx_ai_motion_sticker_generations_status
  ON ai_motion_sticker_generations (status);
CREATE INDEX IF NOT EXISTS idx_ai_motion_sticker_generations_deleted_at
  ON ai_motion_sticker_generations (deleted_at);
