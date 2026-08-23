# VK — Platform Connection (implemented)

**Status:** DESKTOP WITH LIMITATIONS — **real publishing implemented**  
**Official docs:** [VK OAuth](https://dev.vk.com/api/access-token/authcode-flow-user), [VK API](https://dev.vk.com/reference)

## Architecture in Reizoko

```text
PlatformConnection (VK OAuth credential)
  └── SocialAccount[] (publication targets)
        platform_metadata_json: targetType, ownerId, postAsGroup, ...
```

One VK authorization can power multiple destinations: personal wall, communities, (optionally) another user's wall.

## Authentication

| Flow | Detail |
|------|--------|
| **VK ID OAuth 2.1** | Authorization Code + PKCE via system browser; callback on Reizoko server |
| Server base URL | `https://zasian.ru` (contents of `server/` deployed to web-root) |
| Redirect URI | `https://zasian.ru/vk-callback.php` (canonical, configured in VK app cabinet) |
| Scopes | `wall`, `photos`, `groups`, `offline` |
| Token storage | Windows Credential Manager via `secret_ref` = `connection/{id}/access_token` |

Global VK credentials (App ID, Client Secret, Service Token, server URL) are configured once in **Settings → Integrations → VK** or inline in **Accounts → Connect VK**. See `server/README.md` for hosting deployment.

## Publication targets

| Type | `targetType` | `owner_id` |
|------|--------------|------------|
| Personal wall | `self_wall` | positive user id |
| Community | `community_wall` | negative group id |
| Another user wall | `user_wall` | positive user id (only if API allows) |

Community posts use `from_group=1` when `postAsGroup` is enabled (default for communities).

## Publishing pipeline

```text
Master Post → VkAdapter.transform → VkPublisher → Tauri vk_publish_wall_post
  → photos.getWallUploadServer → multipart upload → photos.saveWallPhoto
  → wall.post (attachments)
```

## Limitations

- **VK ID tokens (`vk2.a.*`)** from newer VK ID-only apps may not support `wall.post` (API error 1051). Reizoko uses classic OAuth token exchange; use a **Standalone** VK app with API access.
- **External user walls:** no reliable pre-check; publish may fail with permission error if wall settings disallow posts.
- **User wall posting** depends on VK privacy/settings — not all walls accept third-party posts.

## Manual setup (required once)

1. Deploy Reizoko server per `server/README.md` (upload contents of `server/` to `zasian.ru` web-root).
2. Open https://dev.vk.com/ (or legacy https://vk.com/apps?act=manage)
3. Create a **Standalone** application
4. In app settings → **Open API** / OAuth:
   - Base domain: `zasian.ru`
   - Trusted Redirect URI: `https://zasian.ru/vk-callback.php`
5. Copy **Application ID** → Reizoko VK settings → App ID
6. Copy **Secure key** → Client Secret (Credential Manager)
7. Copy **Service access token** → Service Token (Credential Manager)
8. Enable permissions: wall, photos, groups

## Files

- Core: `packages/core/src/vk/*`
- Tauri: `apps/desktop/src-tauri/src/platforms/vk.rs`
- UI: `VkConnectDialog`, `VkTargetSelectionDialog`, `AccountsView` VK section
