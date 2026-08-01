-- +goose Up
CREATE TABLE IF NOT EXISTS ai_skill_files (
  id BIGINT PRIMARY KEY,
  skill_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  path VARCHAR(512) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  mime_type VARCHAR(120) NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_key VARCHAR(500) NOT NULL DEFAULT '',
  file_hash VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uidx_ai_skill_file_path UNIQUE (skill_id, path)
);
CREATE INDEX IF NOT EXISTS idx_ai_skill_files_user_id ON ai_skill_files (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_skill_files_kind ON ai_skill_files (kind);
CREATE INDEX IF NOT EXISTS idx_ai_skill_files_deleted_at ON ai_skill_files (deleted_at);
