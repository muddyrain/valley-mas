-- 064: replayable, owner-private lifecycle events for workbench copilot runs.
-- The table intentionally excludes prompts and model replies. Those remain in
-- ai_workbench_copilot_messages, while events only carry safe status labels.
CREATE TABLE IF NOT EXISTS ai_workbench_copilot_run_events (
  id BIGINT PRIMARY KEY,
  run_id BIGINT NOT NULL,
  sequence BIGINT NOT NULL,
  event_type VARCHAR(24) NOT NULL,
  stage VARCHAR(40) NOT NULL DEFAULT '',
  message VARCHAR(500) NOT NULL DEFAULT '',
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_workbench_copilot_run_event_sequence
  ON ai_workbench_copilot_run_events (run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_workbench_copilot_run_events_created
  ON ai_workbench_copilot_run_events (run_id, created_at ASC);
