-- 创作者申请 AI 审核配置表（全局单行配置，id=1）
CREATE TABLE IF NOT EXISTS creator_audit_configs (
    id BIGINT PRIMARY KEY,
    strictness INTEGER NOT NULL DEFAULT 20,
    updated_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_creator_audit_configs_updated_by
    ON creator_audit_configs(updated_by);

INSERT INTO creator_audit_configs (id, strictness, created_at, updated_at)
SELECT 1, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM creator_audit_configs WHERE id = 1
);
