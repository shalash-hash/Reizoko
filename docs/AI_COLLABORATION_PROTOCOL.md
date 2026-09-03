# AI Collaboration Protocol

Универсальный процесс совместной работы:

```text
USER REQUEST
    ↓
READ CANON
    ↓
COMPATIBILITY CHECK (A / B / C / D)
    ↓
DISCUSSION / DECISION (if C or D)
    ↓
IMPLEMENTATION
    ↓
TEST
    ↓
UPDATE CANON IF NEEDED (C only)
    ↓
UPDATE HANDOFF IF NEEDED
    ↓
COMMIT / PUSH (only on user command)
    ↓
CHATGPT READS GITHUB
```

**Shared source of truth:** GitHub repository (`origin/master`).

---

## 1. Read canon (mandatory before substantive work)

| Order | Document |
|-------|----------|
| 1 | [AI_CONTEXT_INDEX.md](./AI_CONTEXT_INDEX.md) |
| 2 | [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) |
| 3 | [HANDOFF_TO_CHATGPT.md](./HANDOFF_TO_CHATGPT.md) |
| 4 | [DECISIONS_CHANGELOG.md](./DECISIONS_CHANGELOG.md) |
| 5 | Task-specific docs (DEVELOPMENT_PLAN, platform-connections, …) |
| 6 | Relevant code |

**Exact Git HEAD:** always from Git / GitHub — never from HANDOFF alone.

---

## 2. Compatibility classification

| Class | Meaning | Action |
|-------|---------|--------|
| **A** | Fully aligned with canon | Implement |
| **B** | Implementation-only; canon unchanged | Implement; no DECISIONS entry |
| **C** | **New decision** — changes product, architecture, contracts, UX semantics, data format | User confirms → implement → update DECISIONS + MASTER + affected docs → update HANDOFF if useful |
| **D** | Conflict or ambiguity | **Stop.** Ask user. No silent choice. |

### Examples

- **B:** bugfix, typo, refactor without behavior change, test stabilization, dependency bump without architectural impact.
- **C:** new publication model, changing what «profile» means, new platform auth flow, breaking snapshot format, reversing Natural Time default.
- **D:** MASTER says X, DEVELOPMENT_PLAN says Y, code does Z — and product impact is unclear.

---

## 3. Conflict resolution order

When documents disagree:

1. **Latest explicit user decision** (in chat or committed canon update).
2. **[MASTER_CONTEXT.md](./MASTER_CONTEXT.md)**
3. **Newer authoritative task doc** (e.g. DEVELOPMENT_PLAN over ROADMAP for status).
4. **Current code** = fact of implementation — **not** automatic product approval.
5. **Historical / stale docs** (STAGE1_ACCEPTANCE, old snapshots).

Code ahead of docs → treat as **B** until user confirms **C** doc update.  
Docs ahead of code → planned work, not rollback instruction by itself.

---

## 4. Cursor responsibilities

- Read canon before substantive edits.
- Classify A/B/C/D; flag **D** to user.
- **No silent rollback** of documented decisions.
- **No silent canon rewrite** to match code without user approval.
- **No commit/push** unless user explicitly asks.
- **No secrets** in commits (tokens, keys, `.env`, credentials).
- For local WIP important to next session → update HANDOFF (not committed debug artifacts).
- After **C** changes: update DECISIONS_CHANGELOG + MASTER + profile docs as needed.

---

## 5. ChatGPT responsibilities

Before generating a substantial Cursor prompt, read from GitHub:

```text
AI_CONTEXT_INDEX → MASTER_CONTEXT → HANDOFF_TO_CHATGPT → DECISIONS → profile docs → code
```

If user and ChatGPT agree on a **new conceptual decision**, the Cursor prompt **must** include:

```text
UPDATE CANONICAL DOCUMENTATION
```

List which files to update (MASTER, DECISIONS, HANDOFF, task docs).

Decisions must not live only in ChatGPT conversation history.

---

## 6. User responsibilities

- Explicit **commit/push** when ready to share state.
- Resolve **class D** ambiguities.
- Approve **class C** before canon is rewritten.

---

## 7. When to update which doc

| Event | MASTER | DECISIONS | HANDOFF | DEVELOPMENT_PLAN |
|-------|--------|-----------|---------|------------------|
| Typo / refactor (B) | — | — | — | — |
| Stage/task completed (B) | optional gap fix | — | optional | ✅ status row |
| New product/architecture decision (C) | ✅ | ✅ | ✅ | ✅ if stage scope changes |
| End of session with unpushed WIP | — | — | ✅ local WIP section | — |

**Do not** update MASTER after every small change.

---

## 8. Git & security (all agents)

Never commit:

- secrets, tokens, passwords, private keys;
- local config with credentials;
- `target/`, `dist/`, large binaries (unless project convention requires);
- debug dumps, screenshots for handoff only.

Private repo ≠ permission to store secrets in git.

---

## 9. Persistent Cursor rule

Short rule lives in `.cursor/rules/ai-collaboration.mdc` (always apply).  
This document is the **full** reference — do not duplicate entire text in rules.
