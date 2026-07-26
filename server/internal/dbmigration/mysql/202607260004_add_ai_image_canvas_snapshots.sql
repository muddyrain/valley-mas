-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'preset_name', 'VARCHAR(100) NOT NULL DEFAULT '''''
);
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'preset_prompt', 'TEXT NULL'
);
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'canvas_snapshot_url', 'VARCHAR(1000) NOT NULL DEFAULT '''''
);
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'canvas_snapshot_storage_key', 'VARCHAR(500) NOT NULL DEFAULT '''''
);
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'canvas_snapshot_width', 'INT NOT NULL DEFAULT 0'
);
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'canvas_snapshot_height', 'INT NOT NULL DEFAULT 0'
);

UPDATE ai_image_generations
SET preset_prompt = ''
WHERE preset_prompt IS NULL;

ALTER TABLE ai_image_generations
  MODIFY preset_prompt TEXT NOT NULL;

CALL valley_managed_add_index_if_missing(
  'ai_image_generations',
  'idx_ai_image_generations_resource_id',
  'INDEX `idx_ai_image_generations_resource_id` (`resource_id`)'
);
