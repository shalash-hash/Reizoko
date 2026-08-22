# Platform Connections — Stage 1.5 Research

> Official API research for **Connected & Publishing Desktop** (Stage 1.5).  
> Sources: Meta Instagram Platform docs, Telegram Bot API / MTProto docs, VK ID / VK API docs (August 2026).

## Goal

Enable real account connection and publishing from a **standalone Windows desktop app** without Reizoko-owned backend.

## Summary matrix

| Platform | Auth (official) | Desktop feasibility | Media delivery | Recommended for Reizoko |
|----------|-----------------|---------------------|----------------|-------------------------|
| **Telegram** | Bot token **or** MTProto user session | **FULLY DESKTOP** (Bot API) | `direct_binary` multipart | **First implementation** |
| **VK** | VK ID OAuth 2.1 + PKCE; community service token for groups | **DESKTOP WITH LIMITATIONS** | `platform_upload_session` | Second — after token model clarified |
| **Instagram** | Instagram Login / Facebook Login OAuth | **REQUIRES EXTERNAL MEDIA DELIVERY** | `public_url` (Meta fetches URL) | Third — needs media URL strategy |

## Connection methods in Reizoko

```text
oauth_system_browser   — OAuth via default OS browser + loopback/custom URI callback
bot_token              — Telegram Bot API token (manual entry, stored in SecretStore)
native_authorization   — MTProto / phone+2FA (future; transient password only)
manual_secret          — Other provider-issued secrets where OAuth is not used
```

We do **not** use embedded WebView login unless a provider explicitly allows it.  
We do **not** use browser automation against instagram.com / vk.com / web.telegram.org.

## Security rules

- Passwords for Instagram/VK/Telegram are **never** stored by Reizoko.
- Access/refresh/bot tokens live only in **Windows Credential Manager** (via `SecretStore`).
- `.reizoko-backup` never contains secrets — restored accounts become `needs_reconnect`.
- Logs use redaction (`***REDACTED***`).

## Documents

- [instagram.md](./instagram.md)
- [telegram.md](./telegram.md)
- [vk.md](./vk.md)

## Architecture (code)

| Layer | Location |
|-------|----------|
| Types | `packages/shared/src/types/platform-connection.ts` |
| SecretStore | `packages/core/src/security/secret-store.ts` |
| Connection provider contract | `packages/core/src/platform-connection/` |
| Publisher contract | `packages/core/src/platform-connection/platform-publisher.ts` |
| SQLite metadata | `platform_connections` table (migration v5) |
| Windows secrets | Tauri `keyring` commands in `apps/desktop/src-tauri` |
