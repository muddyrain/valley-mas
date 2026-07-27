-- +goose Up
CREATE TABLE IF NOT EXISTS ai_skills (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_author VARCHAR(200) NOT NULL DEFAULT '',
  source_license VARCHAR(100) NOT NULL DEFAULT '',
  installed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_ai_skills_user_id (user_id),
  INDEX idx_ai_skills_archived_at (archived_at),
  INDEX idx_ai_skills_deleted_at (deleted_at)
);

INSERT IGNORE INTO ai_skills (
  id, user_id, name, description, content, source_url, source_author, source_license,
  installed_at, created_at, updated_at, deleted_at
)
SELECT
  id, user_id, name, description, content, source_url, COALESCE(source_author, ''),
  COALESCE(source_license, ''), COALESCE(imported_at, created_at), created_at, updated_at, deleted_at
FROM ai_prompts
WHERE source_url IS NOT NULL AND source_url <> '' AND archived_at IS NULL AND deleted_at IS NULL;

UPDATE ai_prompts
SET archived_at = CURRENT_TIMESTAMP(3)
WHERE source_url IS NOT NULL AND source_url <> '' AND archived_at IS NULL AND deleted_at IS NULL;

CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'skill_id', 'BIGINT NULL'
);

CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'skill_name', "VARCHAR(100) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_index_if_missing(
  'ai_image_generations', 'idx_ai_image_generations_skill_id', 'INDEX `idx_ai_image_generations_skill_id` (`skill_id`)'
);
