-- 创建创作者申请表
CREATE TABLE IF NOT EXISTS creator_applications (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    avatar VARCHAR(255),
    reason TEXT NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    reviewer_id INTEGER,
    review_note TEXT,
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id ON creator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON creator_applications(status);
CREATE INDEX IF NOT EXISTS idx_creator_applications_reviewer_id ON creator_applications(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_deleted_at ON creator_applications(deleted_at);
