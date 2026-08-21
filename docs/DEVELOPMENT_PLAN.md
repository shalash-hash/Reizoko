# Reizoko — DEVELOPMENT PLAN

> Нумерованная дорожная карта с актуальными статусами.  
> Главный контекст: [MASTER_CONTEXT.md](./MASTER_CONTEXT.md)  
> Актуализирован: **21 августа 2026** (аудит репозитория).

## Легенда статусов

| Символ | Статус |
|--------|--------|
| ✅ | DONE |
| 🟡 | IN PROGRESS |
| ➡️ | NEXT |
| ⬜ | PLANNED |

**Правило:** одновременно только **один** 🟡 IN PROGRESS и **один** ➡️ NEXT.

---

## Текущий фокус

| | ID | Задача |
|---|-----|--------|
| 🟡 | **1.19** | UI/UX polish & Light/Dark consistency |
| ➡️ | **1.20** | Production desktop build & Stage 1 stabilization |

```text
Stage:    1 — Local Desktop
Substage: 1.19 → 1.20
```

---

# STAGE 1 — Local Desktop

Цель: полноценный локальный Reizoko — создание Master Post, live previews, библиотека, persistence, production build.

---

## 1.0 Foundation

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.0.1 | pnpm monorepo workspaces | ✅ DONE | `apps/*`, `packages/*`, `platforms/*` |
| 1.0.2 | TypeScript strict + path aliases | ✅ DONE | `tsconfig.base.json` |
| 1.0.3 | ESLint + Prettier | ✅ DONE | Root config |
| 1.0.4 | Root scripts (dev, build, lint, typecheck) | ✅ DONE | `package.json` |
| 1.0.5 | README + docs skeleton | ✅ DONE | `docs/ARCHITECTURE.md`, `ROADMAP.md` |
| 1.0.6 | Windows dev launcher (`dev.bat`) | ✅ DONE | `BROWSER=none`, vite `open: false` |
| 1.0.7 | Initial git commit | ⬜ PLANNED | Repo initialized, 0 commits |

---

## 1.1 Core Data Model

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.1.1 | ContentBlock types (text, heading, image) | ✅ DONE | + planned types defined |
| 1.1.2 | ContentItem + ContentRevision | ✅ DONE | UUID, metadata, version |
| 1.1.3 | ContentItemSummary | ✅ DONE | Library projection |
| 1.1.4 | Publication types | ✅ DONE | TypeScript only |
| 1.1.5 | SocialAccount types | ✅ DONE | TypeScript only |
| 1.1.6 | MediaItem types | ✅ DONE | |
| 1.1.7 | WorkspaceState types | ✅ DONE | |
| 1.1.8 | ScheduleConfig + Natural/Exact Time utils | ✅ DONE | Model in shared; scheduler Stage 3 |
| 1.1.9 | Sync-ready metadata (syncState, deviceId) | ✅ DONE | Fields on entities |
| 1.1.10 | UUID generation (`generateId`) | ✅ DONE | `crypto.randomUUID` |

---

## 1.2 SQLite & Persistence Layer

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.2.1 | DatabaseClient abstraction | ✅ DONE | Interface in `@reizoko/database` |
| 1.2.2 | Tauri SQLite implementation | ✅ DONE | `TauriDatabaseClient` |
| 1.2.3 | Migration v1 (full schema) | ✅ DONE | 8 tables + indexes |
| 1.2.4 | ContentRepository | ✅ DONE | CRUD, revisions, search, duplicate |
| 1.2.5 | WorkspaceRepository | ✅ DONE | JSON blob id=1 |
| 1.2.6 | SettingsRepository | ✅ DONE | Key-value |
| 1.2.7 | MediaRepository | ✅ DONE | Metadata CRUD |
| 1.2.8 | PublicationRepository | ⬜ PLANNED | Table exists, no repo |
| 1.2.9 | SocialAccountRepository | ⬜ PLANNED | Table exists, no repo |
| 1.2.10 | UI isolation from SQL | ✅ DONE | Only packages/database executes SQL |

---

## 1.3 Business Logic (Core)

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.3.1 | ContentService | ✅ DONE | create, save, search, duplicate |
| 1.3.2 | Block factory + reorder | ✅ DONE | `@reizoko/core` |
| 1.3.3 | WorkspaceService (in-memory) | ✅ DONE | Used as defaults helper |
| 1.3.4 | Capability helpers | ✅ DONE | `STAGE1_CAPABILITIES`, `getDisabledReason` |
| 1.3.5 | Preview text extraction | ✅ DONE | For library cards |

---

## 1.4 Block Editor

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.4.1 | BlockEditor component | ✅ DONE | `@reizoko/editor` |
| 1.4.2 | Text blocks | ✅ DONE | |
| 1.4.3 | Heading blocks (H1–H3) | ✅ DONE | |
| 1.4.4 | Image blocks | ✅ DONE | mediaId reference |
| 1.4.5 | Drag-and-drop reorder | ✅ DONE | @dnd-kit |
| 1.4.6 | Title editing | ✅ DONE | In canvas header |
| 1.4.7 | Add/delete blocks | ✅ DONE | |
| 1.4.8 | Planned block types (video, link, …) | ⬜ PLANNED | Types defined, throw on create |

---

## 1.5 Workspace & Tabs

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.5.1 | AppShell layout | ✅ DONE | Sidebar + main + overlays |
| 1.5.2 | Sidebar navigation | ✅ DONE | Работа / Скоро groups |
| 1.5.3 | TabBar (Editor + platforms) | ✅ DONE | Browser-like chrome |
| 1.5.4 | Open/close platform tabs | ✅ DONE | Persisted |
| 1.5.5 | Active tab persistence | ✅ DONE | |
| 1.5.6 | Local • Saved status in TabBar | ✅ DONE | |
| 1.5.7 | Sidebar section routing | ✅ DONE | editor, library, settings, planned |
| 1.5.8 | Autosave (debounced) | ✅ DONE | ~800ms, saveStatus indicator |

---

## 1.6 Platform Previews

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.6.1 | PlatformAdapter interface + registry | ✅ DONE | `@reizoko/platform-sdk` |
| 1.6.2 | Instagram adapter + preview | ✅ DONE | Carousel, caption limits |
| 1.6.3 | Telegram adapter + preview | ✅ DONE | HTML headings, bubbles |
| 1.6.4 | VK adapter + preview | ✅ DONE | Wall post style |
| 1.6.5 | Live sync editor → previews | ✅ DONE | Shared Zustand blocks |
| 1.6.6 | PlatformPreviewPanel (center) | ✅ DONE | Full preview view |
| 1.6.7 | InspectorPanel (right) | ✅ DONE | Platform, checks, thumbnail |
| 1.6.8 | Planned platform catalog | ✅ DONE | 6 platforms in picker |
| 1.6.9 | Platform Picker modal | ✅ DONE | Close, footer, connected state |

---

## 1.7 Library

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.7.1 | Library view + routing | ✅ DONE | Sidebar → LibraryView |
| 1.7.2 | Search | ✅ DONE | LIKE on metadata + blocks JSON |
| 1.7.3 | Open item in editor | ✅ DONE | |
| 1.7.4 | Duplicate item | ✅ DONE | New UUIDs for blocks |
| 1.7.5 | Create new draft | ✅ DONE | From library header |
| 1.7.6 | Empty state | ✅ DONE | |
| 1.7.7 | Grid / List layout toggle | ✅ DONE | |
| 1.7.8 | Delete from library | ⬜ PLANNED | Repository method exists |
| 1.7.9 | Thumbnails / rich cards | ⬜ PLANNED | Mini preview lines only |

---

## 1.8 Media Library

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.8.1 | Image picker (Tauri dialog) | ✅ DONE | |
| 1.8.2 | Copy to AppData/media | ✅ DONE | |
| 1.8.3 | MediaItem metadata in SQLite | ✅ DONE | |
| 1.8.4 | convertFileSrc URLs | ✅ DONE | Tauri asset protocol |
| 1.8.5 | Media browser UI | ⬜ PLANNED | No standalone media library view |
| 1.8.6 | File size / dimensions | ⬜ PLANNED | size=0 on import |

---

## 1.9 Settings

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.9.1 | Theme selection (system/light/dark) | ✅ DONE | |
| 1.9.2 | Theme persistence (localStorage + SQLite) | ✅ DONE | |
| 1.9.3 | Anti-flash script | ✅ DONE | index.html |
| 1.9.4 | About section | ✅ DONE | Stage 1 badge |
| 1.9.5 | Extended settings (accounts, scheduling prefs) | ⬜ PLANNED | Stage 2/3 |

---

## 1.10 Design System & UI Shell

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.10.1 | CSS design tokens (light) | ✅ DONE | `tokens.css` |
| 1.10.2 | CSS design tokens (dark) | ✅ DONE | Independent palette |
| 1.10.3 | Shared UI components | ✅ DONE | Button, Badge, Sidebar, etc. |
| 1.10.4 | Approved editor shell layout | ✅ DONE | Reference implementation |
| 1.10.5 | StatusBar (save, autosave, publish stub) | ✅ DONE | Publish disabled |
| 1.10.6 | PlannedFeature placeholders | ✅ DONE | Calendar, Analytics, etc. |
| 1.10.7 | SuperDesign approved reference doc | ✅ DONE | `.superdesign/approved-design-system.md` |
| 1.10.8 | Screenshot capture script | ✅ DONE | `scripts/capture-screenshots.mjs` |
| 1.10.9 | docs/screenshots output | ⬜ PLANNED | Directory not populated |

---

## 1.11 Revision History

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.11.1 | Append revision on save | ✅ DONE | Automatic in repository |
| 1.11.2 | getRevisions API | ✅ DONE | Repository method |
| 1.11.3 | Revision list UI | ⬜ PLANNED | |
| 1.11.4 | Restore previous revision | ⬜ PLANNED | |

---

## 1.12 Publishing (Local Architecture)

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.12.1 | Publication schema | ✅ DONE | SQLite table |
| 1.12.2 | PublicationRepository | ⬜ PLANNED | |
| 1.12.3 | Local draft publication records | ⬜ PLANNED | Pre-API workflow design TBD |
| 1.12.4 | Manual publish flow (when API ready) | ⬜ PLANNED | Stage 3 decision point |

---

## 1.13 Local Accounts Architecture

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.13.1 | SocialAccount schema | ✅ DONE | |
| 1.13.2 | Accounts UI (sidebar section) | ⬜ PLANNED | Shows PlannedFeature |
| 1.13.3 | Local account metadata storage | ⬜ PLANNED | No repository |

---

## 1.14 Quality & Tooling

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.14.1 | typecheck CI-ready | ✅ DONE | `pnpm typecheck` passes |
| 1.14.2 | lint CI-ready | ✅ DONE | `pnpm lint` passes |
| 1.14.3 | Unit tests (core, adapters) | ⬜ PLANNED | 0 test files |
| 1.14.4 | E2E / integration tests | ⬜ PLANNED | Playwright available |
| 1.14.5 | Backup / export (JSON) | ⬜ PLANNED | |
| 1.14.6 | Import from backup | ⬜ PLANNED | |

---

## 1.15 Cleanup & Technical Debt

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.15.1 | Remove legacy AppHeader | ⬜ PLANNED | Unused file |
| 1.15.2 | TabBar menu handler or remove | ⬜ PLANNED | Dead button |
| 1.15.3 | Update README commands | ⬜ PLANNED | Simplify tauri:dev |
| 1.15.4 | Initial git commit | ⬜ PLANNED | User must request |

---

## 1.19 UI/UX Polish & Light/Dark Consistency 🟡 IN PROGRESS

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.19.1 | Editor shell matches approved design | ✅ DONE | Primary reference |
| 1.19.2 | Platform Picker polish | ✅ DONE | Close, footer, status |
| 1.19.3 | Library visual polish | ✅ DONE | Grid/list, canvas cards |
| 1.19.4 | Settings theme preview colors | ✅ DONE | Approved light sidebar |
| 1.19.5 | Dark theme pass — Library | 🟡 IN PROGRESS | Tokens work; visual QA needed |
| 1.19.6 | Dark theme pass — Settings | 🟡 IN PROGRESS | |
| 1.19.7 | Dark theme pass — Platform Picker | 🟡 IN PROGRESS | |
| 1.19.8 | Dark theme pass — Platform previews | ⬜ PLANNED | Telegram dark reference exists in SuperDesign |
| 1.19.9 | Inspector/StatusBar dark polish | ⬜ PLANNED | Functional, minor inconsistencies possible |
| 1.19.10 | Remove design inconsistencies vs approved tokens | 🟡 IN PROGRESS | Ongoing |

---

## 1.20 Production Build & Stage 1 Stabilization ➡️ NEXT

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.20.1 | `pnpm tauri:build` success on Windows | ➡️ NEXT | Not yet run in audit |
| 1.20.2 | Verify EXE install & run | ➡️ NEXT | |
| 1.20.3 | Capture docs/screenshots | ➡️ NEXT | Playwright script ready |
| 1.20.4 | Smoke test full workflow | ➡️ NEXT | Create → preview → library → restart |
| 1.20.5 | Document build artifact paths | ➡️ NEXT | In MASTER_CONTEXT |
| 1.20.6 | Stage 1 sign-off checklist | ➡️ NEXT | After 1.19 complete |

---

## 1.21 Stage 1 Completion Gate

Stage 1 считается **завершённым**, когда выполнены:

- [ ] 1.19 UI/UX polish complete (all screens, light + dark)
- [ ] 1.20 Production build verified
- [ ] Core workflow smoke-tested on clean Windows install
- [ ] docs/screenshots populated
- [ ] Revision history UI *(optional for gate — может перейти в 1.22)*
- [ ] Initial git commit *(по запросу пользователя)*

---

# STAGE 2 — Web + Shared Hosting + Sync

Цель: работа из браузера, cloud library, Desktop ↔ Cloud sync на shared hosting.

| ID | Задача | Статус |
|----|--------|--------|
| 2.1 | `apps/web` browser client | ⬜ PLANNED |
| 2.2 | Authentication (user accounts) | ⬜ PLANNED |
| 2.3 | Cloud content repository API | ⬜ PLANNED |
| 2.4 | Sync protocol design | ⬜ PLANNED |
| 2.5 | Conflict resolution strategy | ⬜ PLANNED |
| 2.6 | Media sync (upload/download) | ⬜ PLANNED |
| 2.7 | Desktop ↔ Cloud bidirectional sync | ⬜ PLANNED |
| 2.8 | Initial upload: local → cloud | ⬜ PLANNED |
| 2.9 | Fresh Desktop restore from cloud | ⬜ PLANNED |
| 2.10 | Shared hosting API layer | ⬜ PLANNED |
| 2.11 | Enable `cloudSync` capability | ⬜ PLANNED |
| 2.12 | Enable `webAccess` capability | ⬜ PLANNED |
| 2.13 | Sync security (tokens, encryption) | ⬜ PLANNED |
| 2.14 | Cloud backup strategy | ⬜ PLANNED |
| 2.15 | Web UI parity with desktop core workflow | ⬜ PLANNED |

**Constraint:** не переписывать Stage 1 core — только расширять.

---

# STAGE 3 — VPS + Automation

Цель: автоматическая публикация, OAuth, scheduler, background workers.

| ID | Задача | Статус |
|----|--------|--------|
| 3.1 | `apps/server` NestJS backend | ⬜ PLANNED |
| 3.2 | PostgreSQL schema (sync with domain model) | ⬜ PLANNED |
| 3.3 | Redis + BullMQ job queue | ⬜ PLANNED |
| 3.4 | Background workers | ⬜ PLANNED |
| 3.5 | Scheduler service | ⬜ PLANNED |
| 3.6 | NaturalTimeResolver (production) | ⬜ PLANNED | Uses shared utils |
| 3.7 | Exact Time mode (user opt-in) | ⬜ PLANNED |
| 3.8 | OAuth flows per platform | ⬜ PLANNED |
| 3.9 | Token lifecycle & refresh | ⬜ PLANNED |
| 3.10 | Platform API publishing (IG, TG, VK) | ⬜ PLANNED |
| 3.11 | Publication retry & failure handling | ⬜ PLANNED |
| 3.12 | Webhooks (platform callbacks) | ⬜ PLANNED |
| 3.13 | Background publish (PC off) | ⬜ PLANNED |
| 3.14 | Recurring / evergreen posts | ⬜ PLANNED |
| 3.15 | Fill-new-account workflow | ⬜ PLANNED |
| 3.16 | Enable `serverScheduler` capability | ⬜ PLANNED |
| 3.17 | Enable `backgroundPublishing` capability | ⬜ PLANNED |
| 3.18 | Enable `recurringPublishing` capability | ⬜ PLANNED |
| 3.19 | Monitoring & logging | ⬜ PLANNED |
| 3.20 | Server backups | ⬜ PLANNED |
| 3.21 | StatusBar «Опубликовать» activation | ⬜ PLANNED |

---

# Platform Expansion (cross-stage)

| ID | Platform | Preview | API Publish | Status |
|----|----------|---------|-------------|--------|
| P.1 | Instagram | ✅ Stage 1 | ⬜ Stage 3 | Active |
| P.2 | Telegram | ✅ Stage 1 | ⬜ Stage 3 | Active |
| P.3 | VK | ✅ Stage 1 | ⬜ Stage 3 | Active |
| P.4 | Facebook | ⬜ Catalog | ⬜ Stage 3+ | Planned |
| P.5 | Threads | ⬜ Catalog | ⬜ Stage 3+ | Planned |
| P.6 | X | ⬜ Catalog | ⬜ Stage 3+ | Planned |
| P.7 | TikTok | ⬜ Catalog | ⬜ Stage 3+ | Planned |
| P.8 | LinkedIn | ⬜ Catalog | ⬜ Stage 3+ | Planned |
| P.9 | Bluesky | ⬜ Catalog | ⬜ Stage 3+ | Planned |

---

# Documentation Milestones

| ID | Задача | Статус |
|----|--------|--------|
| D.1 | MASTER_CONTEXT.md | ✅ DONE |
| D.2 | DEVELOPMENT_PLAN.md | ✅ DONE |
| D.3 | ARCHITECTURE.md актуализация | ✅ DONE |
| D.4 | ROADMAP.md актуализация | ✅ DONE |

---

# Рекомендуемая последовательность после текущего фокуса

```text
1.19  UI/UX + Dark pass (🟡 сейчас)
  ↓
1.20  Production build + smoke test (➡️ следующий)
  ↓
1.11  Revision history UI
  ↓
1.12  Publication local drafts
  ↓
1.14  Tests + backup/export
  ↓
1.21  Stage 1 completion gate
  ↓
2.x   Stage 2 planning & implementation
```
