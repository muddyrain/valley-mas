-- +goose Up
-- Removes the agent app surface (conversations, tasks, artifacts, public API
-- keys) and the AI motion sticker queue. The workflow mirror tables
-- (ai_apps, ai_app_versions, ai_app_version_*, ai_app_knowledge_bases,
-- ai_app_tool_bindings, ai_app_runs) stay because workflow runs and
-- knowledge retrieval still depend on them.
DROP TABLE IF EXISTS ai_app_public_invocations;
DROP TABLE IF EXISTS ai_api_key_daily_usages;
DROP TABLE IF EXISTS ai_api_key_app_bindings;
DROP TABLE IF EXISTS ai_api_keys;
DROP TABLE IF EXISTS ai_app_artifacts;
DROP TABLE IF EXISTS ai_app_task_clarifications;
DROP TABLE IF EXISTS ai_app_tool_approvals;
DROP TABLE IF EXISTS ai_app_tasks;
DROP TABLE IF EXISTS ai_app_conversation_attachments;
DROP TABLE IF EXISTS ai_app_conversation_tool_traces;
DROP TABLE IF EXISTS ai_app_conversation_messages;
DROP TABLE IF EXISTS ai_app_conversations;
DROP TABLE IF EXISTS ai_motion_sticker_generations;
