-- +goose Up
ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS embedding_model_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_dimension INTEGER NOT NULL DEFAULT 0;

UPDATE ai_knowledge_documents AS documents
SET status = 'failed',
    error_code = 'RAG_EMBEDDING_REINDEX_REQUIRED',
    index_progress = 0,
    embedding_model_id = 0,
    embedding_dimension = 0
WHERE documents.status = 'ready'
  AND documents.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM ai_knowledge_chunks AS chunks
    WHERE chunks.document_id = documents.id
      AND chunks.deleted_at IS NULL
      AND chunks.embedding IS NOT NULL
  );
