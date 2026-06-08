ALTER TABLE IF EXISTS life_trace_traces
ADD COLUMN IF NOT EXISTS pantry_item_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_life_trace_traces_pantry_item_id
ON life_trace_traces (pantry_item_id);
