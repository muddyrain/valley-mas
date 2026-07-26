-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'parent_generation_id', 'BIGINT NULL'
);

CALL valley_managed_add_index_if_missing(
  'ai_image_generations',
  'idx_ai_image_generations_parent',
  'INDEX `idx_ai_image_generations_parent` (`parent_generation_id`)'
);
