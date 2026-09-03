# Handoff to ChatGPT

Семантический снимок для AI с доступом к GitHub.  
**Не** полная история проекта. **Не** замена [MASTER_CONTEXT.md](./MASTER_CONTEXT.md).

> **Exact current HEAD:** READ FROM GIT / GITHUB (`git rev-parse HEAD` или GitHub API).  
> Не использовать SHA из этого файла как канон.

---

## Repository sync metadata

| Field | Value |
|-------|-------|
| Repository root | `D:\_APP\Reizoko` |
| Branch | `master` |
| Remote | `https://github.com/shalash-hash/Reizoko.git` |
| Last doc sync (this file) | **2026-09-03** |
| Tracked changes committed/pushed | **Yes** — working tree clean at last audit |
| Default working branch | `master` |

---

## What was recently implemented (from git history)

Последние значимые коммиты на `master` (см. GitHub для актуального списка):

| Theme | Summary |
|-------|---------|
| VK connection | Community token connections, permission verification, OAuth + wall publishing (migration v8) |
| Accounts UX | Platform profile dialog clarity, platform picker hover, Russian labels, local profile vs connection |
| Platform Composer | Per-platform presentation overrides, MediaTransformView, snapshot v2, migration v7 |
| Telegram | Bot API connections, real publish, destination hierarchy |
| Stage 1 baseline | Local desktop foundation, acceptance gate |

---

## Current product stage

- **Stage 1** (Local Desktop): ✅ COMPLETE — baseline `v0.1.0-stage1`
- **Stage 1.5** (Connected & Publishing Desktop): 🟡 **CURRENT**
  - Done: Telegram bot publish, VK OAuth/publish, Platform Composer, credential infra, accounts architecture
  - Next per [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md): **1.5.7 Instagram / Meta Connection** (and subsequent 1.5.x items)
- **Stage 2 / 3**: DEFERRED

---

## Important product decisions (active)

- **ContentItem ≠ Publication** — library vs publication attempts.
- **Master Post** in editor; platform tabs = live preview + per-target overrides (Composer).
- **Local profile** (SocialAccount) ≠ **PlatformConnection** (credentials). Telegram/VK real auth via separate flows.
- **Secrets** only in OS secure storage (`SecretStore`), never in SQLite or backup files.
- **Natural Time** default; **Exact Time** explicit opt-in (scheduler execution still Stage 1.5+/3).
- **Stage 1.5** = desktop publishing without own backend; minimal PHP on shared hosting only for VK OAuth callback (`server/`).
- **No commit/push** unless user explicitly requests.

---

## Implementation notes for next AI

- Monorepo: `pnpm` workspaces — `apps/desktop`, `packages/*`, `platforms/*`.
- UI does **not** execute SQL — only `packages/database` repositories.
- `PreparedPublicationSnapshot.formatVersion`: **1 | 2** (v2 includes presentation overrides).
- DB migrations: currently through **v8** (`v8-vk-publication-targets`).
- Platform profile form config: `packages/core/src/platform/platform-profile-form.ts`.
- Smoke tests use `REIZOKO_SMOKE_TEST=1` (hidden window, isolated DB).
- Windows: prefer `pnpm.cmd` / `dev.bat` if PowerShell blocks `pnpm.ps1`.

---

## Authoritative docs (read before big prompts)

1. [AI_CONTEXT_INDEX.md](./AI_CONTEXT_INDEX.md)
2. [MASTER_CONTEXT.md](./MASTER_CONTEXT.md)
3. [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)
4. [DECISIONS_CHANGELOG.md](./DECISIONS_CHANGELOG.md)
5. Task-specific: `docs/platform-connections/`, `docs/platform-composer/`, [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Known gaps (non-exhaustive)

| Gap | Notes |
|-----|-------|
| Instagram / Meta connection | Not implemented (1.5.7 planned) |
| Derived media file render | Composer metadata/table only; no canvas/Rust render at publish |
| Full crop editor modal | Inline pan/zoom only |
| Unified «Publish Now» UX for all platforms | TG/VK partial; IG still «скоро» |
| Local scheduler / queue | Planned 1.5.11–1.5.13 |
| Cloud sync / web client | Stage 2 deferred |
| Library delete/archive UI | API exists, UI not exposed |
| ROADMAP.md stage label | Says «Stage 1 current» — **stale**; use DEVELOPMENT_PLAN |

---

## Local-only WIP

**At last audit (2026-09-03):** none — `git status` clean.

If you have uncommitted work locally, describe it here before relying on GitHub-only context.

---

## Safety / constraints

- Do not commit secrets, tokens, `.env`, build artifacts, or debug dumps.
- Do not silently revert product decisions documented in MASTER / DECISIONS.
- Conceptual changes (class **C** in protocol) require updating canonical docs + DECISIONS_CHANGELOG.
