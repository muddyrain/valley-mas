-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_models', 'video_protocol', "VARCHAR(40) NOT NULL DEFAULT 'auto'"
);

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
  duration_seconds INT NOT NULL DEFAULT 5,
  resolution VARCHAR(16) NOT NULL DEFAULT '720p',
  reference_url TEXT NOT NULL,
  reference_storage_key VARCHAR(500) NOT NULL,
  provider_task_id VARCHAR(180) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  stage VARCHAR(40) NOT NULL DEFAULT 'queued',
  mp4_url TEXT NOT NULL,
  mp4_storage_key VARCHAR(500) NOT NULL DEFAULT '',
  mp4_size BIGINT NOT NULL DEFAULT 0,
  gif_url TEXT NOT NULL,
  gif_storage_key VARCHAR(500) NOT NULL DEFAULT '',
  gif_size BIGINT NOT NULL DEFAULT 0,
  gif_width INT NOT NULL DEFAULT 0,
  gif_height INT NOT NULL DEFAULT 0,
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  error_message VARCHAR(500) NOT NULL DEFAULT '',
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CALL valley_managed_add_index_if_missing(
  'ai_motion_sticker_generations', 'idx_ai_motion_sticker_generations_user_id', 'user_id'
);
CALL valley_managed_add_index_if_missing(
  'ai_motion_sticker_generations', 'idx_ai_motion_sticker_generations_model_catalog_id', 'model_catalog_id'
);
CALL valley_managed_add_index_if_missing(
  'ai_motion_sticker_generations', 'idx_ai_motion_sticker_generations_provider_task_id', 'provider_task_id'
);
CALL valley_managed_add_index_if_missing(
  'ai_motion_sticker_generations', 'idx_ai_motion_sticker_generations_status', 'status'
);
CALL valley_managed_add_index_if_missing(
  'ai_motion_sticker_generations', 'idx_ai_motion_sticker_generations_deleted_at', 'deleted_at'
);
