# Reizoko

Единый центр создания, хранения и публикации контента в социальные сети.

## Stage 1 — Local Desktop

Monorepo на pnpm workspaces: React + TypeScript + Tauri 2 + SQLite.

## Быстрый старт

```bash
pnpm install
pnpm tauri:dev --filter @reizoko/desktop
```

Production build:

```bash
pnpm tauri:build --filter @reizoko/desktop
```

## Структура

См. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) и [docs/ROADMAP.md](docs/ROADMAP.md).

## Скрипты

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Vite dev server (desktop frontend) |
| `pnpm tauri:dev --filter @reizoko/desktop` | Desktop app with hot reload |
| `pnpm tauri:build --filter @reizoko/desktop` | Production Windows build |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
