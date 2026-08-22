# Telegram — Manual Acceptance Checklist

Use a **real** bot token from [@BotFather](https://t.me/BotFather).  
Enter the token **only** in the Reizoko UI — never in chat, logs, fixtures, or git.

## Prerequisites

- Reizoko desktop build (`pnpm tauri:build` or `pnpm tauri:dev`) — **not** smoke mode
- Telegram bot created via BotFather
- Test channel where the bot is administrator with **Post Messages** permission

## Launch (normal mode)

```bash
pnpm tauri:dev
# or run release EXE without REIZOKO_SMOKE_TEST
```

## Checklist

| Step | Action | Expected | Status |
|------|--------|----------|--------|
| 1 | **Подключить Telegram-бота** → paste token | `getMe` OK, bot `@username`, state **Подключён** | [ ] |
| 2 | Invalid token (optional) | Error without token in logs/DB | [ ] |
| 3 | **Добавить канал или чат** → `@channel` or chat id | Destination created, `через @bot` | [ ] |
| 4 | Channel without admin rights | Permission error, no destination | [ ] |
| 5 | Text post: prepare → **Опубликовать сейчас** | `published`, message in channel | [ ] |
| 6 | Status bar result | **Открыть пост** link works (public channel) | [ ] |
| 7 | Single image + text (RU, emoji, newlines) | `sendPhoto`, image in channel | [ ] |
| 8 | Caption overflow (>1024 chars with image) | Full text not lost (photo + follow-up message) | [ ] |
| 9 | Media group (2+ images) | Album in channel, `messageIds` persisted | [ ] |
| 10 | Restart app | Connection + destinations + publications persist | [ ] |
| 11 | Controlled failure (no-permission destination) | `failed`, **Повторить** after fix | [ ] |
| 12 | Double-click Publish during send | No duplicate posts | [ ] |
| 13 | Disconnect bot | Secret removed, destinations **Требуется подключение** | [ ] |
| 14 | Reconnect same bot | Destinations publishable again | [ ] |

## Security audit (after manual steps)

```bash
node scripts/acceptance/telegram-security-audit.mjs
```

Checks SQLite, `.reizoko-backup`, and JSON export in `%APPDATA%\com.reizoko.app` for bot token patterns.  
Does **not** print matched secrets.

## Regression (after any fixes)

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke:telegram
pnpm smoke
pnpm quality:release
```

## Overall status

- [ ] **REAL TELEGRAM ACCEPTANCE** — pending manual run

### Results table (fill after run)

| Check | Result |
|-------|--------|
| getMe | |
| destination | |
| permissions | |
| text publish | |
| single image | |
| caption overflow | |
| media group | |
| remotePostId | |
| remoteUrl | PASS / N/A (private channel) |
| persistence | |
| failure/retry | |
| disconnect | |
| reconnect | |
| security | |
