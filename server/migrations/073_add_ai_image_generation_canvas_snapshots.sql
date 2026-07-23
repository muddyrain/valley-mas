ALTER TABLE ai_image_generations
  ADD COLUMN IF NOT EXISTS preset_name VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preset_prompt TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canvas_snapshot_url VARCHAR(1000) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canvas_snapshot_storage_key VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canvas_snapshot_width INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canvas_snapshot_height INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_image_generations_resource_id
  ON ai_image_generations (resource_id);
