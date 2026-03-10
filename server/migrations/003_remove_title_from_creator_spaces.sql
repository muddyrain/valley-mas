-- 003: 移除 creator_spaces 表的 title 和 code 字段
-- 原因：空间名称使用创作者名称，口令使用创作者的 code，不需要单独的字段

-- SQLite 不支持直接 DROP COLUMN，需要重建表
BEGIN TRANSACTION;

-- 1. 创建新表结构（不包含 title 和 code）
CREATE TABLE IF NOT EXISTS "creator_spaces_new" (
    `id` INTEGER,
    `creator_id` INTEGER,
    `description` TEXT,
    `banner` TEXT,
    `is_active` NUMERIC DEFAULT true,
    `view_count` INTEGER DEFAULT 0,
    `created_at` DATETIME,
    `updated_at` DATETIME,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_creators_space` FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`)
);

-- 2. 复制数据（不包含 title 和 code）
INSERT INTO creator_spaces_new (
    id, creator_id, description, banner, is_active, view_count, 
    created_at, updated_at, deleted_at
)
SELECT 
    id, creator_id, description, banner, is_active, view_count,
    created_at, updated_at, deleted_at
FROM creator_spaces;

-- 3. 删除旧表
DROP TABLE creator_spaces;

-- 4. 重命名新表
ALTER TABLE creator_spaces_new RENAME TO creator_spaces;

-- 5. 重建索引
CREATE UNIQUE INDEX `idx_creator_spaces_creator_id` ON `creator_spaces`(`creator_id`);
CREATE INDEX `idx_creator_spaces_deleted_at` ON `creator_spaces`(`deleted_at`);

COMMIT;
