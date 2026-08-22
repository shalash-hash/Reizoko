/**
 * Targeted Accounts smoke test for Stage 1.13.
 * Usage: node scripts/smoke/accounts.mjs
 */
import {
  cleanupSmokeData,
  connectPage,
  ensureEditor,
  smokeCall,
  waitAppReady,
  waitSaved,
  withSession,
  clickTestId,
  getSmokeState,
} from './lib.mjs';

const TEXT = 'Accounts smoke content for publication targets.';

let accountA;
let accountB;
let accountC;

async function createAccount(page, platformId, displayName, handle) {
  return page.evaluate(
    async ({ platformId: pid, displayName: name, handle: accountHandle }) => {
      const api = window.__REIZOKO_SMOKE__;
      if (!api?.createAccount) throw new Error('Smoke createAccount API unavailable');
      return api.createAccount({ platformId: pid, displayName: name, handle: accountHandle });
    },
    { platformId, displayName, handle },
  );
}

async function openAccountTarget(page, platformId, socialAccountId) {
  await page.evaluate(
    async ({ platformId: pid, socialAccountId: accountId }) => {
      const api = window.__REIZOKO_SMOKE__;
      if (!api?.openPlatformTarget) throw new Error('Smoke openPlatformTarget API unavailable');
      await api.openPlatformTarget(pid, accountId);
    },
    { platformId, socialAccountId },
  );
}

async function fillEditor(page) {
  const canvas = page.locator('[data-testid="workspace-canvas"]');
  await canvas.locator('[data-testid="editor-title"]').fill('Accounts Smoke Title');
  const textarea = canvas.locator('.block-item__textarea').first();
  if ((await textarea.count()) === 0) {
    await clickTestId(page, 'add-text-block');
  }
  await textarea.fill(TEXT);
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

async function getPublicationState(page) {
  return page.evaluate(async () => window.__REIZOKO_SMOKE__?.getPublicationState());
}

async function waitForAccountTab(page, socialAccountId) {
  await page.waitForFunction(
    (accountId) => {
      const state = window.__REIZOKO_SMOKE__?.getState();
      const target = state?.workspace.openPlatformTargets.find(
        (item) => item.socialAccountId === accountId,
      );
      if (!target) return false;
      return document.querySelector(`[data-testid="platform-tab-${target.id}"]`) !== null;
    },
    socialAccountId,
    { timeout: 10000 },
  );
}

async function activateAccountTab(page, socialAccountId, expectedPreviewName) {
  const targetId = await page.evaluate((accountId) => {
    const state = window.__REIZOKO_SMOKE__?.getState();
    return state?.workspace.openPlatformTargets.find((item) => item.socialAccountId === accountId)?.id;
  }, socialAccountId);
  if (!targetId) throw new Error(`APP FAILURE: Target tab for account ${socialAccountId} not found`);
  await smokeCall(page, 'setActiveTab', `platform-${targetId}`);
  await page.waitForFunction(
    ({ expectedTargetId, expectedAccountId }) => {
      const state = window.__REIZOKO_SMOKE__?.getState();
      if (state?.workspace.activeTabId !== `platform-${expectedTargetId}`) return false;
      const target = state.workspace.openPlatformTargets.find((item) => item.id === expectedTargetId);
      return target?.socialAccountId === expectedAccountId;
    },
    { expectedTargetId: targetId, expectedAccountId: socialAccountId },
    { timeout: 8000 },
  );
  await page
    .locator('[data-testid="platform-preview-panel"] [data-testid="preview-account-name"]')
    .waitFor({ state: 'visible', timeout: 8000 });
  const previewName = await page
    .locator('[data-testid="platform-preview-panel"] [data-testid="preview-account-name"]')
    .innerText();
  if (!previewName.includes(expectedPreviewName)) {
    throw new Error(`APP FAILURE: Preview account context mismatch: ${previewName}`);
  }
}

async function runScenario() {
  cleanupSmokeData();

  await withSession(async ({ page }) => {
    await ensureEditor(page);
    await fillEditor(page);

    accountA = await createAccount(page, 'instagram', 'Smoke IG A', '@smoke_a');
    accountB = await createAccount(page, 'instagram', 'Smoke IG B', '@smoke_b');
    accountC = await createAccount(page, 'telegram', 'Smoke TG C', '@smoke_c');

    await openAccountTarget(page, 'instagram', accountA.id);
    await openAccountTarget(page, 'instagram', accountB.id);
    await openAccountTarget(page, 'telegram', accountC.id);

    await waitForAccountTab(page, accountA.id);
    await waitForAccountTab(page, accountB.id);
    await waitForAccountTab(page, accountC.id);

    await activateAccountTab(page, accountA.id, 'Smoke IG A');

    await preparePublication(page);
    const publicationState = await getPublicationState(page);
    if (publicationState?.batches.length !== 1) {
      throw new Error(`APP FAILURE: Expected 1 batch, got ${publicationState?.batches.length ?? 0}`);
    }
    if (publicationState.publications.length !== 3) {
      throw new Error(`APP FAILURE: Expected 3 publications, got ${publicationState.publications.length}`);
    }

    const accountIds = new Set(publicationState.publications.map((pub) => pub.socialAccountId));
    if (!accountIds.has(accountA.id) || !accountIds.has(accountB.id) || !accountIds.has(accountC.id)) {
      throw new Error('APP FAILURE: Publications do not reference expected socialAccountIds');
    }
  });

  await withSession(async ({ page }) => {
    const restored = await getSmokeState(page);
    const restoredTargets = restored?.workspace.openPlatformTargets ?? [];
    if (restoredTargets.length !== 3) {
      throw new Error(`APP FAILURE: Expected 3 restored targets, got ${restoredTargets.length}`);
    }

    await page.evaluate(
      async (accountId) => window.__REIZOKO_SMOKE__?.setAccountActive(accountId, false),
      accountB.id,
    );

    const afterDeactivate = await getSmokeState(page);
    if (afterDeactivate?.workspace.openPlatformTargets.some((target) => target.socialAccountId === accountB.id)) {
      throw new Error('APP FAILURE: Deactivated account target tab was not closed');
    }

    const publicationAfterDeactivate = await getPublicationState(page);
    const stillReferencesB = publicationAfterDeactivate?.publications.some(
      (publication) => publication.socialAccountId === accountB.id,
    );
    if (!stillReferencesB) {
      throw new Error('APP FAILURE: Existing publication lost socialAccountId reference');
    }
  });

  console.log('PASS: accounts smoke');
}

runScenario().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
