/**
 * Targeted Publication Draft smoke test for Stage 1.12.
 * Usage: node scripts/smoke/publication-draft.mjs
 */
import {
  cleanupSmokeData,
  closeSession,
  connectPage,
  ensureEditor,
  launchReizokoForSmoke,
  waitAppReady,
  waitSaved,
  clickTestId,
  setSmokeImage,
  openAllPlatformTabs,
} from './lib.mjs';

const TITLE = 'Publication Smoke Title';
const TEXT = 'Publication smoke content for batch verification.';

async function fillEditor(page, title, text) {
  await ensureEditor(page);
  const canvas = page.locator('[data-testid="workspace-canvas"]');
  await canvas.locator('[data-testid="editor-title"]').fill(title);
  let textarea = canvas.locator('.block-item__textarea').first();
  if ((await textarea.count()) === 0) {
    await clickTestId(page, 'add-text-block');
    textarea = canvas.locator('.block-item__textarea').first();
  }
  await textarea.waitFor({ state: 'visible', timeout: 15000 });
  await textarea.fill(text, { timeout: 15000 });
  await waitSaved(page);
}

async function addImage(page) {
  await ensureEditor(page);
  await setSmokeImage(page);
  await clickTestId(page, 'add-image-block');
  await waitSaved(page);
}

async function openPlatforms(page) {
  await openAllPlatformTabs(page);
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

async function waitPrepareConfirmationDismissed(page) {
  await page.locator('[data-testid="publication-prepare-confirmation"]').waitFor({
    state: 'hidden',
    timeout: 8000,
  });
}

async function getPrepareError(page) {
  return page.evaluate(() => window.__REIZOKO_SMOKE__?.getState().publicationPrepareError ?? null);
}

async function getPublicationState(page) {
  return page.evaluate(async () => {
    const api = window.__REIZOKO_SMOKE__;
    if (!api?.getPublicationState) throw new Error('Smoke publication API is unavailable');
    return api.getPublicationState();
  });
}

async function runScenario() {
  cleanupSmokeData();
  await launchReizokoForSmoke();
  const session = await connectPage();
  const { page, browser } = session;

  try {
    await waitAppReady(page);
    await ensureEditor(page);

    await fillEditor(page, TITLE, TEXT);
    await addImage(page);
    await openPlatforms(page);
    await preparePublication(page);

    let state = await getPublicationState(page);
    if (!state || state.batches.length !== 1) {
      throw new Error(`APP FAILURE: Expected 1 batch, got ${state?.batches.length ?? 0}`);
    }
    if (state.publications.length !== 3) {
      throw new Error(`APP FAILURE: Expected 3 draft publications, got ${state.publications.length}`);
    }
    if (!state.publications.every((publication) => publication.status === 'draft')) {
      throw new Error('APP FAILURE: Not all publications are draft');
    }

    const firstSnapshot = state.publications.find((publication) => publication.platformId === 'instagram')
      ?.preparedSnapshot.transformedContent.text;

    await fillEditor(page, `${TITLE} edited`, `${TEXT} edited after prepare`);
    state = await getPublicationState(page);
    const afterEditSnapshot = state?.publications.find(
      (publication) => publication.platformId === 'instagram',
    )?.preparedSnapshot.transformedContent.text;

    if (afterEditSnapshot !== firstSnapshot) {
      throw new Error('APP FAILURE: Prepared snapshot changed after master edit');
    }

    await waitPrepareConfirmationDismissed(page);
    await openPlatforms(page);
    await preparePublication(page);
    state = await getPublicationState(page);
    const prepareError = await page.evaluate(() => window.__REIZOKO_SMOKE__?.getState().publicationPrepareError);
    if (prepareError) {
      throw new Error(`APP FAILURE: Second prepare failed: ${prepareError}`);
    }
    if (state?.batches.length !== 2) {
      throw new Error(`APP FAILURE: Expected 2 batches after second prepare, got ${state?.batches.length ?? 0}`);
    }

    await closeSession(browser);
    await launchReizokoForSmoke();
    const restartSession = await connectPage();
    const restartPage = restartSession.page;

    await waitAppReady(restartPage);
    const persisted = await getPublicationState(restartPage);
    if (persisted?.batches.length !== 2) {
      throw new Error(
        `APP FAILURE: Expected 2 persisted batches after restart, got ${persisted?.batches.length ?? 0}`,
      );
    }

    await closeSession(restartSession.browser);
    console.log('PASS: publication-draft smoke');
  } catch (error) {
    await closeSession(browser);
    throw error;
  }
}

runScenario().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
