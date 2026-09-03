# Decisions Changelog

Журнал **концептуальных** решений Reizoko.  
Это **не** git log. Implementation-only fixes сюда не пишем.

Формат записи:

```text
Date | Decision | Supersedes | Reason | Affected docs | Affected code | Status
```

**Статусы:** `active` | `superseded` | `deferred`

---

## Active decisions

### 2026-08-21 — ContentItem ≠ Publication

| Field | Value |
|-------|-------|
| **Decision** | Библиотека (`ContentItem`) отделена от попыток публикации (`Publication` / `PublicationBatch`). Один пост может публиковаться многократно. |
| **Supersedes** | — |
| **Reason** | Центральная идея продукта — независимая библиотека контента. |
| **Affected docs** | MASTER_CONTEXT §2, ARCHITECTURE |
| **Affected code** | `packages/shared`, `packages/core/publication`, migrations v3+ |
| **Status** | active |

### 2026-08-21 — Block-based Master Post (not HTML editor)

| Field | Value |
|-------|-------|
| **Decision** | Контент — typed blocks (`text`, `heading`, `image`, …), не WYSIWYG HTML. |
| **Supersedes** | — |
| **Reason** | Platform adapters, validation, future sync. |
| **Affected docs** | MASTER_CONTEXT §7 |
| **Affected code** | `packages/editor`, `packages/shared` |
| **Status** | active |

### 2026-08-21 — Stage 1 fully local, no server

| Field | Value |
|-------|-------|
| **Decision** | Stage 1 — автономный Windows desktop без backend. Stage 2/3 отложены. |
| **Supersedes** | — |
| **Reason** | Scope boundary, shipping baseline first. |
| **Affected docs** | MASTER_CONTEXT §3, ROADMAP, DEVELOPMENT_PLAN |
| **Affected code** | Entire monorepo scope |
| **Status** | active (Stage 1 complete; constraint evolves in 1.5 with minimal OAuth helper only) |

### 2026-08-21 — Capability flags instead of stage number checks

| Field | Value |
|-------|-------|
| **Decision** | UI проверяет `AppCapabilities`, не hardcoded stage IDs. |
| **Supersedes** | — |
| **Reason** | Extensibility for Stage 2/3 without UI rewrites. |
| **Affected docs** | MASTER_CONTEXT §10, ARCHITECTURE |
| **Affected code** | `packages/shared/capabilities`, `@reizoko/core` |
| **Status** | active |

### 2026-08-21 — Natural Time default / Exact Time opt-in

| Field | Value |
|-------|-------|
| **Decision** | Scheduled publish defaults to jittered Natural Time; Exact Time only when user explicitly enables `exact` mode. |
| **Supersedes** | — |
| **Reason** | Avoid mechanical posting patterns. |
| **Affected docs** | MASTER_CONTEXT §4 |
| **Affected code** | `packages/shared/scheduling` |
| **Status** | active (execution in scheduler — not yet shipped) |

### 2026-08-22 — Working revision + immutable checkpoints

| Field | Value |
|-------|-------|
| **Decision** | Autosave updates working revision in-place; historical checkpoints on pause/manual/prepare/restore. Restore creates new revision, never rewinds history. |
| **Supersedes** | Pre-1.11 naive revision model |
| **Reason** | Usable history without losing edit flow. |
| **Affected docs** | MASTER_CONTEXT §7 |
| **Affected code** | `packages/core/content`, migration v2 |
| **Status** | active |

### 2026-08-22 — Publication prepare uses immutable checkpoint

| Field | Value |
|-------|-------|
| **Decision** | «Подготовить публикацию» freezes `ContentRevision` checkpoint + `PreparedPublicationSnapshot` per target; further edits do not mutate prepared rows. |
| **Supersedes** | — |
| **Reason** | Safe multi-platform prepare from one Master Post. |
| **Affected docs** | MASTER_CONTEXT §7 |
| **Affected code** | `PublicationService`, migration v3 |
| **Status** | active |

### 2026-08-23 — PlatformConnection vs SocialAccount (credential vs destination)

| Field | Value |
|-------|-------|
| **Decision** | `PlatformConnection` holds credentials (e.g. bot token); `SocialAccount` is publication target (channel/page/profile). One connection → many destinations. |
| **Supersedes** | Earlier 1:1 account-connection coupling (migration v6) |
| **Reason** | Telegram bot model; scalable to VK/IG. |
| **Affected docs** | MASTER_CONTEXT §7, `docs/platform-connections/` |
| **Affected code** | migrations v5–v6, `packages/core/platform-connection` |
| **Status** | active |

### 2026-08-23 — Secrets in OS store, never in SQLite or backup

| Field | Value |
|-------|-------|
| **Decision** | Tokens via `secretRef` + Windows Credential Manager; backup excludes secrets; restore may yield `needs_reconnect`. |
| **Supersedes** | — |
| **Reason** | Security baseline for connected desktop. |
| **Affected docs** | MASTER_CONTEXT §7, Backup section |
| **Affected code** | `SecretStore`, backup services |
| **Status** | active |

### 2026-08-23 — Platform Composer: non-destructive per-target presentation overrides

| Field | Value |
|-------|-------|
| **Decision** | Master Post unchanged; per `platformId` (+ account) overrides for crop/zoom/text/carousel; `PreparedPublicationSnapshot` **formatVersion 2** embeds presentation. |
| **Supersedes** | Snapshot v1-only presentation |
| **Reason** | Instagram/VK preview fidelity without duplicating content items. |
| **Affected docs** | `docs/platform-composer/`, DEVELOPMENT_PLAN 1.5.5 |
| **Affected code** | migration v7, `packages/core/composer`, platform previews |
| **Status** | active |

### 2026-08-23 — Local profile UX separate from OAuth/login in generic account dialog

| Field | Value |
|-------|-------|
| **Decision** | «Добавить профиль площадки» creates local `SocialAccount` for labeling/prepare only; real Telegram/VK auth uses dedicated connection flows. No password/token in profile dialog. |
| **Supersedes** | Ambiguous «Добавить аккаунт» + Handle/username form |
| **Reason** | User clarity; avoid false login impression. |
| **Affected docs** | HANDOFF, `platform-profile-form.ts` |
| **Affected code** | `AccountDialog`, `AccountsView` |
| **Status** | active |

### 2026-08-23 — Stage 1.5 desktop publishing without own backend

| Field | Value |
|-------|-------|
| **Decision** | Real publish from desktop via official APIs; scheduler/queue in-process; optional minimal PHP on shared hosting **only** for OAuth callbacks (VK), not app backend. |
| **Supersedes** | «All OAuth/server in Stage 3 only» (partial) |
| **Reason** | Ship connected desktop before cloud/VPS. |
| **Affected docs** | DEVELOPMENT_PLAN Stage 1.5, `server/README.md` |
| **Affected code** | Telegram/VK publishers, Tauri transports |
| **Status** | active |

### 2026-08-23 — VK OAuth via system browser + shared-hosting callback

| Field | Value |
|-------|-------|
| **Decision** | VK auth opens system browser; callback handled by `server/` PHP on `zasian.ru`; desktop receives session via Tauri commands. |
| **Supersedes** | — |
| **Reason** | VK ID constraints; no VPS. |
| **Affected docs** | `docs/platform-connections/vk.md`, `server/README.md` |
| **Affected code** | `packages/core/vk`, `apps/desktop/src-tauri` |
| **Status** | active |

---

## Deferred (not abandoned)

| Date | Decision | Status |
|------|----------|--------|
| 2026-08-21 | Stage 2 Web + Cloud Sync | deferred |
| 2026-08-21 | Stage 3 VPS + server scheduler + background publish | deferred |

---

## How to add entries

Only when user or team accepts a **class C** change (see [AI_COLLABORATION_PROTOCOL.md](./AI_COLLABORATION_PROTOCOL.md)):

1. Add row here with `active` status.
2. Mark superseded decision's status as `superseded`.
3. Update MASTER_CONTEXT and task-specific docs.
