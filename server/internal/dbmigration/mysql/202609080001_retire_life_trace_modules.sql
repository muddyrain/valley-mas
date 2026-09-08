-- +goose Up
-- Retire optional Life Trace modules. Keep plans, traces, inventory, shopping
-- and closet data, including the plain-text location on historical records.
DROP PROCEDURE IF EXISTS valley_retire_life_trace_column;
-- +goose StatementBegin
CREATE PROCEDURE valley_retire_life_trace_column(
  IN target_table VARCHAR(64),
  IN target_column VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = target_table
      AND column_name = target_column
  ) THEN
    SET @valley_retire_ddl = CONCAT(
      'ALTER TABLE `', REPLACE(target_table, '`', '``'),
      '` DROP COLUMN `', REPLACE(target_column, '`', '``'), '`'
    );
    PREPARE valley_retire_statement FROM @valley_retire_ddl;
    EXECUTE valley_retire_statement;
    DEALLOCATE PREPARE valley_retire_statement;
  END IF;
END;
-- +goose StatementEnd

CALL valley_retire_life_trace_column('life_trace_plans', 'place_id');
CALL valley_retire_life_trace_column('life_trace_traces', 'place_id');
CALL valley_retire_life_trace_column('life_trace_traces', 'media_diary_id');
CALL valley_retire_life_trace_column('life_trace_settings', 'subscription_reminder_enabled');
CALL valley_retire_life_trace_column('life_trace_settings', 'subscription_reminder_rules');
CALL valley_retire_life_trace_column('life_trace_settings', 'subscription_reminder_time');
DROP PROCEDURE valley_retire_life_trace_column;

DROP TABLE IF EXISTS life_trace_recurring_payment_deliveries;
DROP TABLE IF EXISTS life_trace_ledger_entries;
DROP TABLE IF EXISTS life_trace_recurring_payments;
DROP TABLE IF EXISTS life_trace_inbox_items;
DROP TABLE IF EXISTS life_trace_media_diary_entries;
DROP TABLE IF EXISTS life_trace_places;
