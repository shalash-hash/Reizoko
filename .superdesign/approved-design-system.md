# Reizoko — Approved Design System

Source: user-approved layout reference (NOT previous Reizoko drafts).

## Frame
- Primary: 1920×1080 desktop
- Secondary check: 1366×768
- Compact desktop density — NOT mobile-sized controls

## Semantic tokens (Light)
- app background: warm neutral #E8E6E0
- workspace: #F0EEEA with subtle dot grid
- sidebar: #F5F4F0 (light) — compact ~220px
- canvas: #FFFFFF with soft shadow
- elevated panels: #FFFFFF / #FAFAF8
- inspector panel: #FAFAF8, secondary to canvas
- border: rgba(0,0,0,0.08)
- text primary: #1A1A1A
- text secondary: #5C5C5C
- text muted: #8A8A8A
- accent (Reizoko): teal #0D9488
- success: #16A34A
- warning: #D97706
- danger: #DC2626
- platform colors: local only (IG pink, TG blue, VK blue)

## Semantic tokens (Dark)
- app background: #0E0E10
- workspace: #141416 dotted
- sidebar: #121214
- canvas: #1C1C20 elevated
- inspector: #18181C
- borders: rgba(255,255,255,0.08)
- text primary: #F5F5F5
- accent: #2DD4BF teal
- Independent dark theme — NOT simple invert

## Layout zones (Editor)
1. Top strip: Reizoko wordmark area + "Local • Saved" right
2. Left sidebar: nav groups + Settings + Collapse bottom
3. Tab bar: Редактор | Instagram | Telegram | VK | + (browser chrome, compact)
4. Center workspace: document canvas (max readable width ~640px centered in flex area)
5. Right inspector (~280px): Platform, Проверка checklist, Preview thumbnail
6. Bottom status bar: saved + blocks + autosave + Опубликовать ▾
