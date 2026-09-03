# Reizoko — Roadmap

> ⚠️ **Status note:** high-level roadmap only. **Authoritative current status:** [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) and [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) §17.  
> This file's «Stage 1 current» label is **STALE** — project is in **Stage 1.5**.

> **Актуальный статус и нумерованный план:** [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)  
> **Полный контекст проекта:** [MASTER_CONTEXT.md](./MASTER_CONTEXT.md)

## Stage 1 — Local Desktop (current)

**Goal:** Full local content creation workflow on Windows.

- React + Tauri desktop app
- SQLite local storage
- Block-based Master Post editor
- Live platform previews (Instagram, Telegram, VK)
- Local media library metadata
- Content library with search, open, duplicate
- Persisted workspace (tabs, draft, blocks)
- Capability system with planned-feature UI

**Not in scope:** Real social API integration, cloud sync, server scheduler.

---

## Stage 2 — Web + Shared Hosting + Sync

**Goal:** Work from browser while traveling; sync with desktop.

- `apps/web` browser client
- Cloud content library
- Desktop ↔ Cloud synchronization
- Media synchronization
- Enable capabilities: `cloudSync`, `webAccess`

**Infrastructure:** Shared hosting (not VPS backend yet).

---

## Stage 3 — VPS + Scheduler + Background Publishing

**Goal:** Publish when computer is off; OAuth and automation.

- NestJS API
- PostgreSQL
- Redis + BullMQ
- Background workers and scheduler
- OAuth for social accounts
- Automatic publishing, retries, webhooks
- Enable capabilities: `serverScheduler`, `backgroundPublishing`, `recurringPublishing`

**New apps:** `apps/server`

---

## Platform Expansion

Stage 1 previews: Instagram, Telegram, VK.

Planned platforms (UI catalog only): Facebook, Threads, X, TikTok, LinkedIn, Bluesky.

Each platform adds a module under `platforms/` implementing `PlatformAdapter` + Preview.

---

## Principles for All Stages

1. Do not rewrite core data model for sync or server features — extend it.
2. Use capability flags, not hardcoded stage checks in UI.
3. Keep platform logic out of shared React components.
4. Post ≠ Publication — always separate entities.
