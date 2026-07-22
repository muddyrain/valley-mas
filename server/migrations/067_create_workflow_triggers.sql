-- 067: owner-private cron schedules for published, side-effect-free workflows.
-- Jobs and distributed leases are introduced in the following P14.1 migration.

CREATE TABLE IF NOT EXISTS workflow_triggers (
  id BIGINT PRIMARY KEY,
  workflow_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'cron',
  cron_expression VARCHAR(120) NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Shanghai',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  next_run_at TIMESTAMPTZ NULL,
  last_run_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_owner_workflow
  ON workflow_triggers (user_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_status_next_run
  ON workflow_triggers (status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_deleted_at
  ON workflow_triggers (deleted_at);
