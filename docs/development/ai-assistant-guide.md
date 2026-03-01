# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Valley MAS ("创作者口令空间") is an image-sharing platform where users enter a creator's code to access and download their images (avatars, wallpapers). It's a Turborepo + pnpm monorepo with four workspaces:

- `apps/mini-app` — Taro 4 + React 18 WeChat mini-program / H5
- `apps/admin` — React 19 + Vite 6 + Ant Design 5 admin dashboard
- `packages/shared` — Shared TypeScript types and utilities
- `server/` — Go 1.21 + Gin + GORM REST API

## Commands

### Root (run from `D:/my-code/valley-mas`)

```bash
pnpm dev:mini        # Mini-app WeChat dev mode (watch)
pnpm dev:h5          # Mini-app H5 dev mode (watch)
pnpm dev:admin       # Admin dashboard dev server
pnpm build           # Build all packages
pnpm build:mini      # Build WeChat mini-program
pnpm build:h5        # Build H5
pnpm build:admin     # Build admin dashboard
pnpm lint            # Lint all (Biome)
pnpm format          # Format all (Biome)
pnpm check           # Biome check all
pnpm init-repo       # Build packages/* then reinstall (use after fresh clone)
```

### Shared package (must build before other apps can use it)

```bash
cd packages/shared
pnpm build           # Build once
pnpm dev             # Watch mode
```

### Go server

```bash
cd server
cp .env.example .env   # Configure environment variables
go run main.go         # Start server (default port 8080)
go build -o valley-server .
```

## Code Quality

**Biome** is the only formatter and linter (no Prettier, no ESLint). Config in `biome.json` at root.

- 2-space indent, 100 char line width, single quotes, trailing commas, always semicolons
- a11y rules disabled for the mini-app
- Per-app scripts call `biome lint src/`, `biome format --write src/`, `biome check src/`

## Architecture

### Data Flow

```
WeChat Mini-App / H5  ──→  Go API (Gin)  ──→  SQLite (dev) / MySQL (prod)
Admin Dashboard       ──→  Go API (Gin)  ──→  Volcano Engine TOS (file storage)
```

### Shared Types (`packages/shared`)

Canonical types used by both admin and mini-app:
- `User`, `Creator` (with unique `code` field), `Resource` (type: `avatar|wallpaper`)
- `DownloadRecord`, `UploadRecord`
- `ApiResponse<T>`, `PaginatedResponse<T>`
- Utilities: `generateCode`, `formatFileSize`, `formatDate`, `isValidCode`, `debounce`, `throttle`

Import as `@valley/shared` (workspace protocol). Shared package **must be built** before dependent apps.

### Mini-App (`apps/mini-app`)

Pages in `src/pages/`: `home`, `creator`, `discover`, `mine` — configured as tab bar in `src/app.config.ts`.

**Tailwind in mini-app**: Uses `weapp-tailwindcss` plugin (run via `postinstall: weapp-tw patch`) to transform Tailwind for WeChat compatibility. Also supports H5 via PostCSS. Config split between `tailwind.config.js` and `config/index.ts` (Taro Vite compiler config).

Build targets are passed as `--type weapp` or `--type h5` to the Taro CLI.

### Admin Dashboard (`apps/admin`)

Routes (in `src/App.tsx`): `/login`, `/dashboard`, `/users`, `/creators`, `/resources`, `/records`.

State: TanStack Query for server state (5-min stale time, 1 retry), Zustand for client state. Ant Design with `zh_CN` locale. Path alias `@/*` → `src/*`.

### Go Server (`server/`)

Structure: `internal/{config,database,handler,middleware,model,router}`.

- **Auth**: JWT Bearer token in `Authorization` header; `Auth()` and `AdminOnly()` middleware in `internal/middleware/`
- **API prefix**: `/api/v1/`
- **Public routes**: `POST /code/verify`, `GET /creator/:code/resources`
- **Admin routes**: `/admin/*` — full CRUD for users, creators, resources, download/upload records
- **Database**: Auto-migrates all models on startup; SQLite path `./data/valley.db` in dev
- **File storage**: Volcano Engine TOS (configured via env vars `TOS_*`)

Environment variables (see `server/.env.example`): `ENV`, `PORT`, `DB_DRIVER`, `DB_SQLITE_PATH`, `DB_HOST/PORT/USER/PASSWORD/NAME`, `JWT_SECRET`, `TOS_*`.

## Turbo Pipeline

Build order enforced by `dependsOn: ["^build"]` — `packages/shared` builds before apps. Dev tasks are non-cached and persistent. Outputs cached: `dist/**`, `.taro/**`, `build/**`.
