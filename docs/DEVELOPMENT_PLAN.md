# Reizoko — DEVELOPMENT PLAN

> Нумерованная дорожная карта с актуальными статусами.  
> Главный контекст: [MASTER_CONTEXT.md](./MASTER_CONTEXT.md)  
> Актуализирован: **22 августа 2026** (старт Stage 1.5 — Connected & Publishing Desktop).

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
| ✅ | **Stage 1** | Local Desktop — **COMPLETE** (baseline `v0.1.0-stage1`) |
| 🟡 | **Stage 1.5** | Connected & Publishing Desktop — **CURRENT** (1.5.1–1.5.5 ✅, 1.5.6 ➡️) |
| ⬜ | **Stage 2** | Web / Cloud Sync — **DEFERRED** |
| ⬜ | **Stage 3** | Server Automation — **DEFERRED** |

```text
STAGE 1   — Local Desktop                    ✅ COMPLETE
STAGE 1.5 — Connected & Publishing Desktop   🟡 CURRENT
STAGE 2   — Web / Cloud Sync                 DEFERRED — не входит в текущий план
STAGE 3   — Server Automation                DEFERRED — не входит в текущий план
```

**Current product goal:** полностью функциональный standalone Windows desktop Reizoko — реальные аккаунты, локальная авторизация, публикация, scheduler и очередь **без собственного backend**.

---

# STAGE 1 — Local Desktop ✅ COMPLETE

Цель Stage 1 достигнута: полноценный локальный Reizoko — Master Post, live previews, библиотека, persistence, production build.

**Baseline version:** 0.1.0  
**Acceptance record:** [STAGE1_ACCEPTANCE.md](./STAGE1_ACCEPTANCE.md)

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
| 1.0.7 | Initial git commit | ✅ DONE | Pushed to GitHub |

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
| 1.2.8 | PublicationRepository | ✅ DONE | Stage 1.12 — `SqlitePublicationRepository` |
| 1.2.9 | SocialAccountRepository | ✅ DONE | Stage 1.13 — `SqliteSocialAccountRepository` |
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
| 1.4.8 | Planned block types (video, link, …) | ➡️ Stage 2 | Types defined; explicit unsupported in Stage 1 |

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
| 1.7.8 | Delete from library | ➡️ Stage 2 | Repository method exists; UI deferred |
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
| 1.10.9 | docs/screenshots output | ✅ DONE | 14 light/dark screenshots |

---

## 1.11 Revision History ✅ DONE

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.11.1 | Append/save revision architecture | ✅ DONE | Working revision + checkpoints |
| 1.11.2 | getRevisions API | ✅ DONE | Repository + ContentService |
| 1.11.3 | Revision list UI | ✅ DONE | Revision History Drawer |
| 1.11.4 | Restore previous revision | ✅ DONE | Creates new revision, preserves history |
| 1.11.5 | Manual checkpoint | ✅ DONE | «Создать версию» |
| 1.11.6 | Revision metadata/title snapshot | ✅ DONE | Migration v2 `revision_metadata` |
| 1.11.7 | Revision tests | ✅ DONE | vitest in `@reizoko/core` + `@reizoko/database` |

---

## 1.12 Publishing (Local Architecture) ✅ DONE

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.12.1 | PublicationBatch + migration v3 | ✅ DONE | `publication_batches`, snapshot columns |
| 1.12.2 | PublicationRepository + BatchRepository | ✅ DONE | SQLite implementations |
| 1.12.3 | PublicationService.prepareBatch | ✅ DONE | Checkpoint, transform, validate, snapshot |
| 1.12.4 | Publication checkpoint (origin=publication) | ✅ DONE | Immutable revision before batch |
| 1.12.5 | PreparedPublicationSnapshot | ✅ DONE | Platform-neutral, mediaId refs |
| 1.12.6 | UI «Подготовить публикацию» | ✅ DONE | Open tabs → batch; fake publish disabled |
| 1.12.7 | Publication architecture tests | ✅ DONE | 10 vitest cases + migration v3 |
| 1.12.8 | Targeted smoke `publication-draft.mjs` | ✅ DONE | Prepare, immutability, restart persist |

---

## 1.13 Local Accounts Architecture ✅ DONE

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.13.1 | SocialAccount model + migration v4 | ✅ DONE | `connection_state`, handle, soft delete |
| 1.13.2 | SocialAccountRepository + Service | ✅ DONE | CRUD, validation, no secrets |
| 1.13.3 | AccountsView UI | ✅ DONE | Local profiles, create/edit/deactivate |
| 1.13.4 | OpenPlatformTarget workspace model | ✅ DONE | Legacy `openPlatformTabs` migration |
| 1.13.5 | Account-aware tabs + Platform Picker | ✅ DONE | `Instagram · Компания` tabs |
| 1.13.6 | Preview account context | ✅ DONE | IG/TG/VK headers |
| 1.13.7 | Publication integration | ✅ DONE | `socialAccountId` per open target |
| 1.13.8 | Accounts architecture tests + smoke | ✅ DONE | 12 vitest + `accounts.mjs` |

---

## 1.14 Quality & Tooling ✅ DONE

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.14.1 | typecheck CI-ready | ✅ DONE | `pnpm typecheck` — 0 errors |
| 1.14.2 | lint CI-ready | ✅ DONE | `pnpm lint` — 0 errors, 0 warnings |
| 1.14.3 | Unit tests | ✅ DONE | 67 vitest (11 core + 49 database + 7 desktop) |
| 1.14.4 | E2E / integration / smoke tooling | ✅ DONE | `pnpm quality`, `pnpm smoke:*`, release A–G |
| 1.14.5 | Backup / export | ✅ DONE | `.reizoko-backup` + JSON export, Settings UI |
| 1.14.6 | Import / restore | ✅ DONE | validate-first, safety backup, transactional restore |

---

## 1.15 Cleanup & Technical Debt ✅ DONE

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.15.1 | Remove legacy AppHeader | ✅ DONE | Удалён на предыдущем этапе |
| 1.15.2 | TabBar menu handler or remove | ✅ DONE | Dead button removed |
| 1.15.3 | Update README commands | ✅ DONE | Актуализирован в 1.15 |
| 1.15.4 | Technical debt audit + fixes | ✅ DONE | media size, smoke lifecycle, migrations, docs |
| 1.15.5 | Background/minimized automated test startup | ✅ DONE | `REIZOKO_SMOKE_TEST=1` → hidden window |

### Repository housekeeping / User-controlled actions

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| R.1 | Initial git commit / push | ⏳ WAITING FOR USER COMMAND | Выполняется только по явной команде пользователя |

---

## 1.19 UI/UX Polish & Light/Dark Consistency ✅ DONE

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.19.1 | Editor shell matches approved design | ✅ DONE | Primary reference |
| 1.19.2 | Platform Picker polish | ✅ DONE | Close, footer, status |
| 1.19.3 | Library visual polish | ✅ DONE | Grid/list, canvas cards |
| 1.19.4 | Settings theme preview colors | ✅ DONE | Semantic theme-preview tokens |
| 1.19.5 | Dark theme pass — Library | ✅ DONE | Token-based surfaces |
| 1.19.6 | Dark theme pass — Settings | ✅ DONE | Theme cards + panels |
| 1.19.7 | Dark theme pass — Platform Picker | ✅ DONE | Overlay, cards, badges |
| 1.19.8 | Dark theme pass — Platform previews | ✅ DONE | IG/TG/VK semantic tokens |
| 1.19.9 | Inspector/StatusBar dark polish | ✅ DONE | text-inverse, preview stage |
| 1.19.10 | Remove design inconsistencies vs approved tokens | ✅ DONE | Hardcoded colors removed |

---

## 1.20 Production Build & Stage 1 Stabilization ✅ DONE

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.20.1 | `pnpm tauri:build` success on Windows | ✅ DONE | Release build 22.08.2026 |
| 1.20.2 | Verify EXE install & run | ✅ DONE | `reizoko-desktop.exe` starts |
| 1.20.3 | Capture docs/screenshots | ✅ DONE | 14 PNG in `docs/screenshots/` |
| 1.20.4 | Phased release smoke test (A–G) | ✅ DONE | `scripts/release-smoke-test.mjs` — 3× PASS; smoke DB `reizoko-smoke.db` |
| 1.20.5 | Document build artifact paths | ✅ DONE | Updated in MASTER_CONTEXT |
| 1.20.6 | Stage 1 sign-off checklist | ✅ DONE | `pnpm stage1:acceptance`, `docs/STAGE1_ACCEPTANCE.md` |

---

## 1.21 Stage 1 Completion Gate ✅ DONE

Stage 1 считается **завершённым** — все blocking criteria пройдены:

- [x] 1.19 UI/UX polish complete (all screens, light + dark)
- [x] 1.20 Production build verified
- [x] Core workflow smoke-tested on release EXE (phases A–G)
- [x] docs/screenshots populated (14 PNG)
- [x] Revision history UI
- [x] 1.14 Quality, backup/restore, coverage
- [x] 1.15 Cleanup & technical debt
- [x] Final Stage 1 sign-off checklist (`pnpm stage1:acceptance`)
- [x] Chained smoke orchestrator — deterministic process isolation

**Baseline tag:** `v0.1.0-stage1` — не изменять.

---

# STAGE 1.5 — Connected & Publishing Desktop 🟡 CURRENT

Цель: полностью функциональный Windows desktop — подключение реальных аккаунтов, безопасное локальное хранение авторизации, публикация через официальные API, локальный scheduler и очередь. **Без собственного backend.**

Исследование платформ: [platform-connections/README.md](./platform-connections/README.md)

| ID | Задача | Статус | Notes |
|----|--------|--------|-------|
| 1.5.1 | Platform Connection Research & Architecture | ✅ DONE | IG/TG/VK docs + contracts |
| 1.5.2 | Secure Credential Infrastructure | ✅ DONE | SecretStore, Windows Credential Manager, migration v5 |
| 1.5.3 | Account Connection UI | ✅ DONE | Telegram connect/destination dialogs, hierarchy |
| 1.5.4 | Telegram Bot Connection & Publishing | ✅ DONE | Bot API, real publish, smoke:telegram |
| 1.5.5 | Platform Composer / Per-platform Overrides | ✅ DONE | Active tabs, crop/zoom, overrides, snapshot v2, smoke:composer |
| 1.5.6 | VK Connection & Publishing | ✅ DONE | OAuth, multi-target, wall.post + photos, migration v8 |
| 1.5.7 | Instagram / Meta Connection | ⬜ PLANNED | Business/Creator, Meta App Review |
| 1.5.8 | Local Publisher Engine | ⬜ PLANNED | `PlatformPublisher` implementations |
| 1.5.9 | Publish Now UX | ⬜ PLANNED | Real HTTP publish from desktop |
| 1.5.10 | Publication Result / Retry / Remote Links | ⬜ PLANNED | `remotePostId`, `remoteUrl` |
| 1.5.11 | Local Scheduler | ⬜ PLANNED | Schedule while PC on |
| 1.5.12 | Natural Time / Exact Time execution | ⬜ PLANNED | Uses shared utils |
| 1.5.13 | Local Background Queue | ⬜ PLANNED | In-process queue, no Redis |
| 1.5.14 | Recurring / Evergreen Local Publishing | ⬜ PLANNED | Desktop-only recurrence |
| 1.5.15 | Connected Desktop Acceptance | ⬜ PLANNED | End-to-end gate |

### 1.5.1 Platform Connection Research & Architecture

- Официальная документация: authentication, authorization, publishing, media upload, refresh, revoke.
- `PlatformConnectionProvider` — platform-independent contract.
- `ConnectionMethod` — не единый login flow для всех платформ.
- System browser OAuth: loopback callback / custom URI scheme (`reizoko://`).
- `MediaDeliveryMode` — direct_binary, multipart, platform_upload_session, public_url.
- Desktop-only blocker model (`requiresPublicMediaUrl`, feasibility labels).

### 1.5.2 Secure Credential Infrastructure

- `SecretStore` interface — вне SQLite domain repository.
- Windows: Credential Manager via Tauri `keyring`.
- `PlatformConnection` entity — `secretRef` only, never token value.
- Migration v5: `platform_connections` table.
- Backup rule: `.reizoko-backup` **не содержит** tokens; restore → `needs_reconnect`.
- Log redaction: `***REDACTED***`.
- Password rule: Reizoko **не сохраняет** пароли IG/VK/Telegram.

---

# STAGE 2 — Web + Shared Hosting + Sync ⬜ DEFERRED

> **DEFERRED** — не входит в текущий план разработки. Сохранено в долгосрочной дорожной карте.

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

# STAGE 3 — VPS + Automation ⬜ DEFERRED

> **DEFERRED** — не входит в текущий план разработки. Часть задач (OAuth, publishing, scheduler) переносится в Stage 1.5 как **локальный desktop** вариант.

Цель: автоматическая публикация при выключенном ПК, server workers, cloud queue.

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
| P.1 | Instagram | ✅ Stage 1 | ⬜ Stage 1.5 | Active — requires public media URL |
| P.2 | Telegram | ✅ Stage 1 | ✅ Stage 1.5 | Bot API publishing |
| P.3 | VK | ✅ Stage 1 | ✅ Stage 1.5 | OAuth + wall publishing |
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
1.21  Stage 1 completion gate (✅ DONE, tag v0.1.0-stage1)
  ↓
1.5.x Connected & Publishing Desktop (🟡 CURRENT)
  ↓
2.x   Web / Cloud Sync (DEFERRED)
  ↓
3.x   Server Automation (DEFERRED)
```
