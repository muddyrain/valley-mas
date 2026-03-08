-- 添加 storage_key 字段到 resources 表
-- 用于存储对象存储的完整路径（Key）

-- 添加字段
ALTER TABLE resources ADD COLUMN storage_key VARCHAR(500) DEFAULT '' AFTER url;

-- 为现有数据填充 storage_key（从 URL 提取）
-- 格式: https://bucket.tos-cn-beijing.volces.com/avatars/123.jpg -> avatars/123.jpg
UPDATE resources 
SET storage_key = SUBSTRING(url, LOCATE('volces.com/', url) + 11)
WHERE storage_key = '' AND url LIKE '%volces.com/%';

-- 添加注释
ALTER TABLE resources MODIFY COLUMN url VARCHAR(500) COMMENT '访问 URL（可能是 CDN 域名）';
ALTER TABLE resources MODIFY COLUMN storage_key VARCHAR(500) COMMENT '对象存储键名（如：wallpaper/users/123/202603/xxx.jpg）';
