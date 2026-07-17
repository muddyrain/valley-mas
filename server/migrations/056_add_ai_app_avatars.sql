-- 056: application-level avatars for AI workbench agents.
ALTER TABLE ai_apps ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1000) NOT NULL DEFAULT '';
ALTER TABLE ai_apps ADD COLUMN IF NOT EXISTS avatar_source VARCHAR(20) NOT NULL DEFAULT 'default';
ALTER TABLE ai_apps ADD COLUMN IF NOT EXISTS avatar_storage_key VARCHAR(500) NOT NULL DEFAULT '';
