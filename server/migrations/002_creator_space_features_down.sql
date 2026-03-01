-- ============================================================================
-- 回滚脚本：002_creator_space_features_down.sql
-- 创建时间：2026-03-01
-- 功能说明：回滚创作者空间功能（口令系统）
-- ============================================================================

-- ⚠️ 警告：回滚操作会删除数据！
-- 执行前请确认：
-- 1. 你真的需要回滚吗？
-- 2. 是否已备份重要数据？
-- 3. 是否在正确的环境（开发/测试）？

-- ============================================================================
-- Part 1: 删除口令访问日志表
-- ============================================================================

-- 先删除索引
DROP INDEX IF EXISTS idx_cal_creator_id;
DROP INDEX IF EXISTS idx_cal_user_id;
DROP INDEX IF EXISTS idx_cal_code;
DROP INDEX IF EXISTS idx_cal_accessed_at;
DROP INDEX IF EXISTS idx_cal_ip_address;
DROP INDEX IF EXISTS idx_cal_creator_time;
DROP INDEX IF EXISTS idx_cal_ip_creator;

-- 删除表（会删除所有访问日志数据）
DROP TABLE IF EXISTS code_access_logs;

-- ============================================================================
-- Part 2: 删除 creators 表的新增字段
-- ============================================================================

-- 注意：SQLite 不支持 DROP COLUMN，需要重建表
-- 如果需要完整回滚，建议备份数据后重新创建表

-- 临时方案：将新增字段设置为 NULL（不删除列）
UPDATE creators SET code_expire_at = NULL;
UPDATE creators SET code_max_uses = 0;
UPDATE creators SET code_used_count = 0;
UPDATE creators SET space_title = '';
UPDATE creators SET space_banner = '';
UPDATE creators SET space_description = '';
UPDATE creators SET view_count = 0;
UPDATE creators SET download_count = 0;
UPDATE creators SET revenue = 0;

-- 删除索引
DROP INDEX IF EXISTS idx_creators_view_count;
DROP INDEX IF EXISTS idx_creators_revenue;

-- ============================================================================
-- 完整回滚方案（需要重建表）
-- ============================================================================

-- 如果需要彻底删除列，执行以下步骤：

-- 1. 备份原有数据
-- CREATE TABLE creators_backup AS 
-- SELECT id, user_id, name, description, avatar, code, is_active, created_at, updated_at 
-- FROM creators;

-- 2. 删除原表
-- DROP TABLE creators;

-- 3. 重建表（只包含原始字段）
-- CREATE TABLE creators (
--     id INTEGER PRIMARY KEY,
--     user_id INTEGER NOT NULL,
--     name VARCHAR(50) NOT NULL,
--     description VARCHAR(255),
--     avatar VARCHAR(255),
--     code VARCHAR(20) UNIQUE NOT NULL,
--     is_active BOOLEAN DEFAULT true,
--     created_at DATETIME NOT NULL,
--     updated_at DATETIME NOT NULL,
--     deleted_at DATETIME,
--     
--     FOREIGN KEY (user_id) REFERENCES users(id)
-- );

-- 4. 恢复数据
-- INSERT INTO creators SELECT * FROM creators_backup;

-- 5. 删除备份表
-- DROP TABLE creators_backup;

-- ============================================================================
-- 回滚完成！
-- ============================================================================

-- 验证回滚是否成功：
-- SELECT sql FROM sqlite_master WHERE name = 'creators';
-- SELECT sql FROM sqlite_master WHERE name = 'code_access_logs';

