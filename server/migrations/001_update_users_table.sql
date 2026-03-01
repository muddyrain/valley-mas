-- 为支持抖音和微信平台，更新 users 表结构
-- 此迁移脚本应在数据库中执行

-- 添加抖音平台相关字段
ALTER TABLE users ADD COLUMN douyin_openid VARCHAR(100);
ALTER TABLE users ADD COLUMN douyin_unionid VARCHAR(100);
ALTER TABLE users ADD COLUMN douyin_avatar VARCHAR(500);
ALTER TABLE users ADD COLUMN douyin_nickname VARCHAR(100);
ALTER TABLE users ADD COLUMN douyin_gender INT DEFAULT 0;
ALTER TABLE users ADD COLUMN douyin_city VARCHAR(50);
ALTER TABLE users ADD COLUMN douyin_province VARCHAR(50);
ALTER TABLE users ADD COLUMN douyin_country VARCHAR(50);

-- 添加微信平台相关字段
ALTER TABLE users ADD COLUMN wechat_openid VARCHAR(100);
ALTER TABLE users ADD COLUMN wechat_unionid VARCHAR(100);

-- 添加联系信息字段
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN email VARCHAR(100);

-- 修改 role 字段默认值
ALTER TABLE users MODIFY COLUMN role VARCHAR(20) DEFAULT 'user';

-- 创建索引以提高查询性能
CREATE INDEX idx_users_douyin_openid ON users(douyin_openid);
CREATE INDEX idx_users_douyin_unionid ON users(douyin_unionid);
CREATE INDEX idx_users_wechat_openid ON users(wechat_openid);
CREATE INDEX idx_users_wechat_unionid ON users(wechat_unionid);
CREATE INDEX idx_users_platform ON users(platform);
CREATE INDEX idx_users_role ON users(role);

-- 注意：openid 的 uniqueIndex 已更改为普通 index（在 model.go 中）
-- 如果原来有唯一索引，需要删除并重建为普通索引
-- ALTER TABLE users DROP INDEX openid;
-- CREATE INDEX idx_users_openid ON users(openid);
