ALTER TABLE life_trace_settings
ADD COLUMN IF NOT EXISTS workday_mode VARCHAR(20) NOT NULL DEFAULT 'legal',
ADD COLUMN IF NOT EXISTS workdays TEXT NOT NULL DEFAULT '["1","2","3","4","5"]',
ADD COLUMN IF NOT EXISTS holiday_sync BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS weekend_reminders BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plan_reminder_lead_minutes INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS quiet_start VARCHAR(20) NOT NULL DEFAULT '22:30',
ADD COLUMN IF NOT EXISTS quiet_end VARCHAR(20) NOT NULL DEFAULT '07:30';

UPDATE life_trace_settings
SET workday_mode = 'legal'
WHERE workday_mode IS NULL OR workday_mode = '';

UPDATE life_trace_settings
SET workdays = '["1","2","3","4","5"]'
WHERE workdays IS NULL OR workdays = '';

UPDATE life_trace_settings
SET plan_reminder_lead_minutes = 10
WHERE plan_reminder_lead_minutes IS NULL OR plan_reminder_lead_minutes <= 0;

UPDATE life_trace_settings
SET quiet_start = '22:30'
WHERE quiet_start IS NULL OR quiet_start = '';

UPDATE life_trace_settings
SET quiet_end = '07:30'
WHERE quiet_end IS NULL OR quiet_end = '';
