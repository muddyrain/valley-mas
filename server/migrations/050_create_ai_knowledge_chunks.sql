-- 050: RAG document metadata and segments. This migration requires PostgreSQL + pgvector.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE ai_knowledge_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120) DEFAULT '';
ALTER TABLE ai_knowledge_documents ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ai_knowledge_documents ADD COLUMN IF NOT EXISTS source_key VARCHAR(500) DEFAULT '';
ALTER TABLE ai_knowledge_documents ADD COLUMN IF NOT EXISTS parsed_text TEXT DEFAULT '';
ALTER TABLE ai_app_runs ADD COLUMN IF NOT EXISTS "references" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id BIGINT PRIMARY KEY,
  document_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  position INT NOT NULL,
  content TEXT NOT NULL,
  token_count INT NOT NULL DEFAULT 0,
  embedding vector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uidx_ai_knowledge_chunk UNIQUE(document_id, position)
);
ALTER TABLE ai_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector;
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_user_document ON ai_knowledge_chunks(user_id, document_id);
