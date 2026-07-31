-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_app_conversation_messages', 'reference_image_count', 'INTEGER NOT NULL DEFAULT 0'
);
CALL valley_managed_add_column_if_missing(
  'ai_app_conversation_messages', 'image_generation_ids', 'TEXT NOT NULL'
);
