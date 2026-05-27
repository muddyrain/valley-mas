CREATE TABLE IF NOT EXISTS life_trace_settings (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    city VARCHAR(80) NOT NULL DEFAULT '上海',
    work_start VARCHAR(20) NOT NULL DEFAULT '09:30',
    work_end VARCHAR(20) NOT NULL DEFAULT '18:30',
    commute_method VARCHAR(20) NOT NULL DEFAULT '开车',
    daily_brief_time VARCHAR(20) NOT NULL DEFAULT '08:10',
    weather_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    plan_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    ai_personalization BOOLEAN NOT NULL DEFAULT TRUE,
    habits TEXT NOT NULL DEFAULT '["喝水","休息","运动","护肤"]',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_life_trace_settings_user_id
ON life_trace_settings (user_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_settings_deleted_at
ON life_trace_settings (deleted_at);
