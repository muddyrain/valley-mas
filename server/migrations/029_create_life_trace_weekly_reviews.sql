CREATE TABLE IF NOT EXISTS life_trace_weekly_reviews (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    week_start VARCHAR(20) NOT NULL,
    week_end VARCHAR(20) NOT NULL,
    summary VARCHAR(1000) NOT NULL,
    wins TEXT NOT NULL DEFAULT '[]',
    delays TEXT NOT NULL DEFAULT '[]',
    insights TEXT NOT NULL DEFAULT '[]',
    next_actions TEXT NOT NULL DEFAULT '[]',
    source VARCHAR(20) NOT NULL,
    model VARCHAR(120),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_life_trace_weekly_review
ON life_trace_weekly_reviews (user_id, week_start);

CREATE INDEX IF NOT EXISTS idx_life_trace_weekly_reviews_user_week
ON life_trace_weekly_reviews (user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_life_trace_weekly_reviews_deleted_at
ON life_trace_weekly_reviews (deleted_at);
