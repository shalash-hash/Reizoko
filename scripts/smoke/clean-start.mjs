/**
 * Full clean-start smoke scenario for Stage 1.15.
 * Usage: node scripts/smoke/clean-start.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanupSmokeData,
  clickTestId,
  ensureEditor,
  getSmokeAppDataDir,
  launchReizokoForSmoke,
  closeSession,
  connectPage,
  setSmokeImage,
  smokeCall,
  waitAppReady,
  waitSaved,
  withSession,
} from './lib.mjs';

async function runScenario() {
  cleanupSmokeData();

  let remembered = null;

  await withSession(async ({ page }) => {
    await waitAppReady(page);
    await ensureEditor(page);

    await page.locator('[data-testid="editor-title"]').fill('Clean Start Smoke');
    await clickTestId(page, 'add-text-block');
    await page.locator('.block-item__textarea').first().fill('Clean start content');
    await waitSaved(page);

    await setSmokeImage(page);
    await clickTestId(page, 'add-image-block');
    await waitSaved(page);

    await smokeCall(page, 'createAccount', {
      platformId: 'instagram',
      displayName: 'Clean Start Brand',
      handle: '@cleanstart',
    });

    const accountId = await page.evaluate(() => window.__REIZOKO_SMOKE__?.getAccounts()[0]?.id ?? null);
    await smokeCall(page, 'openPlatformTarget', 'instagram', accountId);
    await clickTestId(page, 'publish-menu-toggle');
    await page.locator('[data-testid="publish-menu"]').waitFor({ state: 'visible', timeout: 8000 });
    await clickTestId(page, 'publication-prepare');
    await page.locator('[data-testid="publication-prepare-confirmation"]').waitFor({
      state: 'visible',
      timeout: 10000,
    });

    await ensureEditor(page);
    await clickTestId(page, 'revision-history-open');
    await page.locator('[data-testid="revision-history-drawer"]').waitFor({ state: 'visible', timeout: 10000 });
    await clickTestId(page, 'revision-create-checkpoint');
    await waitSaved(page);
    await clickTestId(page, 'revision-history-close');

    await smokeCall(page, 'createBackup');

    remembered = await page.evaluate(async () => {
      const state = window.__REIZOKO_SMOKE__?.getState();
      const publication = await window.__REIZOKO_SMOKE__?.getPublicationState();
      return {
        contentId: state?.contentId ?? null,
        title: state?.title ?? '',
        hasImage: state?.hasImage ?? false,
        accountId: state?.accounts[0]?.id ?? null,
        batchId: publication?.batches[0]?.id ?? null,
      };
    });
  });

  await launchReizokoForSmoke();
  const restart = await connectPage();
  try {
    await waitAppReady(restart.page);
    await ensureEditor(restart.page);
    const restored = await restart.page.evaluate(async () => {
      const state = window.__REIZOKO_SMOKE__?.getState();
      const publication = await window.__REIZOKO_SMOKE__?.getPublicationState();
      return {
        contentId: state?.contentId ?? null,
        title: state?.title ?? '',
        hasImage: state?.hasImage ?? false,
        accountId: state?.accounts[0]?.id ?? null,
        batchId: publication?.batches[0]?.id ?? null,
      };
    });

    if (restored.contentId !== remembered.contentId) {
      throw new Error('APP FAILURE: ContentItem ID changed after restart');
    }
    if (restored.title !== 'Clean Start Smoke') {
      throw new Error(`APP FAILURE: Title not persisted: ${restored.title}`);
    }
    if (!restored.hasImage) {
      throw new Error('APP FAILURE: Image missing after restart');
    }
    if (!restored.accountId || restored.accountId !== remembered.accountId) {
      throw new Error('APP FAILURE: Social account not persisted');
    }
    if (!restored.batchId || restored.batchId !== remembered.batchId) {
      throw new Error('APP FAILURE: Publication batch not persisted');
    }
  } finally {
    await closeSession(restart.browser);
  }

  const backupPath = join(getSmokeAppDataDir(), 'smoke-backup.reizoko-backup');
  const bytes = readFileSync(backupPath);
  if (!bytes.byteLength) {
    throw new Error('APP FAILURE: Backup archive is empty');
  }

  console.log('PASS: clean-start smoke');
}

runScenario().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
