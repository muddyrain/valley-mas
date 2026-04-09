---
name: valley-mas-guide
description: Navigate the Valley MAS monorepo and choose the right code entry points, validation commands, and project-specific guardrails. Use when a task touches this repository and Codex would otherwise need to rediscover the app layout, backend/frontend ownership, migration flow, or common verification steps before editing.
---

# Valley MAS Guide

Use this skill to orient quickly before making changes in `valley-mas`.

Keep the first pass lightweight:

1. Identify which surface the request belongs to.
2. Open only the relevant folders/files.
3. Run the narrowest validation that matches the change.
4. Expand into the reference file only if the task spans multiple subsystems.

## Quick Routing

- Public site / creator space / blog editing / resource upload:
  Open `apps/web/src`.
- Admin dashboards and management pages:
  Open `apps/admin/src`.
- Go API, auth, database, upload/download, blog/resource rules:
  Open `server/internal`.
- Shared TypeScript helpers or cross-app types:
  Open `packages/shared`.

If the request is broad or cross-stack, read `references/project-map.md`.

## Working Rules

- Prefer focused reads over scanning the whole repo.
- Treat `status` and `visibility` as separate concepts in blog/resource features.
- Prefer SQL migrations in `server/migrations` for persistent schema changes.
- Be careful with `DB_AUTO_MIGRATE`; remote PostgreSQL/Supabase startup can become slow when it is enabled.
- When editing Chinese or other non-ASCII UI text, use [$encoding-guard](/D:/my-code/valley-mas/.codex/skills/encoding-guard/SKILL.md) before and after the change.

## Validation Shortcuts

- Go backend:
  Run `cd server && go test ./...`
- Web app:
  Run `pnpm --filter web exec tsc --noEmit`
- Admin app:
  Run `pnpm --filter admin exec tsc --noEmit`
- Shared package:
  Run `pnpm --filter @valley/shared exec tsc --noEmit`
- Encoding safety after text edits:
  Run `python .codex/skills/encoding-guard/scripts/check_mojibake.py`

## When To Read The Reference

Read `references/project-map.md` when you need:

- The main business modules and where they live
- Startup and local run commands
- Backend handler/database entry points
- Frontend folder ownership by app
- Project-specific gotchas worth checking before coding
