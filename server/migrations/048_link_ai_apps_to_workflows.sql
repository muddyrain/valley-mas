-- 048: bridge legacy workflow records into the AI application asset model.
ALTER TABLE ai_apps ADD COLUMN IF NOT EXISTS workflow_id BIGINT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_ai_apps_workflow_id ON ai_apps(workflow_id);
