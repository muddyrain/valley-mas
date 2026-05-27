CREATE TABLE IF NOT EXISTS life_trace_traces (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    plan_id BIGINT NULL,
    title VARCHAR(160) NOT NULL,
    summary VARCHAR(1000) NOT NULL,
    time_label VARCHAR(80) NOT NULL,
    location VARCHAR(120),
    image_url VARCHAR(800),
    mood VARCHAR(30) NOT NULL DEFAULT '放松',
    tags TEXT NOT NULL DEFAULT '[]',
    source VARCHAR(20) NOT NULL DEFAULT '手动',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_life_trace_traces_user_id
ON life_trace_traces (user_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_traces_plan_id
ON life_trace_traces (plan_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_traces_source
ON life_trace_traces (source);

CREATE INDEX IF NOT EXISTS idx_life_trace_traces_deleted_at
ON life_trace_traces (deleted_at);

CREATE INDEX IF NOT EXISTS idx_life_trace_traces_user_created_at
ON life_trace_traces (user_id, created_at DESC);
