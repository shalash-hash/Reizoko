# Reizoko

Единый центр создания, хранения и публикации контента в социальные сети.

## Stage 1 — Local Desktop ✅ COMPLETE

**Baseline version:** 0.1.0  
**Acceptance:** `pnpm stage1:acceptance` → [docs/STAGE1_ACCEPTANCE.md](docs/STAGE1_ACCEPTANCE.md)

Stage 2 **не начат** — cloud/sync будет обсуждаться отдельно.

## Быстрый старт

```cmd
cd /d D:\_APP\Reizoko
pnpm install
pnpm tauri:dev
```

Или двойной клик по `dev.bat`.

Production build:

```cmd
pnpm tauri:build
```

Release EXE:

```text
apps\desktop\src-tauri\target\release\reizoko-desktop.exe
```

## Документация

| Документ | Назначение |
|----------|------------|
| [docs/MASTER_CONTEXT.md](docs/MASTER_CONTEXT.md) | Полный контекст проекта |
| [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) | Дорожная карта и статусы |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архитектура |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Этапы Stage 1–3 |

## Скрипты

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Vite dev server (desktop frontend) |
| `pnpm tauri:dev` | Desktop app with hot reload |
| `pnpm tauri:build` | Production Windows build |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (core + database + desktop) |
| `pnpm test:coverage` | Coverage report |
| `pnpm quality` | typecheck + lint + test |
| `pnpm quality:release` | quality + production build |
| `pnpm smoke` | Full smoke regression |
| `pnpm smoke:release` | Release phases A–G |
| `pnpm smoke:revision` | Revision history smoke |
| `pnpm smoke:publication` | Publication draft smoke |
| `pnpm smoke:accounts` | Accounts smoke |
| `pnpm smoke:backup` | Backup/restore smoke |
| `pnpm smoke:clean-start` | Fresh DB end-to-end smoke |
| `pnpm stage1:acceptance` | **Stage 1 final acceptance gate** (quality + smoke + build) |
| `pnpm format` | Prettier |
| `pnpm --filter @reizoko/desktop screenshots` | Capture UI screenshots to `docs/screenshots/` |

### Automated desktop smoke tests

Smoke/E2E runners запускают `reizoko-desktop.exe` **невидимо, в фоне** (`REIZOKO_SMOKE_TEST=1`) и используют **изолированную** smoke database (`reizoko-smoke.db`, `media-smoke/`). Обычный пользовательский запуск приложения не затрагивается.

## Planned block types

Реализованы: `text`, `heading`, `image`.

Запланированы (Stage 2+): `video`, `link`, `gallery`, `file`, `poll`, `quote`. UI не предлагает их создание; domain API возвращает явную ошибку «planned for a future stage».
