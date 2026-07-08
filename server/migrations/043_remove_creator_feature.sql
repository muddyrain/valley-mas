-- 043: 移除 Creator 功能，迁移数据到 User 关联
-- 执行顺序：先创建新表+迁移数据，再删除旧表

-- ============================================================
-- 1. 创建 user_albums 表（替代 creator_albums）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_albums (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) DEFAULT '',
  cover_resource_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_albums_user_id ON user_albums(user_id);
CREATE INDEX IF NOT EXISTS idx_user_albums_deleted_at ON user_albums(deleted_at);

-- 迁移数据：creator_albums → user_albums
-- 通过 creators.user_id 找到对应 user_id
INSERT INTO user_albums (id, user_id, name, description, cover_resource_id, created_at, updated_at, deleted_at)
SELECT ca.id, c.user_id, ca.name, ca.description, ca.cover_resource_id, ca.created_at, ca.updated_at, ca.deleted_at
FROM creator_albums ca
JOIN creators c ON c.id = ca.creator_id
WHERE c.deleted_at IS NULL;

-- ============================================================
-- 2. 创建 user_album_resources 关联表（替代 creator_album_resources）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_album_resources (
  user_album_id BIGINT NOT NULL,
  resource_id BIGINT NOT NULL,
  PRIMARY KEY (user_album_id, resource_id)
);

-- 迁移关联数据
INSERT INTO user_album_resources (user_album_id, resource_id)
SELECT car.creator_album_id, car.resource_id
FROM creator_album_resources car
INNER JOIN user_albums ua ON ua.id = car.creator_album_id;

-- ============================================================
-- 3. 修改 user_follows：creator_id → followed_user_id
-- ============================================================
ALTER TABLE user_follows ADD COLUMN IF NOT EXISTS followed_user_id BIGINT;

-- 迁移数据：将 creator_id → 对应的 user_id
UPDATE user_follows uf
SET followed_user_id = c.user_id
FROM creators c
WHERE uf.creator_id = c.id AND c.deleted_at IS NULL;

-- 删除无法迁移的记录（Creator 已删除或无对应用户）
DELETE FROM user_follows WHERE followed_user_id IS NULL;

-- 创建新唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS uidx_user_followed_user ON user_follows(user_id, followed_user_id);

-- 删除旧列和旧索引
DROP INDEX IF EXISTS uidx_user_creator;
ALTER TABLE user_follows DROP COLUMN IF EXISTS creator_id;

-- ============================================================
-- 4. 移除 download_records.creator_id（冗余字段）
-- ============================================================
ALTER TABLE download_records DROP COLUMN IF EXISTS creator_id;

-- ============================================================
-- 5. 将 users.role = 'creator' 的记录改为 'user'
-- ============================================================
UPDATE users SET role = 'user' WHERE role = 'creator';

-- ============================================================
-- 6. 删除旧表（确认新表数据无误后执行）
-- ============================================================
DROP TABLE IF EXISTS creator_album_resources;
DROP TABLE IF EXISTS creator_albums;
DROP TABLE IF EXISTS space_resources;
DROP TABLE IF EXISTS creator_spaces;
DROP TABLE IF EXISTS code_access_logs;
DROP TABLE IF EXISTS creator_applications;
DROP TABLE IF EXISTS creator_audit_configs;
DROP TABLE IF EXISTS creators;
