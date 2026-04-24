-- 资源上传幂等与短时去重：
-- 1. upload_key：同一用户同一上传动作的幂等键
-- 2. file_hash：同一用户短时间内重复上传同一文件时用于回收已有资源

ALTER TABLE resources
ADD COLUMN IF NOT EXISTS upload_key VARCHAR(80) NOT NULL DEFAULT '';

ALTER TABLE resources
ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64) NOT NULL DEFAULT '';

UPDATE resources
SET upload_key = CONCAT('legacy-', id)
WHERE upload_key IS NULL OR upload_key = '';

UPDATE resources
SET file_hash = ''
WHERE file_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_user_upload_key
ON resources (user_id, upload_key);

CREATE INDEX IF NOT EXISTS idx_resources_user_file_hash_created_at
ON resources (user_id, file_hash, created_at);
