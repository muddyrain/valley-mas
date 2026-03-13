-- 重构 resources 表：creator_id 改名为 user_id（语义更清晰）
-- resources.user_id 存储的是上传者的 User.ID

-- SQLite 不支持直接 RENAME COLUMN（3.25.0+ 才支持），用重建表方式

PRAGMA foreign_keys = OFF;

-- 1. 创建新表（user_id 替代 creator_id）
CREATE TABLE IF NOT EXISTS resources_new (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER,
    type          TEXT,
    title         TEXT,
    description   TEXT,
    url           TEXT,
    storage_key   TEXT,
    thumbnail_url TEXT,
    width         INTEGER,
    height        INTEGER,
    size          INTEGER,
    download_count INTEGER DEFAULT 0,
    created_at    DATETIME,
    updated_at    DATETIME,
    deleted_at    DATETIME
);

-- 2. 复制数据
INSERT INTO resources_new
SELECT id, creator_id, type, title, description, url, storage_key, thumbnail_url,
       width, height, size, download_count, created_at, updated_at, deleted_at
FROM resources;

-- 3. 删除旧表
DROP TABLE resources;

-- 4. 重命名新表
ALTER TABLE resources_new RENAME TO resources;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_resources_user_id ON resources(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_deleted_at ON resources(deleted_at);

-- 6. 删除 creators 表的 avatar 列（SQLite 同样需要重建）
CREATE TABLE IF NOT EXISTS creators_new (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER UNIQUE,
    description TEXT,
    code        TEXT UNIQUE,
    is_active   INTEGER DEFAULT 1,
    created_at  DATETIME,
    updated_at  DATETIME,
    deleted_at  DATETIME
);

INSERT INTO creators_new
SELECT id, user_id, description, code, is_active, created_at, updated_at, deleted_at
FROM creators;

DROP TABLE creators;
ALTER TABLE creators_new RENAME TO creators;

CREATE INDEX IF NOT EXISTS idx_creators_deleted_at ON creators(deleted_at);

PRAGMA foreign_keys = ON;
