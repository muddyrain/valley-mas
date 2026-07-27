-- +goose Up
CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'style_profile_id', "VARCHAR(120) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'style_profile_source', "VARCHAR(20) NOT NULL DEFAULT ''"
);

CALL valley_managed_add_column_if_missing(
  'ai_image_generations', 'style_profile_prompt', "TEXT NOT NULL"
);

UPDATE ai_image_generations
SET
  style_profile_id = CONCAT('skill:', skill_id),
  style_profile_source = 'skill'
WHERE skill_id IS NOT NULL
  AND style_profile_id = '';
