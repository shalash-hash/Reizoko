/**
 * Targeted Revision History smoke test for Stage 1.11.
 * Usage: node scripts/smoke/revision-history.mjs
 */
import { chromium } from 'playwright';
import {
  cleanupSmokeData,
  closeSession,
  connectPage,
  ensureEditor,
  launchReizokoForSmoke,
  waitAppReady,
  waitSaved,
  clickTestId,
  getSmokeState,
} from './lib.mjs';

const TITLE_A = 'Revision Smoke Title A';
const TITLE_B = 'Revision Smoke Title B';
const TEXT_A = 'Revision smoke content A';
const TEXT_B = 'Revision smoke content B';

async function fillEditor(page, title, text) {
  const canvas = page.locator('[data-testid="workspace-canvas"]');
  await canvas.locator('[data-testid="editor-title"]').fill(title);
  const textarea = canvas.locator('.block-item__textarea').first();
  if ((await textarea.count()) === 0) {
    await clickTestId(page, 'add-text-block');
  }
  await canvas.locator('.block-item__textarea').first().fill(text);
  await waitSaved(page);
}

async function createCheckpoint(page) {
  await clickTestId(page, 'revision-history-open');
  await page.locator('[data-testid="revision-history-drawer"]').waitFor({ state: 'visible', timeout: 10000 });
  await clickTestId(page, 'revision-create-checkpoint');
  await waitSaved(page);
  await clickTestId(page, 'revision-history-close');
  await page.locator('[data-testid="revision-history-drawer"]').waitFor({ state: 'hidden', timeout: 8000 });
}

async function runScenario() {
  cleanupSmokeData();
  await launchReizokoForSmoke();
  const session = await connectPage();
  const { page } = session;

  try {
    await waitAppReady(page);
    await ensureEditor(page);

    await fillEditor(page, TITLE_A, TEXT_A);
    await createCheckpoint(page);

    await fillEditor(page, TITLE_B, TEXT_B);
    await createCheckpoint(page);

    await clickTestId(page, 'revision-history-open');
    await page.locator('[data-testid="revision-history-drawer"]').waitFor({ state: 'visible', timeout: 10000 });

    const versionAItem = page.locator('[data-testid="revision-item-1"]');
    if ((await versionAItem.count()) === 0) {
      throw new Error('APP FAILURE: Version A not found in history');
    }
    await clickTestId(page, 'revision-item-1');

    const previewTitle = page.locator('[data-testid="revision-history-preview"] [data-testid="editor-title"]');
    await page.waitForFunction(
      (expected) => {
        const input = document.querySelector(
          '[data-testid="revision-history-preview"] [data-testid="editor-title"]',
        );
        return input instanceof HTMLInputElement && input.value === expected;
      },
      TITLE_A,
      { timeout: 10000 },
    );
    const previewValue = await previewTitle.inputValue();
    if (previewValue !== TITLE_A) {
      throw new Error(`APP FAILURE: Preview title mismatch: ${previewValue}`);
    }

    await clickTestId(page, 'revision-restore');
    await page.locator('[data-testid="revision-restore-confirm"]').waitFor({ state: 'visible', timeout: 8000 });
    await clickTestId(page, 'revision-restore-confirm');
    await waitSaved(page);
    await page.waitForFunction(
      (expected) => {
        const input = document.querySelector(
          '[data-testid="workspace-canvas"] [data-testid="editor-title"]',
        );
        return input instanceof HTMLInputElement && input.value === expected;
      },
      TITLE_A,
      { timeout: 10000 },
    );

    await clickTestId(page, 'revision-history-close');
    await ensureEditor(page);

    const restoredTitle = await page.locator('[data-testid="workspace-canvas"] [data-testid="editor-title"]').inputValue();
    if (restoredTitle !== TITLE_A) {
      throw new Error(`APP FAILURE: Restored title mismatch: ${restoredTitle}`);
    }

    const state = await getSmokeState(page);
    if (state.title !== TITLE_A) {
      throw new Error(`APP FAILURE: Smoke state title mismatch: ${state.title}`);
    }

    await clickTestId(page, 'revision-history-open');
    const versionBExists = (await page.locator('[data-testid="revision-item-3"]').count()) > 0;
    if (!versionBExists) {
      throw new Error('APP FAILURE: Version B missing from history after restore');
    }
    await clickTestId(page, 'revision-history-close');
  } finally {
    await closeSession(session.browser);
  }

  await launchReizokoForSmoke();
  const restart = await connectPage();
  try {
    await waitAppReady(restart.page);
    await ensureEditor(restart.page);
    await waitSaved(restart.page);
    const titleAfterRestart = await restart.page.locator('[data-testid="workspace-canvas"] [data-testid="editor-title"]').inputValue();
    if (titleAfterRestart !== TITLE_A) {
      throw new Error(`APP FAILURE: Title not persisted after restart: ${titleAfterRestart}`);
    }
  } finally {
    await closeSession(restart.browser);
  }

  console.log('Revision History smoke test: PASS');
}

runScenario().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
