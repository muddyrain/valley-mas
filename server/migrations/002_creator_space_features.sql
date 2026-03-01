-- ============================================================================
-- 迁移脚本：002_creator_space_features.sql
-- 创建时间：2026-03-01
-- 功能说明：添加创作者空间功能（口令系统）
-- 依赖版本：001_update_users_table.sql
-- ============================================================================

-- 为什么需要这个迁移？
-- 1. 实现创作者口令生成与验证功能
-- 2. 支持创作者自定义空间信息（标题、横幅、描述）
-- 3. 添加口令使用限制（过期时间、最大使用次数）
-- 4. 记录口令访问日志，用于统计分析
-- 5. 添加收益字段，为后续广告变现做准备

-- ============================================================================
-- Part 1: 扩展 creators 表
-- ============================================================================

-- 口令配置字段
-- code_expire_at: 口令过期时间（NULL = 永久有效）
-- code_max_uses: 最大使用次数（0 = 无限制）
-- code_used_count: 已使用次数（用于统计和限制判断）
ALTER TABLE creators ADD COLUMN code_expire_at DATETIME DEFAULT NULL;
ALTER TABLE creators ADD COLUMN code_max_uses INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN code_used_count INTEGER DEFAULT 0;

-- 创作者空间自定义配置
-- space_title: 空间标题（如："精美壁纸合集"）
-- space_banner: 空间横幅图片 URL
-- space_description: 空间描述文案
ALTER TABLE creators ADD COLUMN space_title VARCHAR(100) DEFAULT '';
ALTER TABLE creators ADD COLUMN space_banner VARCHAR(500) DEFAULT '';
ALTER TABLE creators ADD COLUMN space_description TEXT DEFAULT '';

-- 统计数据字段
-- view_count: 浏览次数（每次验证口令 +1）
-- download_count: 下载次数（每次下载资源 +1，Phase 3 实现）
-- revenue: 累计收益（单位：分，100分 = 1元）
ALTER TABLE creators ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN download_count INTEGER DEFAULT 0;
ALTER TABLE creators ADD COLUMN revenue INTEGER DEFAULT 0;

-- 为统计查询添加索引
CREATE INDEX idx_creators_view_count ON creators(view_count DESC);
CREATE INDEX idx_creators_revenue ON creators(revenue DESC);

-- ============================================================================
-- Part 2: 创建口令访问日志表
-- ============================================================================

-- 用途：
-- 1. 记录每次口令验证的详细信息
-- 2. 用于统计分析（访问来源、时间分布）
-- 3. 防刷检测（同一 IP 短时间内多次访问）
-- 4. 用户行为分析（哪些用户访问了哪些创作者空间）

CREATE TABLE code_access_logs (
    id INTEGER PRIMARY KEY,                    -- Snowflake ID
    creator_id INTEGER NOT NULL,               -- 创作者 ID（外键）
    user_id INTEGER DEFAULT NULL,              -- 用户 ID（如果已登录）
    code VARCHAR(20) NOT NULL,                 -- 使用的口令
    ip_address VARCHAR(50) NOT NULL,           -- 访问者 IP
    user_agent VARCHAR(500),                   -- 浏览器 User-Agent
    accessed_at DATETIME NOT NULL,             -- 访问时间
    
    FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 为高频查询添加索引
CREATE INDEX idx_cal_creator_id ON code_access_logs(creator_id);
CREATE INDEX idx_cal_user_id ON code_access_logs(user_id);
CREATE INDEX idx_cal_code ON code_access_logs(code);
CREATE INDEX idx_cal_accessed_at ON code_access_logs(accessed_at DESC);
CREATE INDEX idx_cal_ip_address ON code_access_logs(ip_address);

-- 组合索引：用于统计某个创作者在某个时间段的访问量
CREATE INDEX idx_cal_creator_time ON code_access_logs(creator_id, accessed_at DESC);

-- 组合索引：用于防刷检测（同一 IP + 同一创作者）
CREATE INDEX idx_cal_ip_creator ON code_access_logs(ip_address, creator_id, accessed_at DESC);

-- ============================================================================
-- Part 3: 数据初始化（可选）
-- ============================================================================

-- 为现有创作者初始化默认值
-- 注意：如果数据库是全新的，这一步可以跳过

-- 初始化空间标题（使用创作者名称作为默认标题）
UPDATE creators 
SET space_title = name 
WHERE space_title = '' OR space_title IS NULL;

-- 初始化统计数据为 0（防止 NULL 值）
UPDATE creators 
SET view_count = 0 
WHERE view_count IS NULL;

UPDATE creators 
SET download_count = 0 
WHERE download_count IS NULL;

UPDATE creators 
SET revenue = 0 
WHERE revenue IS NULL;

UPDATE creators 
SET code_used_count = 0 
WHERE code_used_count IS NULL;

-- ============================================================================
-- 迁移完成！
-- ============================================================================

-- 验证迁移是否成功：
-- SELECT sql FROM sqlite_master WHERE name = 'creators';
-- SELECT sql FROM sqlite_master WHERE name = 'code_access_logs';
-- SELECT * FROM creators LIMIT 1;

-- 下一步：
-- 1. 运行迁移：sqlite3 data/valley.db < migrations/002_creator_space_features.sql
-- 2. 验证字段：在代码中测试 Creator 模型的新字段
-- 3. 实现 API：开始实现口令生成、验证等接口

