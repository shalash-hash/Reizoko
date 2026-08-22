/**
 * Targeted backup/restore smoke test for Stage 1.14.
 * Usage: node scripts/smoke/backup-restore.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanupSmokeData,
  clickTestId,
  ensureEditor,
  getSmokeAppDataDir,
  smokeCall,
  waitAppReady,
  waitSaved,
  withSession,
  setSmokeImage,
} from './lib.mjs';

const BACKUP_TEXT = 'Backup smoke content for restore verification.';

async function fillEditor(page) {
  const canvas = page.locator('[data-testid="workspace-canvas"]');
  await canvas.locator('[data-testid="editor-title"]').fill('Backup Smoke Title');
  const textarea = canvas.locator('.block-item__textarea').first();
  if ((await textarea.count()) === 0) {
    await clickTestId(page, 'add-text-block');
  }
  await textarea.fill(BACKUP_TEXT);
  await waitSaved(page);
}

async function preparePublication(page) {
  await clickTestId(page, 'publish-menu-toggle');
  await page.locator('[data-testid="publish-menu"]').waitFor({ state: 'visible', timeout: 8000 });
  await clickTestId(page, 'publication-prepare');
  await page.locator('[data-testid="publication-prepare-confirmation"]').waitFor({
    state: 'visible',
    timeout: 10000,
  });
}

async function runScenario() {
  cleanupSmokeData();

  let remembered = null;

  await withSession(async ({ page }) => {
    await waitAppReady(page);
    await ensureEditor(page);
    await fillEditor(page);

    await smokeCall(page, 'createAccount', {
      platformId: 'instagram',
      displayName: 'Backup Brand',
      handle: '@backup',
    });
    const accounts = await page.evaluate(() => window.__REIZOKO_SMOKE__?.getAccounts() ?? []);
    const accountId = accounts[0]?.id;
    await setSmokeImage(page);
    await clickTestId(page, 'add-image-block');
    await waitSaved(page);
    await smokeCall(page, 'openPlatformTarget', 'instagram', accountId);
    await preparePublication(page);

    remembered = await page.evaluate(async () => {
      const state = window.__REIZOKO_SMOKE__?.getState();
      const publication = await window.__REIZOKO_SMOKE__?.getPublicationState();
      return {
        contentId: state?.contentId ?? null,
        title: state?.title ?? '',
        accountId: state?.accounts[0]?.id ?? null,
        publicationIds: publication?.publications.map((item) => item.id) ?? [],
        batchId: publication?.batches[0]?.id ?? null,
      };
    });

    await smokeCall(page, 'createBackup');
    await smokeCall(page, 'createNewDraft');
    await smokeCall(page, 'setTitle', 'Mutated Title');
    await waitSaved(page);
  });

  await withSession(async ({ page }) => {
    await waitAppReady(page);
    await smokeCall(page, 'navigateSection', 'settings');
    await page.locator('[data-testid="backup-settings-panel"]').waitFor({ state: 'visible', timeout: 10000 });
    await smokeCall(page, 'beginRestoreBackup');
    await page.locator('[data-testid="backup-restore-dialog"]').waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await smokeCall(page, 'confirmRestoreBackup');
    await page.waitForFunction(() => window.__REIZOKO_SMOKE__?.getState().title === 'Backup Smoke Title', null, {
      timeout: 15000,
    });

    const restored = await page.evaluate(async () => {
      const state = window.__REIZOKO_SMOKE__?.getState();
      const publication = await window.__REIZOKO_SMOKE__?.getPublicationState();
      return {
        contentId: state?.contentId ?? null,
        title: state?.title ?? '',
        accountId: state?.accounts[0]?.id ?? null,
        publicationIds: publication?.publications.map((item) => item.id) ?? [],
        batchId: publication?.batches[0]?.id ?? null,
        hasImage: state?.hasImage ?? false,
      };
    });

    if (restored.contentId !== remembered.contentId) {
      throw new Error('APP FAILURE: ContentItem ID changed after restore');
    }
    if (restored.accountId !== remembered.accountId) {
      throw new Error('APP FAILURE: SocialAccount ID changed after restore');
    }
    if (restored.batchId !== remembered.batchId) {
      throw new Error('APP FAILURE: Publication batch ID changed after restore');
    }
    if (!restored.hasImage) {
      throw new Error('APP FAILURE: Image not restored');
    }
    if (restored.title !== 'Backup Smoke Title') {
      throw new Error(`APP FAILURE: Title not restored: ${restored.title}`);
    }
  });

  const appData = getSmokeAppDataDir();
  const backupPath = join(appData, 'smoke-backup.reizoko-backup');
  const bytes = readFileSync(backupPath);
  const corrupted = bytes.subarray(0, Math.max(32, Math.floor(bytes.length / 2)));
  const corruptedPath = join(appData, 'smoke-backup-corrupted.reizoko-backup');
  writeFileSync(corruptedPath, corrupted);

  await withSession(async ({ page }) => {
    await waitAppReady(page);
    const rejected = await page.evaluate(async (path) => {
      try {
        await window.__REIZOKO_SMOKE__?.validateBackupFile(path);
        return false;
      } catch {
        return true;
      }
    }, corruptedPath.replace(/\\/g, '\\\\'));
    if (!rejected) {
      throw new Error('APP FAILURE: Corrupted backup was not rejected');
    }
  });

  console.log('PASS: backup-restore smoke');
}

runScenario().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
