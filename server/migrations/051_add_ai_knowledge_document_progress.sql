-- 051: Persist user-visible indexing progress for private knowledge documents.
ALTER TABLE ai_knowledge_documents ADD COLUMN IF NOT EXISTS index_progress INT NOT NULL DEFAULT 0;
UPDATE ai_knowledge_documents SET index_progress = 100 WHERE status = 'ready' AND index_progress < 100;
