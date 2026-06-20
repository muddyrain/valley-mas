CREATE TABLE IF NOT EXISTS mail_accounts (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  auth_type VARCHAR(40) NOT NULL,
  email VARCHAR(160) NOT NULL,
  credential_ciphertext TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'connected',
  last_synced_at TIMESTAMPTZ NULL,
  last_error VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mail_account_user_provider_email
ON mail_accounts (user_id, provider, email)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mail_accounts_user_id
ON mail_accounts (user_id);

CREATE INDEX IF NOT EXISTS idx_mail_accounts_status
ON mail_accounts (status);

CREATE INDEX IF NOT EXISTS idx_mail_accounts_deleted_at
ON mail_accounts (deleted_at);

CREATE TABLE IF NOT EXISTS mail_messages (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  account_id BIGINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  provider_message_id VARCHAR(240) NOT NULL,
  thread_id VARCHAR(240) NOT NULL DEFAULT '',
  from_address VARCHAR(300) NOT NULL DEFAULT '',
  subject VARCHAR(500) NOT NULL DEFAULT '',
  snippet VARCHAR(1000) NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mail_message_account_provider_id
ON mail_messages (account_id, provider_message_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mail_messages_user_id
ON mail_messages (user_id);

CREATE INDEX IF NOT EXISTS idx_mail_messages_account_id
ON mail_messages (account_id);

CREATE INDEX IF NOT EXISTS idx_mail_messages_provider
ON mail_messages (provider);

CREATE INDEX IF NOT EXISTS idx_mail_messages_sent_at
ON mail_messages (sent_at);

CREATE INDEX IF NOT EXISTS idx_mail_messages_deleted_at
ON mail_messages (deleted_at);
