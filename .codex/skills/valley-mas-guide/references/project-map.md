# Valley MAS Project Map

## Monorepo Summary

- Package manager: `pnpm`
- Workspace orchestration: `turbo`
- Root workspaces: `apps/*`, `packages/*`
- Backend language: Go
- Frontends: React + Vite

## Main Directories

### `apps/web`

User-facing website and creator workflows.

- Main focus:
  blog creation, resource publishing, creator space, public pages
- Common folders:
  `src/pages`, `src/components`, `src/api`, `src/stores`
- Typical validation:
  `pnpm --filter web exec tsc --noEmit`

### `apps/admin`

Admin console for management and operations.

- Main focus:
  user/resource/blog management, dashboards, admin-only flows
- UI stack:
  React + Vite + Ant Design ecosystem
- Typical validation:
  `pnpm --filter admin exec tsc --noEmit`

### `server`

Go API server and database-facing logic.

- Main focus:
  auth, users, creators, resources, blogs, uploads/downloads
- Important folders:
  `internal/handler`
  `internal/service`
  `internal/model`
  `internal/router`
  `internal/database`
  `internal/config`
  `migrations`
- Typical validation:
  `cd server && go test ./...`

### `packages/shared`

Shared TypeScript exports used by multiple apps.

- Use when a change affects common types or helpers.
- Typical validation:
  `pnpm --filter @valley/shared exec tsc --noEmit`

## Backend Entry Points

### Routing and handlers

- Router setup:
  `server/internal/router`
- Request handlers:
  `server/internal/handler`
- When a bug is reported on an API path, start from the matching handler file first.

### Database and migrations

- GORM initialization:
  `server/internal/database/database.go`
- Environment config:
  `server/internal/config/config.go`
- SQL migrations:
  `server/migrations`

Guidance:

- Prefer explicit SQL migrations for durable schema changes.
- `DB_AUTO_MIGRATE` defaults on outside production unless overridden.
- When using remote PostgreSQL or Supabase, auto-migrate can make startup much slower because of schema introspection.

## Frontend Routing Heuristics

### If the request says "web"

Start in:

- `apps/web/src/pages`
- then `apps/web/src/api`
- then shared local components under `apps/web/src/components`

### If the request says "admin"

Start in:

- `apps/admin/src/pages`
- then `apps/admin/src/api`
- then related table/form components

### If the request says "资源" or "博客"

Cross-check both:

- frontend page/form
- API client
- backend handler
- model or migration if fields changed

## Common Product Concepts

### Blog and resource lifecycle

- `status` is content lifecycle, not access control
- `visibility` is access scope
- Keep those concerns separate when modifying blog/resource features

### Creator-focused flows

- Public browsing and creator self-management are separate surfaces
- Bugs around "creator can see but public cannot" often involve different endpoints and permission rules

## Fast Start Commands

### Root

```bash
pnpm install
pnpm dev
```

### Backend

```bash
cd server
go run main.go
go test ./...
```

### Web

```bash
cd apps/web
pnpm dev
pnpm exec tsc --noEmit
```

### Admin

```bash
cd apps/admin
pnpm dev
pnpm exec tsc --noEmit
```

## Project-Specific Gotchas

- Chinese UI text can be damaged by encoding mistakes during edits; run the encoding guard skill when touching non-ASCII text.
- Remote Supabase/Postgres plus `DB_AUTO_MIGRATE=true` can create long startup delays.
- Historical data may not always match the newest fields immediately; be careful when tightening public visibility filters.
- This repo mixes multiple app surfaces; avoid changing admin-only behavior when the user actually means the public web app, and vice versa.
