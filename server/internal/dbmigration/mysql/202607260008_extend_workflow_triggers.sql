-- +goose Up
CALL valley_managed_add_column_if_missing(
  'workflow_triggers', 'event_key', 'VARCHAR(100) NOT NULL DEFAULT '''''
);
CALL valley_managed_add_column_if_missing(
  'workflow_triggers', 'secret_hash', 'VARCHAR(64) NOT NULL DEFAULT '''''
);

CALL valley_managed_add_column_if_missing(
  'workflow_run_jobs', 'trigger_type', 'VARCHAR(20) NOT NULL DEFAULT ''cron'''
);
CALL valley_managed_add_column_if_missing(
  'workflow_run_jobs', 'inputs', 'JSON NULL'
);
CALL valley_managed_add_column_if_missing(
  'workflow_run_jobs', 'error_code', 'VARCHAR(80) NOT NULL DEFAULT '''''
);

UPDATE workflow_run_jobs
SET inputs = JSON_OBJECT()
WHERE inputs IS NULL;

ALTER TABLE workflow_run_jobs
  MODIFY inputs JSON NOT NULL;

CALL valley_managed_add_column_if_missing(
  'workflow_runs', 'app_id', 'BIGINT NULL'
);
CALL valley_managed_add_column_if_missing(
  'workflow_runs', 'version_id', 'BIGINT NULL'
);
CALL valley_managed_add_column_if_missing(
  'workflow_runs', 'trigger_id', 'BIGINT NULL'
);
CALL valley_managed_add_column_if_missing(
  'workflow_runs', 'run_job_id', 'BIGINT NULL'
);

CALL valley_managed_add_index_if_missing(
  'workflow_triggers',
  'idx_workflow_triggers_owner_event',
  'INDEX `idx_workflow_triggers_owner_event` (`user_id`, `type`, `event_key`, `status`)'
);
CALL valley_managed_add_index_if_missing(
  'workflow_runs',
  'uidx_workflow_runs_run_job_id',
  'UNIQUE INDEX `uidx_workflow_runs_run_job_id` (`run_job_id`)'
);
CALL valley_managed_add_index_if_missing(
  'workflow_runs',
  'idx_workflow_runs_trigger_id',
  'INDEX `idx_workflow_runs_trigger_id` (`trigger_id`)'
);
