# Reizoko — MASTER CONTEXT

> **Главный документ контекста проекта.**  
> Передаётся новому AI-агенту или разработчику без истории предыдущих обсуждений.  
> Актуализирован по аудиту репозитория: **21 августа 2026**.

См. также: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md)

---

## 1. Что такое Reizoko

**Reizoko** — единый центр подготовки, хранения и публикации контента в социальные сети.

Пользователь создаёт **Master Post** — независимый мастер-контент в блочном редакторе. Открытые платформенные вкладки показывают **живые preview** этого же Master Post, преобразованные через **Platform Adapter** под правила конкретной площадки.

### Основная UX-концепция

```text
[Редактор] [Instagram] [Telegram] [VK] [+]
```

- **Редактор** — Master Post (источник истины).
- **Instagram / Telegram / VK** — live preview одного и того же контента.
- **`+`** — Platform Picker для добавления preview-вкладок.

Изменения **текста, заголовка, изображений, порядка блоков** в редакторе автоматически отражаются во всех открытых preview.

Platform Adapter:
- преобразует блоки Master Post в формат площадки (`transform`);
- проверяет ограничения (`validate`);
- отдаёт React-компонент preview.

---

## 2. Библиотека публикаций — центральная идея

Reizoko хранит **собственную независимую библиотеку** всего созданного контента — не привязанную к одной соцсети.

Один **Content Item** может:

- публиковаться **много раз**;
- использоваться **через год**;
- наполнять **новый аккаунт**;
- редактироваться с **revision history**;
- использоваться для **будущего расписания**;
- публиковаться в **новые соцсети позже**.

### Принцип (неизменяемый)

```text
ContentItem ≠ Publication
```

- **ContentItem** — мастер-пост в библиотеке Reizoko.
- **Publication** — конкретная попытка/факт публикации конкретной revision на конкретной площадке/аккаунте.

Один ContentItem → много Publications.

---

## 3. Архитектурные этапы

### STAGE 1 — Local Desktop *(текущий основной этап)*

| Аспект | Решение |
|--------|---------|
| UI | React 19 + TypeScript |
| Desktop shell | Tauri 2 |
| БД | SQLite (`tauri-plugin-sql`) |
| Медиа | Локальная медиатека в App Data |
| Сервер | **Не требуется** — полностью автономная работа |

**Цель Stage 1:** полноценный локальный workflow создания контента, preview, библиотеки и сохранения workspace.

**Не в scope Stage 1:** реальные API соцсетей, cloud sync, серверный scheduler.

---

### STAGE 2 — Web + Shared Hosting + Sync *(будущее)*

- Browser client (`apps/web`)
- Cloud repository
- Desktop ↔ Cloud synchronization
- Media sync
- Облачная библиотека
- Capabilities: `cloudSync`, `webAccess`

**Ограничение:** Stage 2 не должен требовать переписывания Stage 1 frontend/core. Core и data model расширяются, не ломаются.

**Инфраструктура:** ориентир на shared hosting (не VPS backend).

---

### STAGE 3 — VPS + Automation *(будущее)*

- NestJS API
- PostgreSQL
- Redis + BullMQ
- Background workers + scheduler
- OAuth соцсетей
- Automatic publishing, retries, webhooks
- Публикация при выключенном ПК пользователя
- Capabilities: `serverScheduler`, `backgroundPublishing`, `recurringPublishing`

---

## 4. Natural Time / Exact Time

**Принятое решение по расписанию** (модель в `@reizoko/shared`, реализация scheduler — Stage 3).

### Natural Time *(по умолчанию)*

Запланированная публикация получает небольшое естественное смещение. Минуты, кратные 5, по возможности **не используются**:

```text
00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
```

Пример: ориентировочные 16:00 → `15:57`, `16:03`, `16:12`, `16:17`.

**Цель:** избегать очевидно механического паттерна публикаций.

Реализация: `applyNaturalTimeOffset()` в `packages/shared/src/types/scheduling.ts`.

### Publish exactly on time

Если пользователь **явно включает** режим `exact`, публикация выходит **точно** в выбранное время (Новый год, старт события и т.д.).

Exact Time **полностью отключает** Natural Time jitter.

Реализация: `resolveScheduledTime()` — при `mode: 'exact'` возвращает target без смещения.

---

## 5. Технологический стек (фактические версии)

Проверено по `package.json`, `pnpm-lock.yaml` и окружению разработки (Windows, 21.08.2026):

| Компонент | Версия |
|-----------|--------|
| Node.js | **v24.16.0** (engines: `>=20`) |
| pnpm | **9.15.9** (`packageManager`) |
| TypeScript | **^5.8.2** |
| React / React DOM | **^19.0.0** (lock: 19.2.8) |
| Tauri (Rust crate) | **2** |
| @tauri-apps/api | **^2.3.0** |
| @tauri-apps/cli | **^2.3.1** |
| Rust (rustc) | **1.98.0** |
| Vite | **^6.2.0** |
| Zustand | **^5.0.3** |
| @dnd-kit/core | **^6.3.1** |
| @dnd-kit/sortable | **^10.0.0** |
| tauri-plugin-sql | **^2.2.0** |
| tauri-plugin-dialog / fs | **^2.2.0** |
| lucide-react | **^0.475.0** |
| ESLint | **^9.21.0** |
| Prettier | **^3.5.3** |
| Playwright | **^1.51.0** (screenshot scripts) |

**TypeScript strict:** включён в `tsconfig.base.json` (`strict`, `noUnusedLocals`, `noUnusedParameters`).

---

## 6. Структура репозитория

Monorepo на **pnpm workspaces** (`pnpm-workspace.yaml`: `apps/*`, `packages/*`, `platforms/*`).

```text
D:\_APP\Reizoko\
├── apps/
│   └── desktop/              # Tauri 2 + React UI (единственное приложение Stage 1)
│       ├── src/              # React: AppShell, views, Zustand store, Tauri DB client
│       ├── src-tauri/        # Rust: Tauri plugins (sql, dialog, fs)
│       └── vite.config.ts
├── packages/
│   ├── shared/               # Domain types, UUID, capabilities, scheduling utils
│   ├── core/                 # Business logic: ContentService, workspace defaults
│   ├── database/             # SQLite client abstraction, migrations, repositories
│   ├── platform-sdk/         # PlatformAdapter interface, registry
│   ├── ui/                   # Shared UI primitives, ThemeProvider, design tokens
│   └── editor/               # Block-based Master Post editor (dnd-kit)
├── platforms/
│   ├── instagram/            # Instagram adapter + preview
│   ├── telegram/             # Telegram adapter + preview
│   └── vk/                   # VK adapter + preview
├── docs/                     # Документация (этот файл — главный)
├── scripts/                  # SuperDesign CLI helpers, screenshot capture
├── .superdesign/             # Approved design system notes + generation prompts
├── dev.bat                   # Windows launcher (pnpm tauri:dev)
├── package.json              # Root scripts
└── pnpm-workspace.yaml
```

**Отсутствуют (планируются позже):** `apps/web`, `apps/server`.

---

## 7. Core Data Model

Все первичные сущности используют **UUID** (`crypto.randomUUID()` через `generateId()` в `@reizoko/shared`).

### ContentBlock

| Поле | Тип | Назначение |
|------|-----|------------|
| `id` | UUID | ID блока |
| `type` | `ContentBlockType` | text, heading, image (+ planned: video, link, gallery, file, poll, quote) |
| `order` | number | Порядок в документе |
| `data` | union | Payload блока |

**Реализованные типы блоков:** `text`, `heading`, `image`.  
**Planned:** video, link, gallery, file, poll, quote.

### ContentItem

| Поле | Назначение |
|------|------------|
| `id` | UUID |
| `createdAt`, `updatedAt`, `deletedAt?` | Timestamps + soft delete |
| `currentRevisionId` | UUID текущей revision |
| `metadata.title`, `metadata.tags?`, `metadata.notes?` | Метаданные |
| `syncState?`, `deviceId?` | Sync-ready metadata (Stage 2+) |

### ContentRevision

| Поле | Назначение |
|------|------------|
| `id` | UUID |
| `contentItemId` | FK → ContentItem |
| `createdAt` | Время создания revision |
| `blocks` | ContentBlock[] |
| `version` | Инкремент при каждом save |

**Поведение:** каждое сохранение создаёт **новую revision** (append-only history). UI для просмотра истории **ещё не реализован**.

### ContentItemSummary

Облегчённая проекция для Library: `id`, `title`, `previewText`, `createdAt`, `updatedAt`.

### Publication

| Поле | Назначение |
|------|------------|
| `id` | UUID |
| `contentRevisionId` | Какая revision публикуется |
| `socialAccountId?` | Аккаунт (Stage 3) |
| `platformId` | Целевая площадка |
| `status` | draft / scheduled / publishing / published / failed / cancelled |
| `scheduledAt?`, `publishedAt?`, `remotePostId?` | Scheduling & result |

**Статус:** таблица в SQLite **существует**, TypeScript-тип **определён**, repository/UI **не реализованы**.

### SocialAccount

| Поле | Назначение |
|------|------------|
| `id`, `platformId`, `displayName`, `connectedAt`, `isActive` | Локальная модель аккаунта |

**Статус:** таблица в SQLite **существует**, UI/repository **не реализованы**.

### MediaItem

| Поле | Назначение |
|------|------------|
| `id`, `filename`, `mimeType`, `size`, `width?`, `height?` | Метаданные |
| `localPath` | Путь к файлу в App Data |
| `createdAt`, `updatedAt`, `deletedAt?` | Timestamps |

### WorkspaceState

| Поле | Назначение |
|------|------------|
| `activeTabId` | `'editor'` или `'platform-{id}'` |
| `openPlatformTabs` | string[] — открытые platform IDs |
| `currentContentItemId` | UUID текущего draft в редакторе |
| `sidebarSection` | editor / library / calendar / history / accounts / settings |

### Settings

Key-value в таблице `app_settings`. Используется ключ `appearance.themeMode` (`system` | `light` | `dark`).

### Schedule entities

`ScheduleConfig`, `ScheduleMode`, `NaturalTimeOptions` — **типы и утилиты** в `@reizoko/shared`. UI и server scheduler — **Stage 3**.

### Sync metadata

`SyncState`: `local` | `pending` | `synced` | `conflict` — поля на ContentItem для Stage 2.

---

## 8. SQLite

### Где создаётся база

- Конфиг: `apps/desktop/src-tauri/tauri.conf.json` → `"preload": ["sqlite:reizoko.db"]`
- Подключение: `TauriDatabaseClient.connect('sqlite:reizoko.db')` в `apps/desktop/src/db/tauri-database-client.ts`
- Физический путь: **App Data directory Tauri** (управляется `tauri-plugin-sql`)

### Медиафайлы

Копируются в `{AppData}/media/{uuid}-{filename}` через `@tauri-apps/plugin-fs` (`media-service.ts`).

### Архитектура доступа

```text
React UI  →  Zustand store  →  ContentService / repositories  →  DatabaseClient  →  SQLite
```

**UI напрямую SQL не выполняет.** Только `packages/database`.

### DatabaseClient

Интерфейс в `packages/database/src/client/database-client.ts`:
- `execute()`, `select()`, `batch()`

Tauri-реализация: `apps/desktop/src/db/tauri-database-client.ts` (обёртка `@tauri-apps/plugin-sql`).

### Bootstrap

`bootstrapDatabase(client)` → migrations → repositories:
- `SqliteContentRepository`
- `SqliteWorkspaceRepository`
- `SqliteSettingsRepository`
- `SqliteMediaRepository`

### Migrations

`packages/database/src/migrations/index.ts` — **migration v1 `initial_schema`**.

Таблицы:
- `schema_migrations`
- `content_items`, `content_revisions`
- `publications`
- `media_items`
- `workspace_state`
- `app_settings`
- `social_accounts`

Migrations запускаются **на каждом старте** приложения.

---

## 9. Platform Adapter Architecture

### Interface (`@reizoko/platform-sdk`)

```typescript
interface PlatformAdapter {
  id: string;
  name: string;
  icon: string;
  color: string;
  available: boolean;
  plannedMessage?: string;
  capabilities: PlatformCapabilities;
  transform(blocks: ContentBlock[]): TransformedContent;
  validate(blocks: ContentBlock[]): PlatformValidationIssue[];
}

interface PlatformDefinition {
  adapter: PlatformAdapter;
  Preview: ComponentType<PlatformPreviewProps>;
}
```

Регистрация: `platformRegistry.register()` при import side-effect в `main.tsx`.

### Instagram *(available)*

| Аспект | Реализация |
|--------|------------|
| Adapter | `platforms/instagram/src/InstagramAdapter.ts` |
| Preview | `InstagramPreview.tsx` — feed-style card, carousel dots |
| Transform | Plain text caption, images → carousel |
| Validation | Max 2200 chars, heading → warning, multi-image → info |
| Capabilities | maxTextLength 2200, maxImages 10, no headings |

### Telegram *(available)*

| Аспект | Реализация |
|--------|------------|
| Adapter | `platforms/telegram/src/TelegramAdapter.ts` |
| Preview | `TelegramPreview.tsx` — chat bubble style |
| Transform | Headings → `<b>`, HTML formatting |
| Validation | Max 4096 chars |
| Capabilities | headings, links, multiple images |

### VK *(available)*

| Аспект | Реализация |
|--------|------------|
| Adapter | `platforms/vk/src/VkAdapter.ts` |
| Preview | `VkPreview.tsx` — wall post style |
| Transform | Plain text, images |
| Validation | Heading → info |
| Capabilities | maxTextLength 16384, links |

### Planned platforms *(catalog only, `available: false`)*

Facebook, Threads, X, TikTok, LinkedIn, Bluesky — определены в `apps/desktop/src/platforms/planned-catalog.ts`. Stub adapters без preview.

---

## 10. Capability System

### Capabilities

| ID | Stage 1 | Planned Stage | Описание |
|----|---------|---------------|----------|
| `cloudSync` | **false** | 2 | Desktop ↔ Cloud sync |
| `webAccess` | **false** | 2 | Browser client |
| `serverScheduler` | **false** | 3 | Server-side scheduling |
| `backgroundPublishing` | **false** | 3 | Publish when PC off |
| `recurringPublishing` | **false** | 3 | Evergreen/recurring posts |

**Stage 1 values:** `STAGE1_CAPABILITIES` в `packages/shared/src/types/capabilities.ts`.

### Зачем существует

UI проверяет **capabilities**, а не номера stage. Disabled features показывают `PlannedFeature` с объяснением через `getDisabledReason()` (`@reizoko/core`).

Sidebar sections **Календарь, История, Аккаунты, Планирование, Аналитика, Команды** — отображаются как planned (badge «скоро»).

---

## 11. UI Architecture

### Компоненты (`apps/desktop/src/components/`)

| Компонент | Назначение |
|-----------|------------|
| `AppShell` | Root layout: sidebar + workspace + overlays |
| `Sidebar` (`@reizoko/ui`) | Nav groups: Работа / Скоро, Settings, collapse |
| `TabBar` | Browser-like tabs: Редактор \| platforms \| +, Local•Saved |
| `BlockEditor` (`@reizoko/editor`) | Master Post canvas |
| `InspectorPanel` | Right panel (~280px): Platform, Проверка, Preview thumbnail |
| `StatusBar` | Save status, blocks count, autosave, Опубликовать ▾ (disabled) |
| `PlatformPreviewPanel` | Full platform preview in center workspace |
| `PlatformPicker` | Modal overlay для добавления preview |
| `LibraryView` | Content library |
| `SettingsView` | Theme selection + About |
| `AppHeader` | **Legacy — не используется в AppShell** |

### Approved design concept

- Desktop creative workspace
- Browser-like tabs
- Document canvas (center)
- Inspector справа (~280px)
- Compact desktop density (не mobile)
- Teal accent: Light `#0D9488`, Dark `#2DD4BF`
- Light Theme + Dark Theme (единственная design system)
- Warm neutrals (light), independent dark palette

Источник tokens: `packages/ui/src/styles/tokens.css`, `.superdesign/approved-design-system.md`.

---

## 12. Light / Dark Theme

| Аспект | Реализация |
|--------|------------|
| Provider | `ThemeProvider` (`packages/ui/src/theme/ThemeProvider.tsx`) |
| Modes | `system` \| `light` \| `dark` |
| Resolution | `resolveTheme()` — system follows `prefers-color-scheme` |
| CSS | `data-theme="light"` / `"dark"` на `<html>` |
| Tokens | CSS variables в `tokens.css` |
| Persistence | `localStorage` key `reizoko-theme-mode` + SQLite `app_settings` |
| Anti-flash | Inline script в `apps/desktop/index.html` до React mount |
| Wiring | Zustand `themeMode` → ThemeProvider → `setThemeMode()` saves to DB |

---

## 13. Persisted Workspace

Сохраняется в SQLite (`workspace_state`, id=1) и восстанавливается при старте:

| Состояние | Сохраняется |
|-----------|-------------|
| Active tab | ✅ `activeTabId` |
| Open platform tabs | ✅ `openPlatformTabs[]` |
| Current content item | ✅ `currentContentItemId` |
| Sidebar section | ✅ `sidebarSection` |
| Blocks / title | ✅ через ContentItem revisions (autosave ~800ms debounce) |
| Theme | ✅ `app_settings` + localStorage |
| Media paths | ✅ `media_items` table (reloaded on init) |
| Library query | ❌ не персистится (сбрасывается) |
| Platform picker open | ❌ session-only |

---

## 14. Library — фактические возможности

| Функция | Статус |
|---------|--------|
| Поиск по title + blocks JSON | ✅ |
| Grid / List toggle | ✅ |
| Open item → editor | ✅ |
| Duplicate (copy) | ✅ |
| Create new draft | ✅ |
| Empty state | ✅ |
| Count badge | ✅ |
| Thumbnails / platform badges | ❌ |
| Archive / delete UI | ❌ (delete API exists in repository, не exposed in UI) |
| Filters / tags | ❌ |
| Sync indicators | ❌ (Stage 2) |

---

## 15. Design Status

### Approved design

- **Единственное направление:** warm neutral Light + independent Dark (см. `.superdesign/approved-design-system.md`)
- **Не нужны** множественные альтернативные SuperDesign screens — дизайн развивается последовательно от одного approved direction
- **Editor shell** (sidebar, tabs, canvas, inspector, status bar) — реализован и считается эталоном layout

### SuperDesign materials (в репозитории)

| Путь | Содержание |
|------|------------|
| `.superdesign/approved-design-system.md` | Semantic tokens, layout zones |
| `.superdesign/tmp/` | Generation prompts и flow JSON (dev artifacts) |
| `scripts/superdesign-*.mjs` | CLI helpers для SuperDesign |

### SuperDesign project (external, из истории разработки)

- **Project:** Reizoko — Approved Design v2
- **URL:** https://superdesign.dev/teams/0a333b51-19da-49d4-b8e8-4cd8355d1eac/projects/8b96e25f-d203-462f-b546-813068902b21

### Screenshots

| Путь | Статус |
|------|--------|
| `docs/screenshots/` | **Не создан** (script `scripts/capture-screenshots.mjs` готов) |
| `docs/superdesign-approved/` | **Не сохранён в репозитории** |

---

## 16. Feature Status Table

| Feature | Status | Notes |
|---------|--------|-------|
| Monorepo + pnpm workspaces | DONE | 11 packages |
| TypeScript strict | DONE | Root tsconfig |
| Tauri 2 desktop shell | DONE | Windows target |
| SQLite + migrations | DONE | v1 schema |
| Repository layer | DONE | Content, Workspace, Settings, Media |
| UUID IDs | DONE | All entities |
| ContentItem + ContentRevision | DONE | Append-only revisions on save |
| Block editor (text, heading, image) | DONE | dnd-kit reorder |
| Autosave | DONE | Debounced ~800ms |
| Workspace persistence | DONE | Tabs, draft, sidebar |
| Tab bar (editor + platforms) | DONE | Close platform tabs |
| Platform registry | DONE | |
| Instagram preview | DONE | Live transform |
| Telegram preview | DONE | Live transform |
| VK preview | DONE | Live transform |
| Platform Picker | DONE | Modal, planned platforms |
| Inspector panel | DONE | Checks + mini preview |
| Library (search, open, duplicate) | DONE | Grid/list |
| Settings (theme) | DONE | system/light/dark |
| Light/Dark themes | DONE | Tokens + persistence |
| Media pick & store | DONE | Tauri dialog + AppData |
| Capability system | DONE | Stage 1 all false |
| Planned feature UI | DONE | Sidebar «скоро» sections |
| Approved editor shell design | DONE | Primary reference layout |
| Library/Settings design polish | IN PROGRESS | Simpler than editor shell |
| Dark theme consistency (all screens) | IN PROGRESS | Editor OK; secondary screens need pass |
| Revision history UI | PLANNED STAGE 1 | Data layer exists |
| Publication repository/UI | PLANNED STAGE 1 | Schema only |
| Social accounts UI | PLANNED STAGE 1 | Schema only |
| Publish button | PLANNED STAGE 3 | Disabled in StatusBar |
| Calendar / History / Analytics | PLANNED STAGE 2/3 | PlannedFeature placeholders |
| Cloud sync | PLANNED STAGE 2 | |
| Web client | PLANNED STAGE 2 | |
| Server scheduler | PLANNED STAGE 3 | Natural/Exact time modeled |
| OAuth + API publishing | PLANNED STAGE 3 | |
| Automated tests | PLANNED STAGE 1 | No test files |
| Backup/export | PLANNED STAGE 1 | Not implemented |
| Production EXE build | NEXT | No build artifacts in repo |
| docs/screenshots | NEXT | Script exists, output missing |

---

## 17. CURRENT POSITION

```text
Stage:        1 — Local Desktop
Substage:     1.19 — UI/UX polish & Light/Dark consistency
Current task: Приведение Library, Settings и вторичных экранов
              к approved design direction; dark theme pass
Next task:    Production desktop build (tauri:build), install verification,
              screenshot capture, Stage 1 stabilization
```

**Честная оценка:** Core Stage 1 workflow **работает** (editor → live previews → library → persistence). Остаётся **UI consistency**, **отсутствие tests/build artifacts**, и **schema-only** features (publications, accounts, revision UI).

---

## 18. Known Issues / Technical Debt

| Категория | Описание |
|-----------|----------|
| Legacy component | `AppHeader.tsx` — не используется, можно удалить |
| Dead UI control | TabBar menu button (`tab-bar__menu`) — без handler |
| Publish UI | Кнопка «Опубликовать» disabled — корректно для Stage 1, но без local draft flow |
| Publication layer | Таблица есть, repository/UI нет |
| Revision history | Сохраняется в DB, UI просмотра/restore нет |
| Social accounts | Таблица есть, UI нет |
| Tests | **0 test files** в репозитории |
| Screenshots docs | `docs/screenshots/` пуст |
| SuperDesign PNG refs | Не закоммичены в repo |
| Git | **Zero commits** — весь проект untracked |
| README commands | Устарели (`--filter` в tauri:dev не нужен при root script) |
| Block types | 6 planned types throw on create |
| Media size | `size: 0` при import (не вычисляется) |
| Search | LIKE по JSON — работает, но не full-text |
| Windows PowerShell | `pnpm.ps1` blocked — использовать `pnpm.cmd` или `dev.bat` |
| Cursor IDE | Auto-opens localhost:1420 tab — mitigated via vite `open: false` + Cursor settings |
| TODO/FIXME | **Не найдено** в коде (grep по ts/tsx/rs) |

---

## 19. Git State

| Параметр | Значение |
|----------|----------|
| Branch | `master` |
| Commits | **0** (репозиторий инициализирован, но пуст) |
| Remote | **Не настроен** |
| Uncommitted | **Весь проект** — 15 untracked top-level paths |
| Staged changes | Нет |
| Diff | N/A (нет baseline commit) |

Untracked paths:
`.gitignore`, `.prettierrc`, `.superdesign/`, `README.md`, `apps/`, `dev.bat`, `docs/`, `eslint.config.js`, `package.json`, `packages/`, `platforms/`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `scripts/`, `tsconfig.base.json`

---

## 20. Development Commands

Проверенные команды (Windows):

```cmd
cd /d D:\_APP\Reizoko
pnpm install
pnpm tauri:dev
pnpm typecheck
pnpm lint
pnpm tauri:build
```

Дополнительно:

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Vite dev server only (port 1420) |
| `pnpm build` | Build all workspace packages |
| `pnpm build:desktop` | Desktop frontend build |
| `pnpm lint:fix` | ESLint autofix |
| `pnpm format` / `format:check` | Prettier |
| `pnpm test` | Runs tests if present (currently none) |
| `dev.bat` | `cd` to repo + `pnpm.cmd tauri:dev` + `BROWSER=none` |
| `pnpm --filter @reizoko/desktop screenshots` | Playwright screenshots (needs build) |

**PowerShell note:** при ExecutionPolicy ошибках использовать `cmd /c` или `pnpm.cmd`.

---

## 21. Build Artifacts

**На момент аудита артефакты отсутствуют** (`apps/desktop/src-tauri/target/release/` не создан).

После `pnpm tauri:build` ожидаемые пути (Tauri 2, Windows):

```text
apps/desktop/src-tauri/target/release/reizoko-desktop.exe
apps/desktop/src-tauri/target/release/bundle/msi/Reizoko_0.1.0_*.msi
apps/desktop/src-tauri/target/release/bundle/nsis/Reizoko_0.1.0_*.exe
```

Frontend dist: `apps/desktop/dist/`

---

## 22. Правила разработки

1. **TypeScript strict** — обязателен.
2. **UI не обращается к SQLite напрямую** — только через repositories/services.
3. **Не смешивать platform-specific logic с core** — только через Platform Adapter.
4. **Новая соцсеть** — новый модуль в `platforms/`, регистрация в registry.
5. **Core пригоден для будущего Web** — без Tauri-зависимостей в `packages/core`, `packages/shared`, `packages/database` interfaces.
6. **Не привязывать бизнес-логику к Tauri** — Tauri только в `apps/desktop`.
7. **Не делать fake functionality** — disabled UI с honest «Planned» messaging.
8. **Future functions через capabilities** — не hardcoded stage checks.
9. **Не делать commit/push без явной команды пользователя.**
10. **Перед крупной архитектурной переделкой** — объяснить необходимость.
11. **Light и Dark Theme обязательны** для всех новых UI.
12. **Новые screens** — соответствуют approved Reizoko design (`.superdesign/approved-design-system.md`).

---

## 23. Решения, которые нельзя менять без обсуждения

| Решение | Причина |
|---------|---------|
| `ContentItem ≠ Publication` | Фундаментальная модель библиотеки |
| Block-based Master Post (не HTML editor) | Platform adapters, sync-ready |
| UUID для всех entities | Sync Stage 2 |
| Capability flags вместо stage checks | Extensibility |
| Platform Adapter pattern | Добавление соцсетей без изменения core |
| Natural Time default / Exact Time opt-in | Продуктовое решение по scheduling |
| Core/Desktop separation | Future web + server |
| Approved design direction (teal, warm light, independent dark) | User-approved visual identity |
| Stage 1 = fully local, no server | Scope boundary |

---

## 24. Что делать следующим

См. [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md):

- **🟡 IN PROGRESS:** 1.19 UI/UX polish & Light/Dark consistency
- **➡️ NEXT:** 1.20 Production desktop build & Stage 1 stabilization

После stabilization Stage 1 → revision history UI, publication drafts, tests, backup/export — затем Stage 2 planning.
