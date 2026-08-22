# VK — Platform Connection Research

**Status:** DESKTOP WITH LIMITATIONS  
**Official docs:** [VK ID OAuth 2.1](https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/realization), [VK API](https://dev.vk.com/reference)

## Authentication method

| Flow | Detail |
|------|--------|
| **VK ID OAuth 2.1** | Authorization Code + **PKCE required**; `code_verifier` / `code_challenge` |
| Legacy `oauth.vk.com` | Deprecated for apps registered on id.vk.com |
| **Community service token** | From group admin → «Работа с API» — for community wall posts without user OAuth |

### Embedded WebView

VK ID documentation targets web/mobile SDK. For desktop: **system browser + redirect URI** with PKCE.

### System browser + callback

Supported:

- Redirect URI registered in VK ID app settings
- Loopback `http://127.0.0.1:<port>/...` or custom scheme
- `state` parameter recommended (CSRF)

## Required developer registration

- VK ID application at [id.vk.com](https://id.vk.com)
- **APP_ID** (client_id)
- Redirect URIs configured
- For community posting: VK community with admin access

## Permissions / scopes

Depends on token type:

- VK ID tokens (`vk2.a.*`) — primarily **authentication** profile data
- VK API wall posting historically requires scopes like `wall`, `photos`, `offline` on **VK API access tokens**

**Known issue (2025–2026):** Tokens from VK ID OAuth (`vk2.a.*`) may **not** support VK API methods such as `wall.post` (error 1051). Community **service tokens** (`vk1.a.*` from group settings) do support `wall.post` and media upload.

Reizoko must treat VK ID auth and VK API publishing as **separate concerns** until official unified token flow is confirmed.

## Token types

| Token | Use |
|-------|-----|
| `vk2.a.*` | VK ID — user identity; limited API write |
| `vk1.a.*` / community token | VK API — `wall.post`, `photos.*`, `video.save` |
| Refresh token | VK ID OAuth 2.1 refresh |

## Refresh / expiration

VK ID: refresh via `grant_type=refresh_token`.  
Community tokens: long-lived until revoked in group settings.

## Logout / revoke

OAuth: revoke in VK ID / delete local secrets.  
Community token: revoke in VK group admin panel.

## Account types supported

- Personal profile wall (`wall.post` with positive `owner_id`)
- Community / group wall (`owner_id` negative, `from_group=1`)
- Community path more reliable with **service token**

## Publishing endpoints

Typical sequence (VK API v5.251):

1. **Photo:** `photos.getWallUploadServer` → POST file to `upload_url` → `photos.saveWallPhoto`
2. **Video:** `video.save` → upload → attach
3. **Post:** `wall.post` with `attachments=photo{owner}_{id}`

## Supported content

| Type | Support |
|------|---------|
| Text | Yes (`message`) |
| Image | Yes (upload session) |
| Video | Yes |
| Carousel / multiple | Attachments list |
| Links | Yes in message |

## Media upload requirements

- **direct_binary** to VK upload server URL (multipart) — **no public URL required**
- Mode: `platform_upload_session`

## Desktop-only feasibility

**DESKTOP WITH LIMITATIONS**

| Scenario | Feasibility |
|----------|-------------|
| Community posting with service token | **FULLY DESKTOP** — user copies token from VK admin (manual_secret) |
| User wall via VK ID OAuth only | **Blocked / unclear** — `vk2.a.*` may not support `wall.post` |
| OAuth + full API | Requires confirmed token type from VK; may need additional VK API authorization step |

## Important limitations

- VK ID OAuth 2.1 mandatory for new apps
- Token format split (`vk2.a` vs `vk1.a`) affects publishing
- Community vs personal posting need different tokens/scopes
- User password never stored — OAuth in system browser only
- Rate limits and captcha on API

## Reizoko recommendation

**Second platform after Telegram:**

1. **Phase A:** Community publishing via **manual service token** (`manual_secret`) — simplest path to real posts
2. **Phase B:** VK ID OAuth for identity + investigate official path for API-capable tokens for personal wall

Do not assume VK ID token alone enables `wall.post`.

## Media delivery mode

```text
platform_upload_session  (photos.getWallUploadServer → upload → save)
direct_binary            (multipart to upload_url)
```
