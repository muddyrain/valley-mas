-- +goose Up
-- Retire optional Life Trace modules. Keep plans, traces, inventory, shopping
-- and closet data, including the plain-text location on historical records.
ALTER TABLE IF EXISTS life_trace_plans DROP COLUMN IF EXISTS place_id;
ALTER TABLE IF EXISTS life_trace_traces DROP COLUMN IF EXISTS place_id;
ALTER TABLE IF EXISTS life_trace_traces DROP COLUMN IF EXISTS media_diary_id;
ALTER TABLE IF EXISTS life_trace_settings DROP COLUMN IF EXISTS subscription_reminder_enabled;
ALTER TABLE IF EXISTS life_trace_settings DROP COLUMN IF EXISTS subscription_reminder_rules;
ALTER TABLE IF EXISTS life_trace_settings DROP COLUMN IF EXISTS subscription_reminder_time;

DROP TABLE IF EXISTS life_trace_recurring_payment_deliveries;
DROP TABLE IF EXISTS life_trace_ledger_entries;
DROP TABLE IF EXISTS life_trace_recurring_payments;
DROP TABLE IF EXISTS life_trace_inbox_items;
DROP TABLE IF EXISTS life_trace_media_diary_entries;
DROP TABLE IF EXISTS life_trace_places;
