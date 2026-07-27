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
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_skills_user_id ON ai_skills (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_skills_archived_at ON ai_skills (archived_at);
CREATE INDEX IF NOT EXISTS idx_ai_skills_deleted_at ON ai_skills (deleted_at);

INSERT INTO ai_skills (
  id, user_id, name, description, content, source_url, source_author, source_license,
  installed_at, created_at, updated_at, deleted_at
)
SELECT
  id, user_id, name, description, content, source_url, COALESCE(source_author, ''),
  COALESCE(source_license, ''), COALESCE(imported_at, created_at), created_at, updated_at, deleted_at
FROM ai_prompts
WHERE source_url IS NOT NULL AND source_url <> '' AND archived_at IS NULL AND deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE ai_prompts
SET archived_at = NOW()
WHERE source_url IS NOT NULL AND source_url <> '' AND archived_at IS NULL AND deleted_at IS NULL;

ALTER TABLE ai_image_generations
  ADD COLUMN IF NOT EXISTS skill_id BIGINT,
  ADD COLUMN IF NOT EXISTS skill_name VARCHAR(100) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_ai_image_generations_skill_id
  ON ai_image_generations (skill_id);
