# VK — Platform Composer capabilities

Audit date: August 2026. Publishing path: VK API photo upload + `wall.post` (planned desktop publisher).

| Capability | Status | Notes |
|------------|--------|-------|
| Basic crop / fit | SUPPORTED LOCALLY BEFORE UPLOAD | Optional square/vertical presets |
| Pan / zoom | SUPPORTED LOCALLY BEFORE UPLOAD | Same transform model as Instagram, fewer ratios |
| Carousel / attachments order | SUPPORTED LOCALLY BEFORE UPLOAD | Multiple photos in one post |
| Text override | SUPPORTED | Platform-specific caption |
| Native VK editor filters | NOT AVAILABLE THROUGH API | Not exposed |
| Reizoko adjustments | SUPPORTED LOCALLY BEFORE UPLOAD | Local derived output |
| Wall post settings (comments, ads) | PLANNED | API fields exist; UI deferred |

VK composer reuses transform infrastructure but exposes only controls aligned with VK output pipeline.
