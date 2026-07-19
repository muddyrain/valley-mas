-- 066: owner-private OAuth connections for controlled external connectors.
-- Tokens are AES-GCM ciphertext only; plaintext tokens and authorization codes
-- must never be written to this schema or any audit record.

CREATE TABLE IF NOT EXISTS external_connections (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'connected',
  provider_account_id VARCHAR(120) NOT NULL DEFAULT '',
  workspace_id VARCHAR(120) NOT NULL DEFAULT '',
  workspace_name VARCHAR(240) NOT NULL DEFAULT '',
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL DEFAULT '',
  last_error VARCHAR(500) NOT NULL DEFAULT '',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_external_connection_owner_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_external_connections_status ON external_connections (status);

CREATE TABLE IF NOT EXISTS external_oauth_states (
  id BIGINT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  user_id BIGINT NOT NULL,
  state_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_oauth_states_provider_user ON external_oauth_states (provider, user_id);
CREATE INDEX IF NOT EXISTS idx_external_oauth_states_expires_at ON external_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS external_connection_audits (
  id BIGINT PRIMARY KEY,
  connection_id BIGINT NOT NULL DEFAULT 0,
  user_id BIGINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  action VARCHAR(60) NOT NULL,
  status VARCHAR(30) NOT NULL,
  detail VARCHAR(240) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_connection_audits_owner_created
  ON external_connection_audits (user_id, created_at DESC);
