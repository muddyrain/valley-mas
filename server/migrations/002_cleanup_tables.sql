-- 清理和优化表结构
-- 执行时间: 2026-03-10

-- 1. 清空 download_records 表（保留表结构，清除测试数据）
DELETE FROM download_records;

-- 2. 删除 upload_records 表（已不再使用）
DROP TABLE IF EXISTS upload_records;

-- 注意: space_resources 表仍在使用，不做任何操作
