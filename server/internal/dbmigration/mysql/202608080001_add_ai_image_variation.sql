-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'variation_mode', "VARCHAR(20) NOT NULL DEFAULT 'precise'"
);

CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'variation_seed', "VARCHAR(40) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'variation_prompt', "TEXT NOT NULL"
);

CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'subject_context', "TEXT NOT NULL"
);
