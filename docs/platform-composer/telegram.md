# Telegram — Platform Composer capabilities

Audit date: August 2026. Publishing path: Telegram Bot API (`sendPhoto`, `sendMediaGroup`, `sendMessage`).

| Capability | Status | Notes |
|------------|--------|-------|
| Aspect ratio / crop UI | NOT APPLICABLE | Bot API sends original/derived file; no IG-style crop |
| Media order in album | SUPPORTED | `carouselOrder` override |
| Caption / HTML text override | SUPPORTED | `parse_mode=HTML` in publisher |
| Interactive pan/zoom in composer | NOT APPLICABLE | No platform crop semantics |
| Optional local derived image | SUPPORTED LOCALLY BEFORE UPLOAD | Future: pre-upload resize only if explicitly enabled |
| Native Telegram filters | NOT AVAILABLE THROUGH API | N/A |
| Link preview flags | PLANNED | Bot API supports `disable_web_page_preview` |

Telegram composer focuses on text override, media order, and validation — not Instagram-style framing.
