-- 优化公开资源列表查询：
-- 1. 收敛公开列表的筛选条件到 visibility='public'
-- 2. 为公开列表常见路径（visibility + deleted_at + created_at）补复合索引
-- 3. 为用户收藏状态批量查询补更贴近 where 条件的索引

CREATE INDEX IF NOT EXISTS idx_resources_visibility_deleted_created_at
ON resources (visibility, deleted_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_deleted_resource
ON user_favorites (user_id, deleted_at, resource_id);
