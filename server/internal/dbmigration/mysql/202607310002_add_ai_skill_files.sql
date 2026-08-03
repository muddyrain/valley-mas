-- +goose Up
CREATE TABLE IF NOT EXISTS ai_skill_files (
  id BIGINT PRIMARY KEY,
  skill_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  path VARCHAR(512) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_key VARCHAR(500) NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uidx_ai_skill_file_path (skill_id, path),
  INDEX idx_ai_skill_files_user_id (user_id),
  INDEX idx_ai_skill_files_kind (kind),
  INDEX idx_ai_skill_files_deleted_at (deleted_at)
);
