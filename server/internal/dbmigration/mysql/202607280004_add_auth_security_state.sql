-- +goose Up
CALL valley_managed_add_column_if_missing(
  'users', 'token_version', 'INT NOT NULL DEFAULT 1'
);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  email VARCHAR(100) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  last_sent_at DATETIME(3) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (email, purpose),
  KEY idx_email_verification_codes_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS email_verification_rate_limits (
  key_hash VARCHAR(64) NOT NULL,
  window_start DATETIME(3) NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (key_hash)
);

-- +goose Down
DROP TABLE IF EXISTS email_verification_rate_limits;
DROP TABLE IF EXISTS email_verification_codes;
ALTER TABLE users DROP COLUMN token_version;
