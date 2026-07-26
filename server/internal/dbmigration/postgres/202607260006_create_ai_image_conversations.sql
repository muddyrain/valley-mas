-- +goose Up
CREATE TABLE IF NOT EXISTS ai_image_conversations (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_image_conversations_owner_updated
  ON ai_image_conversations (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_image_conversations_deleted_at
  ON ai_image_conversations (deleted_at);

CREATE TABLE IF NOT EXISTS ai_image_conversation_messages (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  generation_id BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_image_conversation_messages_user_id
  ON ai_image_conversation_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_conversation_messages_conversation_id
  ON ai_image_conversation_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_conversation_messages_role
  ON ai_image_conversation_messages (role);
CREATE INDEX IF NOT EXISTS idx_ai_image_conversation_messages_generation_id
  ON ai_image_conversation_messages (generation_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_conversation_messages_created_at
  ON ai_image_conversation_messages (created_at);
