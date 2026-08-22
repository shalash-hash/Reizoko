import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const shellSources = [
  'components/TabBar.tsx',
  'components/PlatformPreviewPanel.tsx',
  'components/PlatformPicker.tsx',
  'components/PlatformSelect.tsx',
  'components/PlatformComposerPanel.tsx',
  'components/AccountDialog.tsx',
  'components/AccountsView.tsx',
].map((file) => readFileSync(path.join(root, file), 'utf8'));

const platformIconSource = readFileSync(path.join(root, 'components/PlatformIcon.tsx'), 'utf8');

describe('ui language audit', () => {
  it('does not expose English save status in tab bar', () => {
    const tabBar = shellSources[0]!;
    expect(tabBar).not.toMatch(/Local\s*•/);
    expect(tabBar).not.toContain("'Saved'");
    expect(tabBar).toContain('Локально ·');
  });

  it('uses Russian preview wording in shell components', () => {
    const combined = shellSources.join('\n');
    expect(combined).toContain('Предпросмотр пока недоступен');
    expect(combined).not.toContain('Preview пока недоступен');
  });

  it('uses brand SVG icons instead of letter badges for main platforms', () => {
    expect(platformIconSource).toContain('InstagramBrandIcon');
    expect(platformIconSource).toContain('TelegramBrandIcon');
    expect(platformIconSource).toContain('VkBrandIcon');
    expect(platformIconSource).not.toContain("instagram: 'IG'");
    expect(platformIconSource).not.toContain("telegram: 'TG'");
    expect(platformIconSource).not.toContain("vk: 'VK'");
  });

  it('shows telegram original-media note without fake crop controls', () => {
    const composer = shellSources[4]!;
    expect(composer).toContain('Изображение будет отправлено в исходном виде.');
    expect(composer).toContain('data-testid="composer-media-original-note"');
  });

  it('avoids technical handle wording in accounts UI', () => {
    const accountDialog = shellSources[5]!;
    const accountsView = shellSources[6]!;
    expect(accountDialog).not.toContain('Handle / username');
    expect(accountDialog).toContain('PROFILE_DISPLAY_NAME_LABEL');
    expect(accountsView).toContain('Добавить профиль');
    expect(accountsView).not.toContain('Добавить аккаунт');
  });
});
