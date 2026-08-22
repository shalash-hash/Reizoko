/**
 * Shared infrastructure for phased release smoke tests.
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, '../..');
export const EXE = path.join(root, 'apps/desktop/src-tauri/target/release/reizoko-desktop.exe');
export const FIXTURE_IMAGE = path.join(root, 'scripts/fixtures/smoke-test.png');

export const TEST_TITLE = 'Smoke Test Reizoko 1.20';
export const SMOKE_TEXT = 'Smoke test paragraph for release verification.';
export const CDP_PORT = 9222;
export const AUTOMATED_TEST_ENV_VAR = 'REIZOKO_SMOKE_TEST';

export function buildSmokeProcessEnv() {
  return { ...process.env, [AUTOMATED_TEST_ENV_VAR]: '1' };
}

export async function waitForCdpReady(timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
      await browser.close();
      return;
    } catch {
      await sleep(500);
    }
  }
  autoFail(`CDP endpoint not ready on port ${CDP_PORT}`);
}

/**
 * Centralized EXE launch for all automated smoke/E2E runners.
 * Starts Reizoko in background (hidden/minimized) without stealing focus.
 */
export async function launchReizokoForSmoke() {
  await killAppAndWait();
  await sleep(500);
  prepareSmokeFixture();
  spawn(EXE, [], {
    env: buildSmokeProcessEnv(),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
  await waitForCdpReady();
  await sleep(1000);
}

/** @deprecated Use launchReizokoForSmoke */
export const launchApp = launchReizokoForSmoke;

export class SmokeFailure extends Error {
  constructor(message, kind = 'APP') {
    super(message);
    this.name = 'SmokeFailure';
    this.kind = kind;
  }
}

export function appFail(message) {
  throw new SmokeFailure(message, 'APP');
}

export function autoFail(message) {
  throw new SmokeFailure(message, 'AUTOMATION');
}

export function getSmokeAppDataDir() {
  const appData = process.env.APPDATA;
  if (!appData) autoFail('APPDATA is not set');
  return path.join(appData, 'com.reizoko.app');
}

export function cleanupSmokeData() {
  killApp();
  const dir = getSmokeAppDataDir();
  const removeSmokeArtifacts = () => {
    rmSync(path.join(dir, 'reizoko-smoke.db'), { force: true });
    rmSync(path.join(dir, 'media-smoke'), { recursive: true, force: true });
    cleanupSmokeTempArtifacts();
  };

  try {
    removeSmokeArtifacts();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EPERM') {
      killApp();
      execSync('timeout /t 2 /nobreak >nul', { stdio: 'ignore', shell: true });
      removeSmokeArtifacts();
      return;
    }
    throw error;
  }
}

export function prepareSmokeFixture() {
  const dir = getSmokeAppDataDir();
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'smoke-test-source.png');
  copyFileSync(FIXTURE_IMAGE, dest);
  return dest.replace(/\//g, '\\');
}

export function killApp() {
  try {
    execSync('taskkill /F /IM reizoko-desktop.exe', { stdio: 'ignore' });
  } catch {
    /* not running */
  }
}

export function isAppRunning() {
  try {
    const output = execSync('tasklist /FI "IMAGENAME eq reizoko-desktop.exe" /NH', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.toLowerCase().includes('reizoko-desktop.exe');
  } catch {
    return false;
  }
}

export async function killAppAndWait(timeoutMs = 15000) {
  killApp();
  const started = Date.now();
  while (isAppRunning() && Date.now() - started < timeoutMs) {
    await sleep(250);
  }
  if (isAppRunning()) {
    autoFail(`reizoko-desktop.exe did not exit within ${timeoutMs}ms`);
  }
}

/**
 * Deterministic barrier between chained smoke scripts.
 * Ensures the previous EXE is gone and smoke temp artifacts are cleared.
 * Does not touch user reizoko.db or user media/.
 */
export async function prepareBetweenSmokeRuns() {
  await killAppAndWait();
  await sleep(750);
  try {
    cleanupSmokeTempArtifacts();
  } catch {
    await sleep(500);
    cleanupSmokeTempArtifacts();
  }
  await sleep(250);
  if (isAppRunning()) {
    autoFail('reizoko-desktop.exe still running after prepareBetweenSmokeRuns');
  }
}

export function assertNoZombieProcess() {
  if (isAppRunning()) {
    autoFail('reizoko-desktop.exe zombie process detected');
  }
}

export function cleanupSmokeTempArtifacts() {
  const dir = getSmokeAppDataDir();
  if (!existsSync(dir)) return;

  const tempFiles = [
    'smoke-backup.reizoko-backup',
    'smoke-backup-corrupted.reizoko-backup',
    'smoke-export.json',
    'smoke-test-source.png',
  ];

  for (const fileName of tempFiles) {
    rmSync(path.join(dir, fileName), { force: true });
  }

  rmSync(path.join(dir, 'media-restore-staging'), { recursive: true, force: true });

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.isFile() &&
      entry.name.startsWith('pre-restore-backup-') &&
      entry.name.endsWith('.reizoko-backup')
    ) {
      rmSync(path.join(dir, entry.name), { force: true });
    }
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function assertAutomatedBackgroundLaunch(page) {
  const state = await page.evaluate(async () => {
    const api = window.__REIZOKO_SMOKE__;
    if (typeof api?.getAutomatedTestWindowState !== 'function') {
      return null;
    }
    return api.getAutomatedTestWindowState();
  });

  if (!state?.backgroundLaunch) {
    autoFail('Automated test window state API unavailable');
  }
  if (state.isFocused) {
    autoFail('Automated test window stole focus on startup');
  }
  if (state.isVisible && !state.isMinimized) {
    autoFail('Automated test window started visible in foreground');
  }
}

export async function waitAppReady(page) {
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30000 });
  if (await page.locator('.app-error').count()) {
    appFail((await page.locator('.app-error').textContent()) ?? 'Application error on startup');
  }
  await page.waitForFunction(() => !document.querySelector('.app-loading'), null, { timeout: 30000 });
  await page.waitForFunction(() => typeof window.__REIZOKO_SMOKE__?.getState === 'function', null, {
    timeout: 15000,
  });
  await assertAutomatedBackgroundLaunch(page);
}

export async function retryInfra(label, fn, maxAttempts = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await sleep(1200);
    }
  }
  autoFail(`${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function connectPage() {
  return retryInfra('CDP connection', async () => {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    const pages = browser.contexts().flatMap((context) => context.pages());
    const page = pages.find((candidate) => !candidate.url().startsWith('devtools://'));
    if (!page) autoFail('WebView page not found');

    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
    });

    return { browser, page, runtimeErrors };
  });
}

export async function closeSession(browser) {
  try {
    await browser.close();
  } catch {
    /* ignore */
  }
  await killAppAndWait();
  await sleep(500);
  assertNoZombieProcess();
}

export async function waitSaved(page) {
  await page.locator('[data-testid="save-status"][data-status="saved"]').waitFor({ timeout: 15000 });
}

export async function getSmokeState(page) {
  return page.evaluate(() => window.__REIZOKO_SMOKE__?.getState());
}

export async function smokeCall(page, method, ...args) {
  await page.evaluate(
    async ({ name, values }) => {
      const api = window.__REIZOKO_SMOKE__;
      const fn = api?.[name];
      if (typeof fn !== 'function') throw new Error(`Smoke API missing: ${name}`);
      await fn(...values);
    },
    { name: method, values: args },
  );
}

export async function navigateSection(page, section) {
  await smokeCall(page, 'navigateSection', section);
  await page.waitForFunction(
    (target) => {
      const state = window.__REIZOKO_SMOKE__?.getState();
      if (state?.workspace.sidebarSection !== target) return false;
      if (target === 'library') return document.querySelector('[data-testid="library-view"]') !== null;
      if (target === 'settings') return document.querySelector('[data-testid="settings-view"]') !== null;
      return document.querySelector('[data-testid="workspace-canvas"]') !== null;
    },
    section,
    { timeout: 15000 },
  );
}

export async function setActiveTab(page, tabId) {
  await smokeCall(page, 'setActiveTab', tabId);
  await page.waitForFunction(
    (target) => window.__REIZOKO_SMOKE__?.getState().workspace.activeTabId === target,
    tabId,
    { timeout: 10000 },
  );
}

export async function clickTestId(page, testId) {
  const locator = page.locator(`[data-testid="${testId}"]`);
  if ((await locator.count()) > 0) {
    await locator.first().click({ timeout: 10000 });
    return;
  }
  await page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!element) throw new Error(`Missing test id: ${id}`);
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, testId);
}

export async function ensureEditor(page) {
  await navigateSection(page, 'editor');
  await setActiveTab(page, 'editor');
  await page.waitForFunction(
    () =>
      window.__REIZOKO_SMOKE__?.getState().workspace.activeTabId === 'editor' &&
      document.querySelector('[data-testid="editor-title"]') !== null,
    null,
    { timeout: 15000 },
  );
}

export async function setSmokeImage(page) {
  const imagePath = prepareSmokeFixture();
  await page.evaluate((fixturePath) => {
    window.__REIZOKO_SMOKE_IMAGE__ = fixturePath;
  }, imagePath);
}

export function assertNoAppErrors(runtimeErrors) {
  if (runtimeErrors.length) appFail(runtimeErrors.join('; '));
}

export async function openAllPlatformTabs(page) {
  const state = await getSmokeState(page);
  const missing = ['instagram', 'telegram', 'vk'].filter((id) => !state.workspace.openPlatformTabs.includes(id));
  if (missing.length === 0) return;

  await smokeCall(page, 'setPickerOpen', true);
  await page.waitForFunction(() => window.__REIZOKO_SMOKE__?.getState().showPlatformPicker === true, null, {
    timeout: 8000,
  });

  for (const platformId of missing) {
    await smokeCall(page, 'openPlatform', platformId);
    await page.waitForFunction(
      (id) => window.__REIZOKO_SMOKE__?.getState().workspace.openPlatformTabs.includes(id),
      platformId,
      { timeout: 8000 },
    );
  }

  await smokeCall(page, 'setPickerOpen', false);
  await page.waitForFunction(() => window.__REIZOKO_SMOKE__?.getState().showPlatformPicker === false, null, {
    timeout: 8000,
  });
}

export async function activatePlatformTab(page, platformId) {
  await setActiveTab(page, `platform-${platformId}`);
  await page.waitForFunction(
    (id) =>
      window.__REIZOKO_SMOKE__?.getState().workspace.activeTabId === `platform-${id}` &&
      document.querySelector('[data-testid="platform-preview-panel"]') !== null,
    platformId,
    { timeout: 15000 },
  );
}

export async function setThemeMode(page, mode) {
  await navigateSection(page, 'settings');
  await smokeCall(page, 'setTheme', mode);
  await page.waitForFunction(
    (expected) =>
      window.__REIZOKO_SMOKE__?.getState().themeMode === expected &&
      document.documentElement.getAttribute('data-theme') !== null,
    mode,
    { timeout: 10000 },
  );
}

export async function getResolvedTheme(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

export async function withSession(run) {
  const onInterrupt = () => {
    void (async () => {
      await killAppAndWait();
      cleanupSmokeData();
      process.exit(130);
    })();
  };

  process.once('SIGINT', onInterrupt);
  await launchReizokoForSmoke();
  const session = await connectPage();
  try {
    await waitAppReady(session.page);
    return await run(session);
  } finally {
    process.off('SIGINT', onInterrupt);
    await closeSession(session.browser);
  }
}
