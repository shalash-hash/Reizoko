import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tabBarCssPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './tab-bar.css');
const tabBarTsxPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './TabBar.tsx');
const tabBarCss = readFileSync(tabBarCssPath, 'utf8');
const tabBarTsx = readFileSync(tabBarTsxPath, 'utf8');

describe('tab-bar active state', () => {
  it('uses full tinted active surface with thick top accent', () => {
    expect(tabBarCss).toContain('.tab-bar__tab--platform.tab-bar__tab--active');
    expect(tabBarCss).toMatch(/border-top:\s*3px solid var\(--platform-accent/);
    expect(tabBarCss).toContain('color-mix(in srgb, var(--platform-accent');
    expect(tabBarCss).not.toContain('border-left-width: 3px');
  });

  it('does not use bracket-only left accent on inactive platform tabs', () => {
    expect(tabBarCss).not.toMatch(/\.tab-bar__tab--platform\s*\{[^}]*border-left:\s*3px/);
  });

  it('uses Reizoko teal accent for pinned editor tab', () => {
    expect(tabBarCss).toContain('.tab-bar__tab--pinned.tab-bar__tab--active');
    expect(tabBarCss).toMatch(/border-top:\s*3px solid var\(--accent\)/);
  });

  it('keeps inactive tabs muted with hover state', () => {
    expect(tabBarCss).toContain('.tab-bar__tab:not(.tab-bar__tab--active)');
    expect(tabBarCss).toContain('.tab-bar__tab:not(.tab-bar__tab--active):hover');
  });
});

describe('TabBar component contract', () => {
  it('applies aria-selected and platform accent metadata', () => {
    expect(tabBarTsx).toContain('aria-selected={isActive}');
    expect(tabBarTsx).toContain('data-platform={adapter.id}');
    expect(tabBarTsx).toContain("'--platform-accent': adapter.color");
  });

  it('uses Russian save status labels', () => {
    expect(tabBarTsx).toContain('Сохранение…');
    expect(tabBarTsx).toContain('Сохранено');
    expect(tabBarTsx).toContain('Локально ·');
    expect(tabBarTsx).not.toContain('Local •');
    expect(tabBarTsx).not.toContain("'Saved'");
  });
});
