# Stage 1 Acceptance

**Date:** 2026-08-22
**App version:** 0.1.0
**Result:** PASS — Stage 1 Local Desktop COMPLETE

## Acceptance steps

| Step | Check | Result | Duration |
|------|-------|--------|----------|
| A | Quality gate | PASS | 34s |
| A2 | Test coverage | PASS | 8s |
| B-L-smoke | Targeted smoke suite (chained) | PASS | 94s |
| J-K | Release smoke phases A–G | PASS | 57s |
| K | Production build verification | PASS | 298s |
| L | Production artifact verification | PASS | 0s |
| Z | No zombie reizoko-desktop.exe | PASS | 0s |

## Vitest

- Covered by `pnpm quality` + `pnpm test:coverage`
- Packages: core, database, desktop

## Smoke / E2E

- Background Test Mode: `REIZOKO_SMOKE_TEST=1` (hidden window, isolated `reizoko-smoke.db`)
- Targeted suite: clean-start, revision, accounts, publication, backup
- Release phases A–G via `pnpm smoke:release`

## Build artifacts

- **Release EXE:** `D:\_APP\Reizoko\apps\desktop\src-tauri\target\release\reizoko-desktop.exe` — 4.83 MB — 2026-08-22T09:24:13.804Z
- **MSI installer:** `D:\_APP\Reizoko\apps\desktop\src-tauri\target\release\bundle\msi\Reizoko_0.1.0_x64_en-US.msi` — 2.54 MB — 2026-08-22T09:24:02.850Z
- **NSIS installer:** `D:\_APP\Reizoko\apps\desktop\src-tauri\target\release\bundle\nsis\Reizoko_0.1.0_x64-setup.exe` — 1.89 MB — 2026-08-22T09:24:13.781Z

## Installer verification

- **Automated:** artifact existence + size recorded above
- **Manual (required):** install MSI/NSIS in disposable environment; verify first-run DB init; uninstall cleanly
- Windows Sandbox not available in this automated run — recorded as manual acceptance item

## Production UX

- Without `REIZOKO_SMOKE_TEST=1`, app launches as normal visible desktop window (verified by code guards + manual)

## User data isolation

- Acceptance uses only `reizoko-smoke.db` and `media-smoke/`
- User `reizoko.db`, user media, and real safety backups are not touched

## Known non-blocking limitations

- Full-text search → Stage 2
- Planned block types (`video`, `link`, …) → Stage 2+
- Real API publish / scheduler / OAuth → Stage 3
- PowerShell execution policy / Cursor localhost tab → environment
- Initial git commit → R.1 WAITING FOR USER COMMAND

## Git status (read-only)

- Branch: `master`
- Latest commit: `0d7125b Initial commit: Reizoko Stage 1 local desktop foundation`
- Remote: origin	https://github.com/shalash-hash/Reizoko.git (fetch) / origin	https://github.com/shalash-hash/Reizoko.git (push)
- Uncommitted paths: 120

## Stage 2

**NOT STARTED** — planning deferred until explicit user command.

