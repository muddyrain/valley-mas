-- +goose Up
ALTER TABLE ai_app_conversation_tool_traces
  ADD COLUMN IF NOT EXISTS narration TEXT NOT NULL DEFAULT '';
