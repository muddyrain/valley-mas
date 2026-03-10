-- 迁移: 移除 creators 表的 name 字段
-- 原因: 创作者名称直接使用关联用户的 nickname，避免数据重复
-- 日期: 2026-03-10

-- SQLite 不支持直接 DROP COLUMN，需要重建表

-- 1. 创建新表结构（没有 name 字段）
CREATE TABLE creators_new (
    id INTEGER PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    description TEXT,
    avatar TEXT,
    code TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME,
    updated_at DATETIME,
    deleted_at DATETIME
);

-- 2. 复制数据（不包括 name 字段）
INSERT INTO creators_new (id, user_id, description, avatar, code, is_active, created_at, updated_at, deleted_at)
SELECT id, user_id, description, avatar, code, is_active, created_at, updated_at, deleted_at
FROM creators;

-- 3. 删除旧表
DROP TABLE creators;

-- 4. 重命名新表
ALTER TABLE creators_new RENAME TO creators;

-- 5. 重新创建索引
CREATE INDEX idx_creators_user_id ON creators(user_id);
CREATE UNIQUE INDEX idx_creators_code ON creators(code);
CREATE INDEX idx_creators_deleted_at ON creators(deleted_at);
