# AI Context Index

**ENTRY POINT** для ChatGPT, Cursor и любого AI-агента в этом репозитории.

GitHub (`origin/master`) — **shared source of truth** для канона, кода и истории решений.  
Локальный uncommitted WIP GitHub **не видит** — см. [HANDOFF_TO_CHATGPT.md](./HANDOFF_TO_CHATGPT.md).

---

## Read first (in order)

| # | Document | Purpose |
|---|----------|---------|
| 1 | [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) | Единый канон: продукт, архитектура, инварианты, текущий этап |
| 2 | [HANDOFF_TO_CHATGPT.md](./HANDOFF_TO_CHATGPT.md) | Семантический снимок «сейчас» + local-only WIP |
| 3 | [DECISIONS_CHANGELOG.md](./DECISIONS_CHANGELOG.md) | Журнал концептуальных решений (не git log) |

Затем — [AI_COLLABORATION_PROTOCOL.md](./AI_COLLABORATION_PROTOCOL.md) (процесс USER ↔ ChatGPT ↔ Cursor ↔ GitHub).

**Exact current HEAD:** READ FROM GIT / GITHUB — не хранить в HANDOFF как канон.

**Historical docs** (старые планы, acceptance records) **не перекрывают** MASTER, если противоречат более новому канону или коду.

---

## Then by task

| Area | Authoritative docs | Code / paths |
|------|-------------------|--------------|
| **Product & stage status** | [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md), MASTER §17 | `package.json`, git history |
| **Architecture overview** | [ARCHITECTURE.md](./ARCHITECTURE.md), MASTER §3–9 | `packages/`, `apps/desktop/` |
| **Roadmap (high-level)** | [ROADMAP.md](./ROADMAP.md) *(status → DEVELOPMENT_PLAN)* | — |
| **Desktop UI / shell** | MASTER §11–13, `.superdesign/approved-design-system.md` | `apps/desktop/src/components/` |
| **Block editor** | MASTER §7 | `packages/editor/` |
| **Core business logic** | MASTER §7–8 | `packages/core/` |
| **Database & migrations** | MASTER §8 | `packages/database/src/migrations/` |
| **Domain types** | MASTER §7 | `packages/shared/` |
| **Platform adapters & previews** | MASTER §9, `docs/platform-composer/` | `platforms/*`, `packages/platform-sdk/` |
| **Platform connections (OAuth, bots)** | `docs/platform-connections/`, MASTER §7 | `packages/core/src/telegram/`, `packages/core/src/vk/` |
| **VK OAuth helper (PHP)** | `server/README.md` | `server/` |
| **Publication & prepare** | MASTER §7 (PublicationBatch) | `packages/core/src/publication/` |
| **Accounts & profiles UX** | MASTER §7 (SocialAccount) | `apps/desktop/src/components/AccountsView.tsx`, `AccountDialog.tsx` |
| **Backup / restore** | MASTER §Backup | `packages/core/src/backup/` |
| **Security & secrets** | MASTER §7 (PlatformConnection), platform-connections docs | `packages/core/src/security/` |
| **Testing & quality** | MASTER §20, `docs/STAGE1_ACCEPTANCE.md` | `pnpm quality`, `scripts/smoke/` |
| **Build & release** | README.md, MASTER §21 | `apps/desktop/src-tauri/` |
| **Design / screenshots** | MASTER §15 | `docs/screenshots/`, `.superdesign/` |

---

## Cursor persistent rule

См. `.cursor/rules/ai-collaboration.mdc` — краткое обязательное правило перед существенной работой.

Полный процесс: [AI_COLLABORATION_PROTOCOL.md](./AI_COLLABORATION_PROTOCOL.md).
