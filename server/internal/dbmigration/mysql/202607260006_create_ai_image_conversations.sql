-- +goose Up
CREATE TABLE IF NOT EXISTS ai_image_conversations (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_ai_image_conversations_owner_updated (user_id, updated_at),
  INDEX idx_ai_image_conversations_deleted_at (deleted_at)
);

CREATE TABLE IF NOT EXISTS ai_image_conversation_messages (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  generation_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_ai_image_conversation_messages_user_id (user_id),
  INDEX idx_ai_image_conversation_messages_conversation_id (conversation_id),
  INDEX idx_ai_image_conversation_messages_role (role),
  INDEX idx_ai_image_conversation_messages_generation_id (generation_id),
  INDEX idx_ai_image_conversation_messages_created_at (created_at)
);

CALL valley_managed_add_index_if_missing(
  'ai_image_conversations',
  'idx_ai_image_conversations_owner_updated',
  'INDEX `idx_ai_image_conversations_owner_updated` (`user_id`, `updated_at`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_image_conversations',
  'idx_ai_image_conversations_deleted_at',
  'INDEX `idx_ai_image_conversations_deleted_at` (`deleted_at`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_image_conversation_messages',
  'idx_ai_image_conversation_messages_user_id',
  'INDEX `idx_ai_image_conversation_messages_user_id` (`user_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_image_conversation_messages',
  'idx_ai_image_conversation_messages_conversation_id',
  'INDEX `idx_ai_image_conversation_messages_conversation_id` (`conversation_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_image_conversation_messages',
  'idx_ai_image_conversation_messages_role',
  'INDEX `idx_ai_image_conversation_messages_role` (`role`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_image_conversation_messages',
  'idx_ai_image_conversation_messages_generation_id',
  'INDEX `idx_ai_image_conversation_messages_generation_id` (`generation_id`)'
);
CALL valley_managed_add_index_if_missing(
  'ai_image_conversation_messages',
  'idx_ai_image_conversation_messages_created_at',
  'INDEX `idx_ai_image_conversation_messages_created_at` (`created_at`)'
);
