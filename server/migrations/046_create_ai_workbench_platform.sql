-- 046: owner-scoped AI workbench assets. Existing workflows/agents remain compatible.
CREATE TABLE IF NOT EXISTS ai_apps (
  id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, type VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL, description VARCHAR(500) DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'draft',
  draft_version_id BIGINT, published_version_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_apps_user_type ON ai_apps(user_id, type);
CREATE TABLE IF NOT EXISTS ai_app_versions (
  id BIGINT PRIMARY KEY, app_id BIGINT NOT NULL, number INT NOT NULL, config JSON NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uidx_ai_app_version UNIQUE(app_id, number)
);
CREATE TABLE IF NOT EXISTS ai_knowledge_bases (
  id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(500) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL
);
CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
  id BIGINT PRIMARY KEY, knowledge_base_id BIGINT NOT NULL, user_id BIGINT NOT NULL, name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', error_code VARCHAR(80) DEFAULT '', chunk_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL
);
CREATE TABLE IF NOT EXISTS ai_app_knowledge_bases (id BIGINT PRIMARY KEY, app_id BIGINT NOT NULL, knowledge_base_id BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT uidx_ai_app_kb UNIQUE(app_id, knowledge_base_id));
CREATE TABLE IF NOT EXISTS ai_app_tool_bindings (id BIGINT PRIMARY KEY, app_id BIGINT NOT NULL, tool_name VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT uidx_ai_app_tool UNIQUE(app_id, tool_name));
CREATE TABLE IF NOT EXISTS ai_api_keys (id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, name VARCHAR(100) NOT NULL, key_prefix VARCHAR(20) NOT NULL, key_hash VARCHAR(64) NOT NULL UNIQUE, status VARCHAR(20) NOT NULL DEFAULT 'active', last_used_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL);
