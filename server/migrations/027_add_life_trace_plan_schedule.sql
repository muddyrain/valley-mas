ALTER TABLE life_trace_plans
ADD COLUMN IF NOT EXISTS scheduled_date VARCHAR(20),
ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(20),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'Asia/Shanghai';

CREATE INDEX IF NOT EXISTS idx_life_trace_plans_scheduled_date
ON life_trace_plans (scheduled_date);

UPDATE life_trace_plans
SET timezone = 'Asia/Shanghai'
WHERE timezone IS NULL OR timezone = '';
