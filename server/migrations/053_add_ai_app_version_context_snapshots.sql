-- 053: keep knowledge bindings and retrieval tuning immutable per app version.
ALTER TABLE ai_app_versions
  ADD COLUMN IF NOT EXISTS retrieval_config JSON NOT NULL DEFAULT '{"topK":4,"minScore":0.45,"citeSources":true}',
  ADD COLUMN IF NOT EXISTS knowledge_base_snapshot BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS ai_app_version_knowledge_bases (
  id BIGINT PRIMARY KEY,
  app_version_id BIGINT NOT NULL,
  knowledge_base_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_ai_app_version_kb UNIQUE (app_version_id, knowledge_base_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_app_version_knowledge_bases_version ON ai_app_version_knowledge_bases(app_version_id);

-- Existing versions did not have a historical snapshot. Seed each with the
-- current app bindings once, then prevent future edits from changing it.
INSERT INTO ai_app_version_knowledge_bases (id, app_version_id, knowledge_base_id, created_at)
SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000000)::BIGINT + ROW_NUMBER() OVER (), versions.id, bindings.knowledge_base_id, NOW()
FROM ai_app_versions AS versions
JOIN ai_app_knowledge_bases AS bindings ON bindings.app_id = versions.app_id
ON CONFLICT (app_version_id, knowledge_base_id) DO NOTHING;

UPDATE ai_app_versions SET knowledge_base_snapshot = TRUE WHERE knowledge_base_snapshot = FALSE;
