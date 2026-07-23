ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS image_protocol VARCHAR(40) NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS verified_capabilities TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_message VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_ai_models_verification_status
  ON ai_models (verification_status);

UPDATE ai_models
SET capabilities = REPLACE(capabilities, '"image_edit"', '"reference_image"')
WHERE capabilities LIKE '%"image_edit"%';
