CREATE TABLE IF NOT EXISTS life_trace_pantry_items (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT '食品',
    quantity INTEGER NOT NULL DEFAULT 1,
    unit VARCHAR(20) NOT NULL DEFAULT '件',
    location VARCHAR(30) NOT NULL DEFAULT '冷藏',
    expires_at VARCHAR(20),
    opened_at VARCHAR(20),
    note VARCHAR(1000) NOT NULL DEFAULT '',
    image_url VARCHAR(800),
    thumbnail_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'normal',
    reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_use_default BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_rules TEXT NOT NULL DEFAULT '["7d","3d","same-day","expired"]',
    reminder_time VARCHAR(20) NOT NULL DEFAULT '09:00',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE IF EXISTS life_trace_pantry_items
ALTER COLUMN thumbnail_url TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_user_id
ON life_trace_pantry_items (user_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_category
ON life_trace_pantry_items (category);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_location
ON life_trace_pantry_items (location);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_status
ON life_trace_pantry_items (status);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_deleted_at
ON life_trace_pantry_items (deleted_at);

CREATE TABLE IF NOT EXISTS life_trace_pantry_reminder_deliveries (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    pantry_item_id BIGINT NOT NULL,
    rule VARCHAR(20) NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    subscription_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent',
    error VARCHAR(500),
    created_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_life_trace_pantry_delivery
ON life_trace_pantry_reminder_deliveries (user_id, pantry_item_id, rule, due_at, subscription_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_reminder_deliveries_pantry_item_id
ON life_trace_pantry_reminder_deliveries (pantry_item_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_reminder_deliveries_due_at
ON life_trace_pantry_reminder_deliveries (due_at);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_reminder_deliveries_subscription_id
ON life_trace_pantry_reminder_deliveries (subscription_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_reminder_deliveries_status
ON life_trace_pantry_reminder_deliveries (status);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_reminder_deliveries_deleted_at
ON life_trace_pantry_reminder_deliveries (deleted_at);
