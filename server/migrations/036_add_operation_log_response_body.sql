ALTER TABLE operation_logs
ADD COLUMN IF NOT EXISTS response_body TEXT;
