-- +goose Up
ALTER TABLE ai_skills
  ADD COLUMN IF NOT EXISTS script_content TEXT NOT NULL DEFAULT '';
