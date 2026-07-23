CREATE TABLE IF NOT EXISTS ai_image_generations (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  model_catalog_id BIGINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  model VARCHAR(180) NOT NULL,
  preset_id VARCHAR(40) NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio VARCHAR(10) NOT NULL,
  quality VARCHAR(10) NOT NULL,
  requested_size VARCHAR(30) NOT NULL,
  reference_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  stage VARCHAR(20) NOT NULL DEFAULT 'preparing',
  result_url VARCHAR(1000) NOT NULL DEFAULT '',
  result_storage_key VARCHAR(500) NOT NULL DEFAULT '',
  result_width INT NOT NULL DEFAULT 0,
  result_height INT NOT NULL DEFAULT 0,
  result_size BIGINT NOT NULL DEFAULT 0,
  resource_id BIGINT NULL,
  error_code VARCHAR(80) NOT NULL DEFAULT '',
  error_message VARCHAR(500) NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_image_generations_owner_created
  ON ai_image_generations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_image_generations_status
  ON ai_image_generations (status);
CREATE INDEX IF NOT EXISTS idx_ai_image_generations_model_catalog_id
  ON ai_image_generations (model_catalog_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_generations_resource_id
  ON ai_image_generations (resource_id);
