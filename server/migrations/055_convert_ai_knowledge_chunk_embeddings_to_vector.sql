-- 055: repair legacy knowledge chunk embeddings created as text before pgvector was enforced.
CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute AS attributes
    JOIN pg_class AS tables ON tables.oid = attributes.attrelid
    JOIN pg_namespace AS schemas ON schemas.oid = tables.relnamespace
    WHERE schemas.nspname = current_schema()
      AND tables.relname = 'ai_knowledge_chunks'
      AND attributes.attname = 'embedding'
      AND attributes.attnum > 0
      AND NOT attributes.attisdropped
      AND attributes.atttypid = 'text'::regtype
  ) THEN
    ALTER TABLE ai_knowledge_chunks
      ALTER COLUMN embedding TYPE vector
      USING NULLIF(BTRIM(embedding), '')::vector;
  END IF;
END $$;
