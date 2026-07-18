-- 058: allow multiple owner-private copilot sessions per asset and safe proposal reverts.
ALTER TABLE ai_workbench_copilot_sessions
  DROP CONSTRAINT IF EXISTS uidx_workbench_copilot_target;

CREATE INDEX IF NOT EXISTS idx_workbench_copilot_target_updated
  ON ai_workbench_copilot_sessions(user_id, scope, target_id, updated_at DESC);

ALTER TABLE ai_workbench_change_proposals
  ADD COLUMN IF NOT EXISTS base_draft TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS candidate_hash VARCHAR(64) NOT NULL DEFAULT '';

ALTER TABLE ai_workbench_change_proposals
  DROP CONSTRAINT IF EXISTS chk_workbench_change_proposal_status;

ALTER TABLE ai_workbench_change_proposals
  ADD CONSTRAINT chk_workbench_change_proposal_status
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded', 'reverted'));
