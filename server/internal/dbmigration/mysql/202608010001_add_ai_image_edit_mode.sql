-- +goose Up
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ai_image_generations'
    AND COLUMN_NAME = 'edit_mode'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE ai_image_generations ADD COLUMN edit_mode VARCHAR(30) NOT NULL DEFAULT ''''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
