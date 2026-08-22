# Instagram — Platform Connection Research

**Status:** REQUIRES EXTERNAL MEDIA DELIVERY for image publishing  
**Official docs:** [Instagram Platform — Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)

## Authentication method

| Flow | Description |
|------|-------------|
| **Instagram Login** (Business Login for Instagram) | OAuth 2.0; tokens on `graph.instagram.com`; scopes `instagram_business_basic`, `instagram_business_content_publish` |
| **Facebook Login for Business** | OAuth 2.0 via Facebook; Page access token on `graph.facebook.com`; scopes include `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` |

Both require a **Meta Developer App** (App ID, App Secret).  
**Personal Instagram accounts cannot use the Graph API.**

### Embedded WebView

Meta documents OAuth for web and mobile SDKs. For desktop, **system browser + redirect URI** is the standard secure pattern. Embedded WebView is not documented as the primary flow and may violate Meta platform policies for login — **use system browser**.

### System browser + callback

Supported via OAuth 2.0 redirect:

- Loopback: `http://127.0.0.1:<port>/callback` (register in Meta app settings)
- Custom URI scheme if registered for the desktop app

PKCE is recommended for public/native clients.

## Required developer registration

- Meta Developer account + App
- **Business Verification** for Advanced Access
- **App Review** with screencast for permissions used in production (e.g. `instagram_content_publish`)
- Instagram account must be **Business or Creator**, linked to a **Facebook Page**

## Permissions / scopes (publishing)

| Permission | Purpose |
|------------|---------|
| `instagram_basic` / `instagram_business_basic` | Profile + media read |
| `instagram_content_publish` / `instagram_business_content_publish` | Publish |
| `pages_read_engagement` | Find linked IG user via Page (Facebook Login path) |

## Token types

- **Instagram User access token** (Instagram Login path)
- **Facebook Page access token** (Facebook Login path)
- Long-lived tokens via exchange; refresh via documented endpoints

## Refresh / expiration

Short-lived tokens exchanged for long-lived (~60 days). Refresh before expiry. Invalid token → re-authorize via OAuth.

## Logout / revoke

Revoke via Meta app settings or token invalidation. Reizoko `disconnect` deletes local secrets + marks `needs_reconnect`.

## Account types supported

- Instagram **Business** and **Creator** only
- Must be connected to a Facebook Page (Facebook Login path) or authorized via Instagram Login for professional accounts

## Publishing endpoints

Container-based publishing:

1. `POST /{ig-user-id}/media` — create container (`image_url`, `video_url`, or resumable upload for large video)
2. Poll container until `status_code=FINISHED`
3. `POST /{ig-user-id}/media_publish` — publish with `creation_id`

Rate limit: ~25 API-published posts per 24 hours per account (documented limit).

## Supported content

| Type | API support |
|------|-------------|
| Single image | Yes (`image_url`) |
| Carousel | Yes (`is_carousel_item` + carousel publish) |
| Reels | Yes (`media_type=REELS`, resumable upload) |
| Stories | Yes (`media_type=STORIES`) |
| Video | Yes (`video_url` or resumable) |
| Text-only | No standalone text post via Graph API |

## Media upload requirements

**Critical for desktop:**

- For standard image publish, Meta **fetches media from a public `image_url`** — the image must be on a **publicly accessible HTTPS URL**.
- **Direct local binary upload is not supported** for still images via `image_url` flow.
- Large videos support **resumable upload** to `rupload.facebook.com` (`upload_type=resumable`) — closer to `platform_upload_session`.
- Carousel items use public URLs per item.

### Media delivery mode in Reizoko

```text
primary: public_url
video: platform_upload_session (resumable)
NOT: direct_binary for feed images
```

## Desktop-only feasibility

**REQUIRES EXTERNAL MEDIA DELIVERY** for typical local image publishing.

Pure desktop can:

- OAuth via system browser
- Publish if user provides temporary public URL **or** future local-only relay (out of scope for 1.5.1)

Pure desktop cannot (without additional infrastructure):

- Upload arbitrary local JPEG directly to Instagram feed via official image container API

## Important limitations

- No personal accounts
- App Review + Business Verification for production
- Public URL requirement for images
- 25 posts / 24h publishing cap
- Page Publishing Authorization (PPA) may block publishing until completed
- Two-factor on linked Facebook Page may require user 2FA during publish
- **No browser automation** of instagram.com — not supported

## Reizoko recommendation

Implement **after** Telegram and after a documented media-delivery strategy (temporary public URL, user-provided hosting, or later optional relay — **not** in 1.5.1).
