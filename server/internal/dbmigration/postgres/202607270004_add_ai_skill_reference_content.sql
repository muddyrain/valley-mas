-- +goose Up
ALTER TABLE ai_skills
  ADD COLUMN IF NOT EXISTS reference_content TEXT NOT NULL DEFAULT '';
