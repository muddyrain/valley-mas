-- +goose Up
CREATE TABLE IF NOT EXISTS ai_canvas_documents (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  aspect_ratio VARCHAR(10) NOT NULL,
  document_json LONGTEXT NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE INDEX uidx_ai_canvas_documents_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
