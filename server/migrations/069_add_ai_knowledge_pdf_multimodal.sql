-- 069: preserve source PDF bytes and make each knowledge segment traceable to its page and parser.
-- PostgreSQL + pgvector is already required by the knowledge-base retrieval pipeline.
ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS vision_model_id VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_content BYTEA;

ALTER TABLE ai_knowledge_chunks
  ADD COLUMN IF NOT EXISTS page_number INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'text';

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_document_page
  ON ai_knowledge_chunks(document_id, page_number, position);
