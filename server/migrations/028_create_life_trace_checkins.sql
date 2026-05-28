CREATE TABLE IF NOT EXISTS life_trace_checkins (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    date VARCHAR(20) NOT NULL,
    name VARCHAR(80) NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_life_trace_checkin_day_item
ON life_trace_checkins (user_id, date, name);

CREATE INDEX IF NOT EXISTS idx_life_trace_checkins_user_date
ON life_trace_checkins (user_id, date);

CREATE INDEX IF NOT EXISTS idx_life_trace_checkins_completed
ON life_trace_checkins (completed);

CREATE INDEX IF NOT EXISTS idx_life_trace_checkins_deleted_at
ON life_trace_checkins (deleted_at);
