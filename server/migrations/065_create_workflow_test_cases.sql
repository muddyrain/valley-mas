-- 065: owner-private, version-locked workflow regression cases and results.
-- Test runs retain their own workflow_run trace; neither table mutates the
-- immutable workflow version or its ordinary execution history.

CREATE TABLE IF NOT EXISTS workflow_test_cases (
  id BIGINT PRIMARY KEY,
  workflow_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  version_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  inputs JSON NOT NULL,
  assertions JSON NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_test_cases_owner_workflow
  ON workflow_test_cases (user_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_test_cases_version
  ON workflow_test_cases (version_id);

CREATE TABLE IF NOT EXISTS workflow_test_results (
  id BIGINT PRIMARY KEY,
  workflow_test_case_id BIGINT NOT NULL,
  workflow_run_id BIGINT NULL,
  workflow_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  version_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  output JSON,
  assertion_results JSON,
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_test_results_case_started
  ON workflow_test_results (workflow_test_case_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_test_results_run
  ON workflow_test_results (workflow_run_id);
