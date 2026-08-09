-- +goose Up
CREATE TABLE IF NOT EXISTS ai_canvas_documents (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  aspect_ratio VARCHAR(10) NOT NULL,
  document_json JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_ai_canvas_documents_user
  ON ai_canvas_documents (user_id);
