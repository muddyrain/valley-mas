-- +goose Up
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ai_app_conversation_tool_traces'
    AND COLUMN_NAME = 'narration'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE ai_app_conversation_tool_traces ADD COLUMN narration TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE ai_app_conversation_tool_traces SET narration = '' WHERE narration IS NULL;
ALTER TABLE ai_app_conversation_tool_traces MODIFY narration TEXT NOT NULL;
