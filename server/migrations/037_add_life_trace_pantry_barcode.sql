ALTER TABLE IF EXISTS life_trace_pantry_items
ADD COLUMN IF NOT EXISTS barcode_value VARCHAR(120),
ADD COLUMN IF NOT EXISTS barcode_format VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_barcode_value
ON life_trace_pantry_items (barcode_value);
