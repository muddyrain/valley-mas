CREATE TABLE IF NOT EXISTS life_trace_achievements (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    category VARCHAR(30) NOT NULL,
    evidence_type VARCHAR(40),
    evidence_id VARCHAR(80),
    progress INTEGER NOT NULL DEFAULT 0,
    target INTEGER NOT NULL DEFAULT 1,
    ai_comment VARCHAR(500),
    metadata TEXT NOT NULL DEFAULT '{}',
    unlocked_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_life_trace_achievement_user_code
ON life_trace_achievements (user_id, code);

CREATE INDEX IF NOT EXISTS idx_life_trace_achievements_user_unlocked
ON life_trace_achievements (user_id, unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_life_trace_achievements_category
ON life_trace_achievements (category);

CREATE INDEX IF NOT EXISTS idx_life_trace_achievements_deleted_at
ON life_trace_achievements (deleted_at);
