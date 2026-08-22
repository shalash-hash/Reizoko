/**
 * Telegram connection + publish smoke (fake transport in REIZOKO_SMOKE_TEST mode).
 * Usage: node scripts/smoke/telegram.mjs
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
} from './lib.mjs';

async function connectFakeBot(page) {
  await clickTestId(page, 'accounts-nav');
  await page.locator('[data-testid="accounts-view"]').waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    await window.__REIZOKO_SMOKE__.connectTelegramBot('123:SMOKE_BOT_TOKEN');
    const connections = window.__REIZOKO_SMOKE__.getConnections();
    if (!connections[0]?.id) throw new Error('No telegram connection created');
    await window.__REIZOKO_SMOKE__.addTelegramDestination(connections[0].id, '@reizoko_smoke');
    const accounts = window.__REIZOKO_SMOKE__.getAccounts();
    const destination = accounts.find(
      (account) => account.platformId === 'telegram' && account.connectionId === connections[0].id,
    );
    if (!destination?.id) throw new Error('No telegram destination account');
    await window.__REIZOKO_SMOKE__.openPlatformTarget('telegram', destination.id);
  });
}

async function getPublicationState(page) {
  return page.evaluate(async () => window.__REIZOKO_SMOKE__.getPublicationState());
}

async function waitForPublished(page) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = await getPublicationState(page);
    if (state?.publications?.some((item) => item.status === 'published')) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for published publication');
}

async function prepareAndPublish(page) {
  await clickTestId(page, 'editor-nav');
  await ensureEditor(page);
  const canvas = page.locator('[data-testid="workspace-canvas"]');
  await canvas.locator('[data-testid="editor-title"]').fill('Telegram Smoke Post');
  let textarea = canvas.locator('.block-item__textarea').first();
  if ((await textarea.count()) === 0) {
    await clickTestId(page, 'add-text-block');
    textarea = canvas.locator('.block-item__textarea').first();
  }
  await textarea.fill('Smoke telegram publish body');
  await waitSaved(page);
  await clickTestId(page, 'publish-menu-toggle');
  await page.locator('[data-testid="publish-menu"]').waitFor({ state: 'visible', timeout: 8000 });
  await clickTestId(page, 'publication-prepare');
  await page.locator('[data-testid="publication-prepare-confirmation"]').waitFor({ timeout: 15000 });
  await clickTestId(page, 'publish-menu-toggle');
  await page.locator('[data-testid="publish-menu"]').waitFor({ state: 'visible', timeout: 8000 });
  const publishButton = page.locator('[data-testid="publication-publish-now"]');
  if (await publishButton.isEnabled()) {
    await publishButton.click();
  } else {
    await page.evaluate(async () => window.__REIZOKO_SMOKE__.publishNow());
  }
  await waitForPublished(page);
}

async function main() {
  cleanupSmokeData();
  await launchReizokoForSmoke();
  const session = await connectPage();
  const { page, browser } = session;
  try {
    await waitAppReady(page);
    await connectFakeBot(page);
    await prepareAndPublish(page);
    const state = await getPublicationState(page);
    const published = state?.publications?.find((item) => item.status === 'published');
    if (!published?.remotePostId) {
      throw new Error('Expected published Telegram publication with remotePostId');
    }
    console.log('telegram smoke: PASS');
  } finally {
    await closeSession(browser);
    await cleanupSmokeData();
  }
}

main().catch((error) => {
  console.error('telegram smoke: FAIL', error);
  process.exit(1);
});
