-- 057: owner-private contextual workbench copilot sessions and reviewed proposals.
CREATE TABLE IF NOT EXISTS ai_workbench_copilot_sessions (
  id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, scope VARCHAR(20) NOT NULL,
  target_id VARCHAR(80) NOT NULL DEFAULT '', title VARCHAR(120) NOT NULL DEFAULT 'AI 协作',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_workbench_copilot_target UNIQUE (user_id, scope, target_id)
);

CREATE TABLE IF NOT EXISTS ai_workbench_copilot_messages (
  id BIGINT PRIMARY KEY, session_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  role VARCHAR(20) NOT NULL, kind VARCHAR(20) NOT NULL DEFAULT 'text', content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workbench_copilot_messages_session_created
  ON ai_workbench_copilot_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS ai_workbench_change_proposals (
  id BIGINT PRIMARY KEY, session_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  target_type VARCHAR(20) NOT NULL, target_id VARCHAR(80) NOT NULL DEFAULT '',
  base_hash VARCHAR(64) NOT NULL, candidate TEXT NOT NULL, diff TEXT NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_workbench_change_proposal_status
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded'))
);
CREATE INDEX IF NOT EXISTS idx_workbench_change_proposals_session_created
  ON ai_workbench_change_proposals(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workbench_change_proposals_status
  ON ai_workbench_change_proposals(status);
