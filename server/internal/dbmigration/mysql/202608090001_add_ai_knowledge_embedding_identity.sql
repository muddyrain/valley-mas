-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_knowledge_documents', 'embedding_model_id', 'BIGINT NOT NULL DEFAULT 0'
);
CALL valley_managed_add_column_if_missing(
  'ai_knowledge_documents', 'embedding_dimension', 'INT NOT NULL DEFAULT 0'
);
