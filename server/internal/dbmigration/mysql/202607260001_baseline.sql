-- +goose Up
-- Managed migration baseline.
-- Historical migrations through 070 are intentionally not replayed because
-- the legacy directory contains duplicate versions and mixed SQL dialects.

DROP PROCEDURE IF EXISTS valley_managed_add_column_if_missing;
-- +goose StatementBegin
CREATE PROCEDURE valley_managed_add_column_if_missing(
  IN target_table VARCHAR(64),
  IN target_column VARCHAR(64),
  IN column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = target_table
      AND column_name = target_column
  ) THEN
    SET @valley_managed_ddl = CONCAT(
      'ALTER TABLE `',
      REPLACE(target_table, '`', '``'),
      '` ADD COLUMN `',
      REPLACE(target_column, '`', '``'),
      '` ',
      column_definition
    );
    PREPARE valley_managed_statement FROM @valley_managed_ddl;
    EXECUTE valley_managed_statement;
    DEALLOCATE PREPARE valley_managed_statement;
  END IF;
END;
-- +goose StatementEnd

DROP PROCEDURE IF EXISTS valley_managed_add_index_if_missing;
-- +goose StatementBegin
CREATE PROCEDURE valley_managed_add_index_if_missing(
  IN target_table VARCHAR(64),
  IN target_index VARCHAR(64),
  IN index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = target_table
      AND index_name = target_index
  ) THEN
    SET @valley_managed_ddl = CONCAT(
      'ALTER TABLE `',
      REPLACE(target_table, '`', '``'),
      '` ADD ',
      index_definition
    );
    PREPARE valley_managed_statement FROM @valley_managed_ddl;
    EXECUTE valley_managed_statement;
    DEALLOCATE PREPARE valley_managed_statement;
  END IF;
END;
-- +goose StatementEnd
