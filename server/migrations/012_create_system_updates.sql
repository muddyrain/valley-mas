-- 系统更新日志（仅 Web 端展示）
CREATE TABLE IF NOT EXISTS system_updates (
  id BIGINT PRIMARY KEY,
  platform VARCHAR(20) NOT NULL DEFAULT 'web',
  title VARCHAR(120) NOT NULL,
  content VARCHAR(2000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_system_updates_platform ON system_updates(platform);
CREATE INDEX IF NOT EXISTS idx_system_updates_status ON system_updates(status);
CREATE INDEX IF NOT EXISTS idx_system_updates_published_at ON system_updates(published_at);
