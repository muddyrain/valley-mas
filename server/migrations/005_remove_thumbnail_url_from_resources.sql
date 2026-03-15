-- 移除 resources 表的 thumbnail_url 字段
-- thumbnail_url 字段已废弃，TOS 存储本身不提供缩略图功能

-- ============================================================
-- MySQL（生产环境）
-- 直接支持 DROP COLUMN，无需重建表
-- ============================================================
-- ALTER TABLE resources DROP COLUMN thumbnail_url;


-- ============================================================
-- SQLite（本地开发）
-- SQLite 不支持 DROP COLUMN，需重建表
-- ============================================================

PRAGMA foreign_keys = OFF;

-- 1. 创建不含 thumbnail_url 的新表
CREATE TABLE IF NOT EXISTS resources_new (
    id             INTEGER PRIMARY KEY,
    user_id        INTEGER,
    type           TEXT,
    title          TEXT,
    description    TEXT,
    url            TEXT,
    storage_key    TEXT,
    width          INTEGER,
    height         INTEGER,
    size           INTEGER,
    extension      TEXT,
    download_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    created_at     DATETIME,
    updated_at     DATETIME,
    deleted_at     DATETIME
);

-- 2. 复制数据（排除 thumbnail_url）
INSERT INTO resources_new (
    id, user_id, type, title, description, url, storage_key,
    width, height, size, extension,
    download_count, favorite_count,
    created_at, updated_at, deleted_at
)
SELECT
    id, user_id, type, title, description, url, storage_key,
    width, height, size, extension,
    download_count, favorite_count,
    created_at, updated_at, deleted_at
FROM resources;

-- 3. 删除旧表
DROP TABLE resources;

-- 4. 重命名新表
ALTER TABLE resources_new RENAME TO resources;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_resources_user_id   ON resources(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_deleted_at ON resources(deleted_at);

PRAGMA foreign_keys = ON;
