-- 移除 creator_spaces 表的 title 字段
-- SQLite 不支持 DROP COLUMN,需要重建表
-- 执行时间: 2026-03-10

BEGIN TRANSACTION;

-- 1. 创建新表(没有 title 字段)
CREATE TABLE creator_spaces_new (
    id INTEGER PRIMARY KEY,
    creator_id INTEGER NOT NULL,
    description TEXT,
    banner TEXT,
    is_active NUMERIC DEFAULT true,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    deleted_at DATETIME,
    CONSTRAINT fk_creators_space FOREIGN KEY (creator_id) REFERENCES creators(id)
);

-- 2. 复制数据(不包括 title 字段)
INSERT INTO creator_spaces_new (
    id, creator_id, description, banner, is_active, 
    view_count, created_at, updated_at, deleted_at
)
SELECT 
    id, creator_id, description, banner, is_active, 
    view_count, created_at, updated_at, deleted_at
FROM creator_spaces;

-- 3. 删除旧表
DROP TABLE creator_spaces;

-- 4. 重命名新表
ALTER TABLE creator_spaces_new RENAME TO creator_spaces;

-- 5. 重建索引
CREATE UNIQUE INDEX idx_creator_spaces_creator_id ON creator_spaces(creator_id);
CREATE INDEX idx_creator_spaces_deleted_at ON creator_spaces(deleted_at);

COMMIT;
