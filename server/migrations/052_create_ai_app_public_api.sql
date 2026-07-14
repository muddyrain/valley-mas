-- 052: public AI app API access controls and metadata-only observability.
CREATE TABLE IF NOT EXISTS ai_api_key_app_bindings (
  id BIGINT PRIMARY KEY,
  api_key_id BIGINT NOT NULL,
  app_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_ai_api_key_app UNIQUE (api_key_id, app_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_api_key_app_bindings_app ON ai_api_key_app_bindings(app_id);

CREATE TABLE IF NOT EXISTS ai_api_key_daily_usages (
  id BIGINT PRIMARY KEY,
  api_key_id BIGINT NOT NULL,
  usage_date DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_ai_api_key_usage_day UNIQUE (api_key_id, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_ai_api_key_daily_usages_date ON ai_api_key_daily_usages(usage_date);

CREATE TABLE IF NOT EXISTS ai_app_public_invocations (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  app_id BIGINT NOT NULL,
  version_id BIGINT NOT NULL,
  api_key_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  stream BOOLEAN NOT NULL DEFAULT FALSE,
  error_code VARCHAR(80) DEFAULT '',
  daily_call_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_app_public_invocations_app_created ON ai_app_public_invocations(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_app_public_invocations_key_created ON ai_app_public_invocations(api_key_id, created_at DESC);
