-- +goose Up
ALTER TABLE ai_image_generations
  ADD COLUMN IF NOT EXISTS style_profile_id VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS style_profile_source VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS style_profile_prompt TEXT NOT NULL DEFAULT '';

UPDATE ai_image_generations
SET
  style_profile_id = 'skill:' || skill_id::text,
  style_profile_source = 'skill'
WHERE skill_id IS NOT NULL
  AND style_profile_id = '';
