-- 054: immutable tool bindings and owner-private AI App conversations.
ALTER TABLE ai_app_versions
  ADD COLUMN IF NOT EXISTS tool_snapshot BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ai_app_runs
  ADD COLUMN IF NOT EXISTS conversation_id BIGINT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_app_runs_conversation_id ON ai_app_runs(conversation_id);

CREATE TABLE IF NOT EXISTS ai_app_version_tool_bindings (
  id BIGINT PRIMARY KEY,
  app_version_id BIGINT NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_ai_app_version_tool UNIQUE (app_version_id, tool_name)
);
CREATE INDEX IF NOT EXISTS idx_ai_app_version_tool_bindings_version ON ai_app_version_tool_bindings(app_version_id);

INSERT INTO ai_app_version_tool_bindings (id, app_version_id, tool_name, created_at)
SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000000)::BIGINT + ROW_NUMBER() OVER (), versions.id, bindings.tool_name, NOW()
FROM ai_app_versions AS versions
JOIN ai_app_tool_bindings AS bindings ON bindings.app_id = versions.app_id
ON CONFLICT (app_version_id, tool_name) DO NOTHING;
UPDATE ai_app_versions SET tool_snapshot = TRUE WHERE tool_snapshot = FALSE;

CREATE TABLE IF NOT EXISTS ai_app_conversations (
  id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, app_id BIGINT NOT NULL, version_id BIGINT NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT '新对话', status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_app_conversations_owner_updated ON ai_app_conversations(user_id, app_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_app_conversation_messages (
  id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, app_id BIGINT NOT NULL, conversation_id BIGINT NOT NULL,
  run_id BIGINT NULL, role VARCHAR(20) NOT NULL, content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_app_conversation_messages_conversation_created ON ai_app_conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_app_conversation_tool_traces (
  id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, app_id BIGINT NOT NULL, conversation_id BIGINT NOT NULL,
  run_id BIGINT NOT NULL, tool_name VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL,
  duration_ms BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_app_conversation_tool_traces_conversation_created ON ai_app_conversation_tool_traces(conversation_id, created_at);
