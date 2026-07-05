-- 补救脚本：回填 resources.tags 字段
-- 适用于迁移 042 未执行、但旧表 resource_tags / resource_tag_relations 仍存在的情况
-- 执行前请先手动确认旧表存在：
--   SELECT count(*) FROM resource_tag_relations;
--   SELECT count(*) FROM resource_tags WHERE deleted_at IS NULL;

-- 如果 tags 列不存在则添加（GORM AutoMigrate 通常已创建）
ALTER TABLE resources ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]';

-- 回填：将旧关联表中的标签名聚合为 JSON 数组字符串写入 resources.tags
-- 仅更新 tags 为 NULL 或空数组的资源
UPDATE resources r
SET tags = sub.names
FROM (
    SELECT rel.resource_id,
           '[' || string_agg('"' || replace(rt.name, '"', '\"') || '"', ',') || ']' AS names
    FROM resource_tag_relations rel
    INNER JOIN resource_tags rt ON rt.id = rel.tag_id AND rt.deleted_at IS NULL
    GROUP BY rel.resource_id
) sub
WHERE r.id = sub.resource_id
  AND (r.tags IS NULL OR r.tags = '[]');

-- 将剩余 tags IS NULL 的资源设为空数组
UPDATE resources SET tags = '[]' WHERE tags IS NULL;

-- 验证回填结果（执行后检查输出）
-- SELECT id, tags FROM resources WHERE tags != '[]' LIMIT 10;

-- ⚠️ 确认回填无误后，再手动删除旧表（建议先备份）：
-- DROP TABLE IF EXISTS resource_tag_relations;
-- DROP TABLE IF EXISTS resource_tags;
