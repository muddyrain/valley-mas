CREATE TABLE IF NOT EXISTS life_trace_holiday_calendars (
    id BIGINT PRIMARY KEY,
    country VARCHAR(8) NOT NULL,
    year INTEGER NOT NULL,
    source_name VARCHAR(160),
    source_url VARCHAR(500),
    payload TEXT NOT NULL,
    synced_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_life_trace_holiday_calendar
ON life_trace_holiday_calendars (country, year);

CREATE INDEX IF NOT EXISTS idx_life_trace_holiday_calendars_deleted_at
ON life_trace_holiday_calendars (deleted_at);
