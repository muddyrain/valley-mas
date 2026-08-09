-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_motion_sticker_generations', 'generation_mode', "VARCHAR(16) NOT NULL DEFAULT 'video'"
);

CALL valley_managed_add_column_if_missing(
  'ai_motion_sticker_generations', 'image_protocol', "VARCHAR(40) NOT NULL DEFAULT 'auto'"
);

CALL valley_managed_add_column_if_missing(
  'ai_motion_sticker_generations', 'frame_count', "INT NOT NULL DEFAULT 0"
);
