# Reizoko — Architecture

> **Главный документ контекста:** [MASTER_CONTEXT.md](./MASTER_CONTEXT.md)  
> **Дорожная карта и статусы:** [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)  
> **AI entry point:** [AI_CONTEXT_INDEX.md](./AI_CONTEXT_INDEX.md)

## Current Stack (Stage 1 + 1.5 in progress)

- **Frontend:** React 19, TypeScript (strict)
- **Desktop shell:** Tauri 2
- **Database:** SQLite via `tauri-plugin-sql`
- **Package manager:** pnpm workspaces (monorepo)
- **State:** Zustand (desktop app layer only)

## Repository Layout

```text
apps/desktop/          — Tauri shell, UI composition, persistence wiring
packages/shared/       — Domain types, UUID utils, capabilities
packages/core/         — Business logic (content, workspace, capabilities)
packages/database/     — Repository layer, migrations, SQLite access abstraction
packages/platform-sdk/ — Platform adapter contract and registry
packages/ui/           — Shared UI primitives and theme tokens
packages/editor/       — Block-based Master Post editor
platforms/*            — Per-platform adapters and preview components
docs/                  — MASTER_CONTEXT, DEVELOPMENT_PLAN, architecture notes
```

## Core / Desktop Separation

Business logic lives in `packages/core` and `packages/database`. The desktop app (`apps/desktop`) is a thin composition layer:

- Initializes SQLite through `DatabaseClient` abstraction
- Wires repositories into Zustand store
- Renders UI and handles Tauri-specific APIs (file dialogs, asset URLs)

This allows future `apps/web` and `apps/server` without rewriting core logic.

## Capability System

`AppCapabilities` in `@reizoko/shared` controls feature availability. UI checks capabilities (not stage numbers). Stage 1 disables all cloud/server features; disabled UI shows explicit “Planned” messaging.

## Platform Adapter Architecture

Each platform module implements:

- `PlatformAdapter` — transform, validate, capabilities
- `Preview` React component — live preview UI

Platforms register via `platformRegistry`. Adding a new network = new folder under `platforms/`, no changes to core editor.

## SQLite Repository Layer

UI never executes SQL directly. Repositories:

- `ContentRepository` — ContentItem + ContentRevision CRUD
- `WorkspaceRepository` — persisted tabs and active state
- `SettingsRepository` — key-value app settings
- `MediaRepository` — local media library metadata

Schema migrations live in `packages/database/src/migrations/` and run on startup.

## Data Model

### ContentItem + ContentRevision

Master Post is block-structured, not HTML. One `ContentItem` has many `ContentRevision` records; edits create new revisions.

### Publication

`Publication` is separate from `ContentItem`. One post can be published many times. Stage 1 stores the model; API publishing is Stage 3.

### Sync-Ready Metadata

All primary entities use UUID, `createdAt`, `updatedAt`, optional `deletedAt`, and optional `syncState` / `deviceId` for future Desktop ↔ Cloud sync.

## Scheduling Model

`ScheduleConfig` supports:

- **Natural Time** (default) — jitter around target time to avoid mechanical patterns
- **Exact Time** — publish precisely at selected time

Logic is modeled in `@reizoko/shared`; server scheduler implementation is Stage 3.

## Future Sync Architecture

Stage 2 will add cloud library and bidirectional sync. Current schema and entity metadata are designed so sync can be added without breaking changes to core tables.
