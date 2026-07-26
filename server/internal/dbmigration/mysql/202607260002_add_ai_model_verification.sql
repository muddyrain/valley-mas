-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_models', 'image_protocol', 'VARCHAR(40) NOT NULL DEFAULT ''auto'''
);
CALL valley_managed_add_column_if_missing(
  'ai_models', 'verified_capabilities', 'TEXT NULL'
);
CALL valley_managed_add_column_if_missing(
  'ai_models', 'verification_status', 'VARCHAR(20) NOT NULL DEFAULT ''unverified'''
);
CALL valley_managed_add_column_if_missing(
  'ai_models', 'verification_message', 'VARCHAR(500) NOT NULL DEFAULT '''''
);
CALL valley_managed_add_column_if_missing(
  'ai_models', 'last_verified_at', 'DATETIME(3) NULL'
);

UPDATE ai_models
SET verified_capabilities = '[]'
WHERE verified_capabilities IS NULL OR verified_capabilities = '';

ALTER TABLE ai_models
  MODIFY verified_capabilities TEXT NOT NULL;

CALL valley_managed_add_index_if_missing(
  'ai_models',
  'idx_ai_models_verification_status',
  'INDEX `idx_ai_models_verification_status` (`verification_status`)'
);

UPDATE ai_models
SET capabilities = REPLACE(capabilities, '"image_edit"', '"reference_image"')
WHERE capabilities LIKE '%"image_edit"%';
