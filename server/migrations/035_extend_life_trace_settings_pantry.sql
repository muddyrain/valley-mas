ALTER TABLE life_trace_settings
ADD COLUMN IF NOT EXISTS active_pantry_household_id BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS pantry_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pantry_reminder_rules TEXT NOT NULL DEFAULT '["7d","3d","same-day","expired"]',
ADD COLUMN IF NOT EXISTS pantry_reminder_time VARCHAR(20) NOT NULL DEFAULT '09:00';

UPDATE life_trace_settings
SET active_pantry_household_id = 0
WHERE active_pantry_household_id IS NULL;

UPDATE life_trace_settings
SET pantry_reminder_rules = '["7d","3d","same-day","expired"]'
WHERE pantry_reminder_rules IS NULL OR pantry_reminder_rules = '';

UPDATE life_trace_settings
SET pantry_reminder_time = '09:00'
WHERE pantry_reminder_time IS NULL OR pantry_reminder_time = '';

CREATE INDEX IF NOT EXISTS idx_life_trace_settings_active_pantry_household_id
ON life_trace_settings (active_pantry_household_id);
