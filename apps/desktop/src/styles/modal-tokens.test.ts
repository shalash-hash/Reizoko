import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tokensPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/ui/src/styles/tokens.css',
);
const accountDialogCssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../components/account-dialog.css',
);

const tokensCss = readFileSync(tokensPath, 'utf8');
const accountDialogCss = readFileSync(accountDialogCssPath, 'utf8');

function extractTokenValue(css: string, tokenName: string): string | null {
  const match = new RegExp(`${tokenName}:\\s*([^;]+);`).exec(css);
  return match?.[1]?.trim() ?? null;
}

function isOpaqueColor(value: string): boolean {
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    return hex.length === 3 || hex.length === 6;
  }
  if (value.startsWith('var(')) return true;
  if (/rgba?\(/i.test(value)) return false;
  if (/transparent/i.test(value)) return false;
  if (/color-mix\(/i.test(value) && /transparent/i.test(value)) return false;
  return true;
}

describe('modal design tokens', () => {
  it('defines opaque modal surface tokens for light and dark themes', () => {
    const lightModal = extractTokenValue(tokensCss, '--bg-modal');
    const darkModal = extractTokenValue(
      tokensCss.slice(tokensCss.indexOf("[data-theme='dark']")),
      '--bg-modal',
    );

    expect(lightModal).toBeTruthy();
    expect(darkModal).toBeTruthy();
    expect(isOpaqueColor(lightModal!)).toBe(true);
    expect(isOpaqueColor(darkModal!)).toBe(true);
  });
});

describe('account dialog surface contract', () => {
  it('uses opaque modal token on dialog panel, not transparent mix', () => {
    expect(accountDialogCss).toContain('background: var(--bg-modal)');
    expect(accountDialogCss).not.toMatch(/account-dialog\s*\{[^}]*opacity:/);
    expect(accountDialogCss).not.toMatch(/account-dialog\s*\{[^}]*color-mix/);
  });
});
