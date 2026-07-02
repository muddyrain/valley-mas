-- 将资源标签从独立表 + 多对多关联表下沉到 resources.tags 字段
-- 标签仅作为 JSON 数组字符串存储于 resources.tags（跨 Postgres/MySQL 通用）
-- 数据不可逆：resource_tags 和 resource_tag_relations 会被 DROP

-- 1. 给 resources 表增加 tags 字段（JSON 字符串，跨库兼容 StringList 序列化）
ALTER TABLE resources ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]';

-- 2. 将 resource_tag_relations + resource_tags 的标签名回填到 resources.tags
--    以 JSON 数组字符串写入，与 Go 侧 model.StringList 的 Scan/Value 逻辑一致
--    Postgres 语法（当前默认驱动）
UPDATE resources r
SET tags = COALESCE(sub.names, '[]')
FROM (
    SELECT rel.resource_id,
           '[' || string_agg('"' || replace(rt.name, '"', '\"') || '"', ',') || ']' AS names
    FROM resource_tag_relations rel
    INNER JOIN resource_tags rt ON rt.id = rel.tag_id AND rt.deleted_at IS NULL
    GROUP BY rel.resource_id
) sub
WHERE r.id = sub.resource_id;

-- 3. 删除旧的关联表和标签表
DROP TABLE IF EXISTS resource_tag_relations;
DROP TABLE IF EXISTS resource_tags;
