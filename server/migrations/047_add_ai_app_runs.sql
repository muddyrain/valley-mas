-- 047: safe summaries for private AI application debug runs.
CREATE TABLE IF NOT EXISTS ai_app_runs (
  id BIGINT PRIMARY KEY, app_id BIGINT NOT NULL, version_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL, model VARCHAR(160) DEFAULT '', input TEXT NOT NULL, output TEXT DEFAULT '',
  error_code VARCHAR(80) DEFAULT '', duration_ms BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_app_runs_app_user_created ON ai_app_runs(app_id, user_id, created_at DESC);
