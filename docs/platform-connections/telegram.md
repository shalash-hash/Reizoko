# Telegram — Platform Connection Research

**Status:** FULLY DESKTOP (Bot API path)  
**Official docs:** [Telegram Bot API](https://core.telegram.org/bots/api), [MTProto](https://core.telegram.org/mtproto)

## Two official scenarios

### A. Bot API (HTTP)

| Aspect | Detail |
|--------|--------|
| Auth | **Bot token** from [@BotFather](https://t.me/BotFather) — format `123456:ABC-DEF...` |
| Registration | Create bot via BotFather; no OAuth |
| Connection method in Reizoko | `manual_secret` / `bot_token` |
| Protocol | HTTPS `https://api.telegram.org/bot<token>/METHOD` |

**Publishing:**

- `sendMessage` — text (HTML/Markdown)
- `sendPhoto` — image via multipart `photo` (file upload, `file_id`, or URL)
- `sendMediaGroup` — albums
- `sendVideo`, `sendDocument`, etc.

**Channel requirements:**

- Bot must be **administrator** of channel/supergroup with **post messages** permission
- `chat_id`: `@channelusername` or numeric `-100...` ID

**Message ID / link:**

- Response includes `message_id`; public link: `https://t.me/{channel}/{message_id}` (if channel is public)

**Media upload:**

- **direct_binary** via `multipart/form-data` — up to 10 MB photos
- Optional URL if Telegram can fetch it

**Desktop feasibility:** **FULLY DESKTOP** — no Reizoko backend required.

**Limitations:**

- Bot identity (not personal user) unless using MTProto
- User must add bot as channel admin
- Rate limits per bot
- No arbitrary user-account features (DMs to non-started users, etc.)

### B. User / MTProto

| Aspect | Detail |
|--------|--------|
| Auth | `api_id` + `api_hash` from [my.telegram.org](https://my.telegram.org); phone login, optional 2FA |
| Session | Persistent session string (sensitive — SecretStore) |
| Libraries | TDLib, Telethon, GramJS (third-party; protocol is official) |
| Connection method | `native_authorization` |

**Capabilities:**

- Post as **user** to channels where user is admin
- Full Telegram client feature set
- QR login supported in official clients (MTProto layer)

**Desktop feasibility:** **FULLY DESKTOP** technically, but:

- Higher complexity (session management, 2FA, flood limits)
- Telegram ToS: third-party clients must use official API
- Password/2FA only during auth — **never store password**

## Embedded WebView

Not applicable for Bot API (token entry).  
MTProto phone login: official apps use native UI; for desktop third-party apps, use **system browser not required** — phone + code in-app is standard for MTProto libraries.

## System browser + callback

Not used for Bot API. Optional for future Telegram Login Widget (web-only, not primary for channel publishing).

## Token types

| Type | Storage |
|------|---------|
| Bot token | SecretStore (`bot_token`) |
| MTProto session | SecretStore (`session`) — if ever implemented |

## Refresh / expiration

Bot tokens are long-lived until revoked via BotFather.  
MTProto sessions persist until revoked; may require re-login.

## Logout / revoke

- Bot: `/revoke` in BotFather or delete token in Reizoko
- MTProto: destroy session locally + `logOut` RPC

## Reizoko recommendation

**Start with Bot API (`bot_token`)** for Stage 1.5.4:

| Reason | |
|--------|--|
| Simplest secure model | Token in Credential Manager |
| True multipart local file upload | No public URL needed |
| No OAuth / app review | |
| Matches channel publishing use case | |
| Aligns with “Complete Desktop without backend” | |

Defer MTProto user session to a later substage if product requires posting as personal user (not as bot).

## Implemented architecture (Stage 1.5.4)

```text
PlatformConnection (credential)
  id, platformId=telegram, method=bot_token, state, secretRef
  externalIdentityId = bot id, displayName, handle = @bot_username

SocialAccount (destination)
  connectionId → PlatformConnection.id
  externalAccountId = Telegram chat id
  displayName = channel title, handle = @channel_username?

Flow:
  UI dialog → Tauri telegram_connect_bot → Credential Manager
  validate getMe → create/update PlatformConnection
  destination dialog → getChat + getChatMember → create SocialAccount

Publish:
  PublicationService → TelegramPublisher → Tauri transport → Bot API
  Token never returned to frontend; only secretRef in SQLite
```

| Component | Path |
|-----------|------|
| Connection service | `packages/core/src/telegram/telegram-connection-service.ts` |
| Publisher | `packages/core/src/telegram/telegram-publisher.ts` |
| Transport interface | `packages/core/src/telegram/telegram-transport.ts` |
| Native transport | `apps/desktop/src-tauri/src/platforms/telegram.rs` |
| Desktop wiring | `apps/desktop/src/services/telegram-runtime.ts` |
| UI | `TelegramConnectDialog`, `TelegramDestinationDialog`, `AccountsView` |

Manual acceptance: [telegram-acceptance.md](./telegram-acceptance.md)  
Automated smoke: `pnpm smoke:telegram` (fake transport, no real API)

## Media delivery mode

```text
direct_binary | multipart  (sendPhoto upload)
public_url     (optional URL parameter)
```

## Important limitations

- Bot must be channel admin
- 10 MB photo limit
- Caption 1024 characters
- Cannot post to channel without admin rights
- Bot API cannot impersonate human user
