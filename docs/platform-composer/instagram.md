# Instagram — Platform Composer capabilities

Audit date: August 2026. Publishing path: Meta Graph API (image container + publish).

| Capability | Status | Notes |
|------------|--------|-------|
| Aspect ratio presets (1:1, 4:5, 1.91:1) | SUPPORTED LOCALLY BEFORE UPLOAD | Graph API accepts JPEG; ratio enforced locally before upload |
| Interactive crop / pan / zoom | SUPPORTED LOCALLY BEFORE UPLOAD | Reizoko composer; not native IG UI |
| Carousel reorder | SUPPORTED LOCALLY BEFORE UPLOAD | Up to 10 images per adapter limits |
| Per-image crop in carousel | SUPPORTED LOCALLY BEFORE UPLOAD | Stored per `mediaId` in overrides |
| Caption text override | SUPPORTED | Stored in `PlatformPresentationOverrides.text` |
| Native Instagram filters | NOT AVAILABLE THROUGH API | Do not expose as IG filters |
| Reizoko adjustments (brightness/contrast/…) | SUPPORTED LOCALLY BEFORE UPLOAD | Applied to derived image |
| Alt text | PLANNED | API support exists; desktop scope deferred |
| Location / collaborators / comment settings | NOT APPLICABLE | Out of current desktop scope |
