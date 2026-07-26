-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'is_favorited', 'TINYINT(1) NOT NULL DEFAULT 0'
);

CALL valley_managed_add_index_if_missing(
  'ai_image_generations',
  'idx_ai_image_generations_is_favorited',
  'INDEX `idx_ai_image_generations_is_favorited` (`is_favorited`)'
);
