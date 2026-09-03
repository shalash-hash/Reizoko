# Reizoko — MASTER CONTEXT

> **Главный документ контекста проекта.**  
> Передаётся новому AI-агенту или разработчику без истории предыдущих обсуждений.  
> Актуализирован: **3 сентября 2026** (Stage 1.5 — Connected & Publishing Desktop).

**AI entry point:** [AI_CONTEXT_INDEX.md](./AI_CONTEXT_INDEX.md) · Handoff: [HANDOFF_TO_CHATGPT.md](./HANDOFF_TO_CHATGPT.md) · Decisions: [DECISIONS_CHANGELOG.md](./DECISIONS_CHANGELOG.md) · Process: [AI_COLLABORATION_PROTOCOL.md](./AI_COLLABORATION_PROTOCOL.md)

См. также: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md)

---

## Current Goal

```text
Complete standalone Windows desktop Reizoko.

Web / Cloud / Server development: DEFERRED.
```

**Stage 1 baseline:** `v0.1.0-stage1` — Local Desktop ✅ COMPLETE.  
**Current stage:** Stage 1.5 — Connected & Publishing Desktop 🟡 (1.5.1–1.5.6 ✅; next: 1.5.7 Instagram/Meta)

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

Один ContentItem → много Publications через **PublicationBatch** (одна команда пользователя может подготовить несколько площадок одновременно).

```text
ContentItem
    ↓
ContentRevision checkpoint (origin=publication, immutable)
    ↓
PublicationBatch
    ↓
Publication[]  (по одной на platformId + socialAccountId)
```

---

## 3. Архитектурные этапы

### STAGE 1 — Local Desktop ✅ COMPLETE

| Аспект | Решение |
|--------|---------|
| UI | React 19 + TypeScript |
| Desktop shell | Tauri 2 |
| БД | SQLite (`tauri-plugin-sql`) |
| Медиа | Локальная медиатека в App Data |
| Сервер | **Не требуется** — полностью автономная работа |

**Цель Stage 1 достигнута:** локальный workflow создания контента, preview, библиотеки, persistence, production build.  
**Baseline tag:** `v0.1.0-stage1`

---

### STAGE 1.5 — Connected & Publishing Desktop 🟡 CURRENT

| Аспект | Решение |
|--------|---------|
| Авторизация | Официальные API flows per platform (OAuth, bot token, …) |
| Secrets | Windows Credential Manager (`SecretStore`), не SQLite |
| Публикация | Локальный `PlatformPublisher` из desktop |
| Scheduler | Локальный, пока ПК включён |
| Очередь | In-process local queue (без Redis/BullMQ) |
| Backend | **Не требуется** |

**Цель Stage 1.5:** реальные аккаунты, публикация, scheduler, история — pure desktop.

Platform research: [platform-connections/](./platform-connections/README.md)

---

### STAGE 2 — Web + Shared Hosting + Sync ⬜ DEFERRED

> Не входит в текущий план разработки.

- Browser client (`apps/web`)
- Cloud repository
- Desktop ↔ Cloud synchronization
- Media sync
- Облачная библиотека
- Capabilities: `cloudSync`, `webAccess`

**Ограничение:** Stage 2 не должен требовать переписывания Stage 1 frontend/core. Core и data model расширяются, не ломаются.

**Инфраструктура:** ориентир на shared hosting (не VPS backend).

---

### STAGE 3 — VPS + Automation ⬜ DEFERRED

> Не входит в текущий план разработки. Server-side scheduler/queue отложены; desktop publishing реализуется в Stage 1.5.

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
| `createdAt`, `updatedAt` | Timestamps (updatedAt — для working revision) |
| `metadata` | Snapshot title/tags/notes на момент revision |
| `blocks` | ContentBlock[] |
| `version` | Монотонный номер версии (не откатывается при restore) |
| `origin` | `auto` \| `manual` \| `restore` \| `publication` \| `legacy` |
| `kind` | `working` (текущая, может обновляться) \| `checkpoint` (immutable snapshot) |
| `restoreFromVersion?` | Для origin=restore — номер восстановленной версии |

**Revision policy (с 1.11):**

- **Working revision** — текущее состояние; обновляется in-place при autosave (debounce ~600ms).
- **Historical checkpoint** — immutable snapshot; создаётся при:
  - паузе редактирования **≥ 5 минут** между сохранениями;
  - ручном «Создать версию»;
  - перед restore (snapshot текущего состояния).
- **Restore** — создаёт **новую** working revision из snapshot выбранной версии; история не откатывается.
- **Legacy revisions** (до migration v2): origin=`legacy`, title backfill из текущего `ContentItem.metadata`; в UI агрегируются по 5‑минутным интервалам.

> Revisions, созданные до migration v2, получают текущий title при backfill, потому что исторический title ранее не сохранялся.

**UI:** Revision History Drawer (кнопка в TabBar) — список, preview, restore, manual checkpoint.

### ContentItemSummary

Облегчённая проекция для Library: `id`, `title`, `previewText`, `createdAt`, `updatedAt`.

### PublicationBatch

| Поле | Назначение |
|------|------------|
| `id` | UUID |
| `contentItemId` | К какому ContentItem относится batch |
| `contentRevisionId` | **Immutable publication checkpoint** (не working revision) |
| `createdAt`, `updatedAt` | Timestamps |

Одна команда «Подготовить публикацию» создаёт **один** PublicationBatch и **N** Publications (по числу открытых platform tabs / targets).

Повторная подготовка того же ContentItem создаёт **новый** batch; старые batches не изменяются.

### Publication

| Поле | Назначение |
|------|------------|
| `id` | UUID |
| `batchId` | Связь с PublicationBatch |
| `contentRevisionId` | Immutable publication checkpoint (та же revision, что у batch) |
| `socialAccountId?` | Аккаунт (`null` на Stage 1; архитектура поддерживает несколько аккаунтов одной платформы) |
| `platformId` | Целевая площадка |
| `status` | draft / scheduled / publishing / published / failed / cancelled |
| `preparedSnapshot` | Immutable snapshot подготовленного platform content |
| `scheduledAt?`, `publishedAt?`, `remotePostId?` | Scheduling & result (Stage 3) |
| `createdAt`, `updatedAt` | Timestamps |

**Уникальный target:** `platformId + socialAccountId`, не просто `platformId`.

**Publication checkpoint (перед batch):**

1. Текущее состояние сохраняется;
2. Working revision → immutable checkpoint (`origin = publication`, `kind = checkpoint`);
3. Создаётся новая working revision для дальнейшего редактирования;
4. PublicationBatch ссылается на checkpoint.

После Prepare пользователь может продолжить редактировать Master Post — prepared Publications **не меняются**.

### PreparedPublicationSnapshot

Platform-neutral prepared snapshot Reizoko (не Meta/TG/VK API payload):

| Поле | Назначение |
|------|------------|
| `formatVersion` | `1` \| `2` (v2 includes `presentation` overrides from Platform Composer) |
| `platformId` | Площадка |
| `transformedContent` | Результат `PlatformAdapter.transform()` на момент подготовки |
| `validationIssues` | Результат `validate()` — errors/warnings **per target**, не блокируют весь batch |
| `preparedAt` | ISO timestamp |

Media в snapshot — через стабильные `mediaId`, не blob/UI URLs.

Stage 3 Publisher позже преобразует snapshot в конкретный API request.

**Статус Stage 1.12:** migration v3, repositories, `PublicationService.prepareBatch()`, UI «Подготовить публикацию», tests + smoke. Реальные API/OAuth/scheduler **не подключены**.

### SocialAccount

Профиль цели публикации (destination). Может быть локальным или привязанным к `PlatformConnection`.

| Поле | Назначение |
|------|------------|
| `id`, `platformId`, `displayName` | Идентификация профиля |
| `handle?` | `@username` для UI |
| `connectionId?` | Ссылка на credential (`PlatformConnection.id`); `null` = локальный профиль |
| `externalAccountId?` | Remote id (например Telegram chat id) |
| `avatarMediaId?` | Опциональный avatar через MediaItem |
| `isActive` | Активен ли профиль как новая target |
| `connectionState` | UI projection: `local` \| `connected` \| `needs_reconnect` — source of truth: `PlatformConnection.state` |
| `createdAt`, `updatedAt`, `deletedAt?` | Timestamps + soft delete |

**Security:** secrets не хранятся в SocialAccount. Token/session — только в Credential Manager через `secretRef` на connection.

**UX:** локальный профиль — «Локальный профиль»; connected destination — «Подключён» + «через @bot».

**Статус:** migration v4 (local profiles), v6 (`connectionId`). Telegram Bot API — первое реальное подключение (Stage 1.5.4).

```text
PlatformConnection (credential, 1 bot token)
        ↑
SocialAccount[] (destinations: channels/chats)
        ↓
PublicationTarget (platformId + socialAccountId)
        ↓
Publication
```

### PlatformConnection

Credential / authenticated identity (например Telegram Bot `@mybot`).

| Поле | Назначение |
|------|------------|
| `id`, `platformId`, `method` | Идентификация (`bot_token`, …) |
| `state` | `connected` \| `needs_reconnect` \| … — **source of truth** для publishability |
| `secretRef` | Ссылка на secret в Credential Manager (не plaintext) |

**Invariant:** `PlatformConnection` не может оставаться `connected`, если соответствующий credential в SecretStore отсутствует. При обнаружении рассинхрона состояние переводится в `needs_reconnect`, но `secretRef` сохраняется для стабильного ключа credential.

**Credential persistence:** Platform credentials в OS secure storage (Windows Credential Manager) хранятся **бессрочно** до явного disconnect, физического удаления credential, переноса на другой компьютер (backup без secrets) или подтверждённой недействительности token. Reizoko **не использует** произвольные TTL (1/7/30 дней). Обычные ошибки destination/network/publish **не удаляют** bot token.

**Credential namespace (Windows):** service `reizoko`, storage key = dot-форма `secretRef` (`connection.{id}.bot_token`). Одинаков для `tauri dev` и release build — пересборка не меняет namespace.
| `externalIdentityId?`, `displayName?`, `handle?` | Public bot identity |
| `connectedAt`, `lastValidatedAt`, `errorCode?`, `errorMessage?` | Connection lifecycle |

**Статус:** migration v5 (foundation), v6 (убрана 1:1 связь с `social_account_id`; destinations ссылаются на connection через `SocialAccount.connectionId`).

### MediaItem

| Поле | Назначение |
|------|------------|
| `id`, `filename`, `mimeType`, `size`, `width?`, `height?` | Метаданные |
| `localPath` | Путь к файлу в App Data |
| `createdAt`, `updatedAt`, `deletedAt?` | Timestamps |

### WorkspaceState

| Поле | Назначение |
|------|------------|
| `activeTabId` | `'editor'` или `'platform-{targetId}'` |
| `openPlatformTargets` | `OpenPlatformTarget[]` — открытые publication targets |
| `openPlatformTabs?` | **Legacy** string[] — мигрируется в `openPlatformTargets` (`socialAccountId = null`) |
| `currentContentItemId` | UUID текущего draft в редакторе |
| `sidebarSection` | editor / library / accounts / calendar / history / settings |

`OpenPlatformTarget`:

```ts
{ id, platformId, socialAccountId?: string | null }
```

Platform-only tab (без аккаунта) остаётся допустимым: `socialAccountId = null`.

### Settings

Key-value в таблице `app_settings`. Используется ключ `appearance.themeMode` (`system` | `light` | `dark`).

### Schedule entities

`ScheduleConfig`, `ScheduleMode`, `NaturalTimeOptions` — **типы и утилиты** в `@reizoko/shared`. UI и server scheduler — **Stage 3**.

### Sync metadata

`SyncState`: `local` | `pending` | `synced` | `conflict` — поля на ContentItem для Stage 2.

---

## 8. SQLite

### Где создаётся база

- Конфиг: `apps/desktop/src-tauri/tauri.conf.json` → `"preload": ["sqlite:reizoko.db", "sqlite:reizoko-smoke.db"]`
- Подключение: `TauriDatabaseClient.connect(getDatabasePath())` — production `reizoko.db`, smoke `reizoko-smoke.db` при `REIZOKO_SMOKE_TEST=1`
- **Automated test launch:** при `REIZOKO_SMOKE_TEST=1` окно создаётся скрытым (`visible: false`, `focused: false`, `skip_taskbar: true`) в `apps/desktop/src-tauri/src/lib.rs`. Все smoke runners используют `launchReizokoForSmoke()` из `scripts/smoke/lib.mjs`. Обычный запуск EXE без env var не меняется.
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

`packages/database/src/migrations/index.ts` — migrations **v1–v8** (latest: `v8-vk-publication-targets`).

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

## Backup & Restore Architecture

Portable domain backup — **не** копия `reizoko.db`. Формат versioned, независим от SQLite migration version.

### Файл архива

Расширение `.reizoko-backup` (ZIP-compatible container):

```text
reizoko-backup-YYYY-MM-DD-HHmmss.reizoko-backup
├── manifest.json
├── data.json
└── media/
    └── {mediaId}-{filename}
```

### manifest.json

- `format`: `reizoko-backup`
- `formatVersion`: `1` (backup format, ≠ `databaseSchemaVersion`)
- `databaseSchemaVersion`: текущая migration version (сейчас v4)
- `counts`, `mediaFiles[]` с `sha256`, `size`, `archivePath`
- `warnings[]` — например missing media

### data.json

Domain snapshot (не SQL dump):

- `contentItems`, `contentRevisions`, `mediaItems`
- `socialAccounts`, `publicationBatches`, `publications`
- `appSettings`, `workspaceState`

UUID сохраняются без изменения. Smoke paths (`reizoko-smoke.db`, `media-smoke/`) **исключаются**.

### Сервисный слой

| Слой | Путь |
|------|------|
| Types | `packages/shared/src/types/backup.ts` |
| BackupService | `packages/core/src/backup/backup-service.ts` |
| Validation | `packages/core/src/backup/backup-validator.ts` |
| Archive (ZIP) | `packages/core/src/backup/backup-archive.ts` |
| SHA-256 | `packages/core/src/backup/backup-crypto.ts` |
| Snapshot repo | `packages/database/src/repositories/backup-repository.impl.ts` |
| Desktop bridge | `apps/desktop/src/services/backup-runtime.ts` |
| Settings UI | `apps/desktop/src/components/BackupSettingsPanel.tsx` |

### Правила restore

1. **Validate first** — format, references, media checksums; corrupted backup блокирует restore.
2. **Safety backup** — перед destructive restore автоматически `pre-restore-backup-*.reizoko-backup`; если не удалось — restore не начинается.
3. **Atomic DB restore** — transaction delete+insert; media через staging directory.
4. **Preserve UUID** — все entity IDs восстанавливаются как в backup.
5. **Full replace** — backup становится текущим состоянием (merge не реализован).

### JSON export

`reizoko-export-YYYY-MM-DD.json` — domain data без бинарных media files. Для диагностики/архива, **не** полная замена backup.

### Quality commands

```text
pnpm quality          # typecheck + lint + test
pnpm quality:release  # quality + tauri:build
pnpm test:coverage    # vitest coverage (core + database)
pnpm smoke:backup     # targeted backup/restore smoke
```

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

### Telegram *(available + connected publishing)*

| Аспект | Реализация |
|--------|------------|
| Adapter | `platforms/telegram/src/TelegramAdapter.ts` |
| Preview | `TelegramPreview.tsx` — chat bubble style |
| Transform | Headings → `<b>`, HTML formatting (`parse_mode=HTML` при publish) |
| Validation | Max 4096 chars |
| Connection | Bot API via Tauri native transport; token в Credential Manager |
| Publishing | `TelegramPublisher` — `sendMessage` / `sendPhoto` / `sendMediaGroup` |
| Capabilities | headings, links, multiple images |

### VK *(available + connected publishing)*

| Компонент | Описание |
|-----------|----------|
| Adapter | `platforms/vk/src/VkAdapter.ts` — transform/validate (preview + publish) |
| Preview | `VkPreview.tsx` |
| Connection | `VkConnectionService` — OAuth (system browser), one credential → many targets |
| Targets | `social_accounts` + `platform_metadata_json` (`targetType`, `ownerId`, `postAsGroup`) |
| Publishing | `VkPublisher` — `wall.post` + `photos.getWallUploadServer` → upload → `photos.saveWallPhoto` |
| Destinations | self wall, managed communities (`from_group=1`), external user wall (if API allows) |

**Статус:** migration v8, OAuth via Tauri `vk_*` commands, real publish for connected VK targets (Stage 1.5.6).

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
| `AppHeader` | **Removed** (legacy, unused) |

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
| Open platform tabs | ✅ `openPlatformTargets[]` (+ legacy migration) |
| Current content item | ✅ `currentContentItemId` |
| Sidebar section | ✅ `sidebarSection` |
| Blocks / title | ✅ через ContentItem revisions (autosave ~600ms debounce, working revision coalescing) |
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
| `docs/screenshots/` | **14 screenshots** (light + dark for all main screens) |
| `docs/superdesign-approved/` | Reference PNGs committed |

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
| ContentItem + ContentRevision | DONE | Working revision + checkpoint policy |
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
| Library/Settings design polish | DONE | Light + Dark consistent |
| Dark theme consistency (all screens) | DONE | Semantic tokens throughout |
| Revision history UI | DONE | Drawer: list, preview, restore, manual checkpoint |
| Publication local architecture | DONE | Migration v3, batch, snapshots, prepare UI |
| Social accounts UI | ✅ DONE | AccountsView + local profiles (Stage 1.13) |
| Platform connections | ✅ DONE | v5/v6, Credential Manager, Telegram Bot API (Stage 1.5.2–1.5.4) |
| Telegram publish now | ✅ DONE | Real Bot API publish for connected destinations (Stage 1.5.4) |
| VK publish now | ✅ DONE | OAuth + wall.post for connected VK targets (Stage 1.5.6) |
| Publish now (IG) | PLANNED | Disabled «скоро» until platform connection |
| Calendar / History / Analytics | PLANNED STAGE 2/3 | PlannedFeature placeholders |
| Cloud sync | PLANNED STAGE 2 | |
| Web client | PLANNED STAGE 2 | |
| Server scheduler | PLANNED STAGE 3 | Natural/Exact time modeled |
| OAuth + API publishing | PLANNED STAGE 3 | |
| Platform Composer / overrides | ✅ DONE | Snapshot v2, migration v7, smoke:composer (Stage 1.5.5) |
| Backup/export | ✅ DONE | `.reizoko-backup` + JSON export + restore (Stage 1.14) |
| Production EXE build | DONE | Windows release build verified |
| docs/screenshots | DONE | 14 PNG files |

---

## 17. CURRENT POSITION

```text
Stage 1 — Local Desktop ✅ COMPLETE (baseline v0.1.0-stage1)

Stage 1.5 — Connected & Publishing Desktop 🟡 CURRENT
  ✅ Telegram bot connection + publish
  ✅ VK OAuth + publish (migration v8)
  ✅ Platform Composer + snapshot v2
  ➡️ Next: 1.5.7 Instagram / Meta Connection

Stage 2 — Web + Shared Hosting + Sync ⬜ DEFERRED (planning not started)
Stage 3 — VPS + Server Automation ⬜ DEFERRED
```

**Authoritative task status:** [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)  
**Acceptance record (historical):** [STAGE1_ACCEPTANCE.md](./STAGE1_ACCEPTANCE.md) — Stage 1 gate only.

**Статус 1.21:** Stage 1 Completion Gate закрыт — `pnpm stage1:acceptance`, chained smoke orchestrator, artifact verification.

**Статус 1.15:** Cleanup & Technical Debt закрыт — media file size, smoke lifecycle/isolation, migration tests, planned block types documented, README/gitignore/docs audit, background test mode.

**Статус 1.14:** Quality & Tooling закрыта — `pnpm quality`, coverage, portable backup/restore (`.reizoko-backup`), JSON export, Settings UI «Данные и резервные копии», backup tests + smoke suite PASS.

**Статус 1.13:** Local Accounts Architecture закрыта — migration v4, SocialAccount repository/service, AccountsView, account-aware tabs/picker/previews, publication integration, 12 automated tests + targeted smoke PASS.

**Статус 1.12:** Publication architecture закрыта — migration v3, PublicationBatch/Publication repositories, `PublicationService`, publication checkpoint (`origin=publication`), PreparedPublicationSnapshot, UI «Подготовить публикацию», 10 automated tests + targeted smoke PASS.

**Статус 1.11:** Revision History закрыт — migration v2, revision policy, UI drawer, restore создаёт новую revision, 10 automated tests + targeted smoke test PASS.

---

## 18. Known Issues / Technical Debt

| Категория | Описание |
|-----------|----------|
| Publish UI | «Подготовить публикацию» в dropdown; «Опубликовать сейчас» / «Запланировать» disabled «скоро» |
| Publication layer | ✅ DONE | Batch + snapshot architecture (Stage 1.12) |
| Revision history | ✅ DONE | Drawer UI + restore + manual checkpoint |
| Social accounts | ✅ DONE | Local profiles, no OAuth/secrets (Stage 1.13) |
| Tests | ✅ DONE | vitest + smoke suite + `pnpm stage1:acceptance` |
| Backup/restore | ✅ DONE | Portable `.reizoko-backup`, validate-first restore (Stage 1.14) |
| Background test mode | ✅ DONE | Smoke/E2E launch hidden, isolated DB (Stage 1.15) |
| Release smoke test | ✅ DONE | `scripts/release-smoke-test.mjs` — phases A–G; chained via `run-targeted-suite.mjs` |
| Stage 1 acceptance | ✅ DONE | `pnpm stage1:acceptance` + installer manual PASS (2026-08-22) |
| SuperDesign PNG refs | В `docs/superdesign-approved/` |
| Git | Repository ready for commit; push only on user command |
| README commands | ✅ DONE | Актуализирован |
| Block types | 6 planned types explicitly unsupported (`planned for a future stage`) |
| Media size | ✅ DONE | Actual file size stored on import (Stage 1.15) |
| Search | LIKE по JSON — работает, но не full-text (Stage 2) |
| Windows PowerShell | `pnpm.ps1` blocked — использовать `pnpm.cmd` или `dev.bat` (Stage 1 non-blocking) |
| Cursor IDE | Auto-opens localhost:1420 tab — mitigated via vite `open: false` (Stage 1 non-blocking) |
| TODO/FIXME | **Не найдено** в source (ts/tsx/rs) |

---

## 19. Git & GitHub (source of truth)

| Параметр | Значение |
|----------|----------|
| Repository | `https://github.com/shalash-hash/Reizoko.git` |
| Default branch | `master` |
| **Exact HEAD** | **READ FROM GIT / GITHUB** — не хранить в MASTER или HANDOFF как канон |
| Commit / push | **Только по явной команде пользователя** |

Семантический снимок для AI: [HANDOFF_TO_CHATGPT.md](./HANDOFF_TO_CHATGPT.md).

> **HISTORICAL:** ранние версии этого файла описывали «весь проект untracked» — это устарело; репозиторий на GitHub актуален.

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
| `pnpm test` | Vitest (core + database + desktop) |
| `pnpm test:coverage` | Coverage report (core + database) |
| `pnpm quality` | typecheck + lint + test |
| `pnpm quality:release` | quality + `tauri:build` |
| `pnpm smoke` | Full smoke regression suite |
| `pnpm smoke:backup` | Backup/restore targeted smoke |
| `pnpm smoke:accounts` | Accounts targeted smoke |
| `pnpm smoke:publication` | Publication draft smoke |
| `pnpm smoke:revision` | Revision history smoke |
| `pnpm smoke:release` | Release phases A–G |
| `pnpm smoke:clean-start` | Fresh DB end-to-end smoke |
| `dev.bat` | `cd` to repo + `pnpm.cmd tauri:dev` + `BROWSER=none` |
| `pnpm --filter @reizoko/desktop screenshots` | Playwright screenshots (needs build) |

**PowerShell note:** при ExecutionPolicy ошибках использовать `cmd /c` или `pnpm.cmd`.

---

## 21. Build Artifacts

**На момент последней сборки (21.08.2026, 15:27 UTC+6) артефакты существуют:**

| Artifact | Size | Timestamp |
|----------|------|-----------|
| `apps/desktop/src-tauri/target/release/reizoko-desktop.exe` | 4 941 152 B | 2026-08-21 15:27:08 |
| `.../bundle/msi/Reizoko_0.1.0_x64_en-US.msi` | 2 633 728 B | 2026-08-21 15:27:00 |
| `.../bundle/nsis/Reizoko_0.1.0_x64-setup.exe` | 1 960 686 B | 2026-08-21 15:27:08 |

```text
D:\_APP\Reizoko\apps\desktop\src-tauri\target\release\reizoko-desktop.exe
D:\_APP\Reizoko\apps\desktop\src-tauri\target\release\bundle\msi\Reizoko_0.1.0_x64_en-US.msi
D:\_APP\Reizoko\apps\desktop\src-tauri\target\release\bundle\nsis\Reizoko_0.1.0_x64-setup.exe
```

Frontend dist: `apps/desktop/dist/`

> Build artifacts не коммитятся (`.gitignore` → `target/`).

---

## 22. Правила разработки

### Разрешение конфликтов (канон vs код vs планы)

1. Последнее **явное решение пользователя**.
2. **MASTER_CONTEXT** (этот файл).
3. Более новый **профильный authoritative doc** (напр. DEVELOPMENT_PLAN > ROADMAP для статусов).
4. **Текущий код** — факт реализации, но **не** автоматическое product decision.
5. Historical / stale docs (STAGE1_ACCEPTANCE, старые снимки).

Различие документов **не означает** автоматический rollback. Не переписывать MASTER под код без согласования (**class C** — см. [AI_COLLABORATION_PROTOCOL.md](./AI_COLLABORATION_PROTOCOL.md)).

### Правила кода и процесса

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
13. **Background automated testing** — любые автоматические тесты, запускающие desktop Reizoko (smoke, E2E, integration), должны стартовать приложение в фоне (`REIZOKO_SMOKE_TEST=1` → hidden/minimized window, без перехвата focus). Обычный пользовательский запуск EXE не затрагивается.

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

См. [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) — **единственный authoritative список статусов задач**.

- **🟡 CURRENT:** Stage 1.5 — Connected & Publishing Desktop
- **➡️ NEXT (1.5.7):** Instagram / Meta Connection
- **⬜ PLANNED:** 1.5.8–1.5.15 (publisher engine unification, publish UX, scheduler, queue, acceptance)
- **⬜ DEFERRED:** Stage 2 (Web/Cloud Sync), Stage 3 (VPS automation)

Stage 1 Completion Gate **закрыт** (`pnpm stage1:acceptance`, `docs/STAGE1_ACCEPTANCE.md`).
