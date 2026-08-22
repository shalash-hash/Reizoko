import {
  TEST_TITLE,
  SMOKE_TEXT,
  appFail,
  assertNoAppErrors,
  activatePlatformTab,
  clickTestId,
  ensureEditor,
  getResolvedTheme,
  getSmokeState,
  navigateSection,
  openAllPlatformTabs,
  setSmokeImage,
  setThemeMode,
  smokeCall,
  waitAppReady,
  waitSaved,
  withSession,
} from './lib.mjs';

async function createSmokePost(page) {
  await ensureEditor(page);

  await page.locator('[data-testid="editor-title"]').fill(TEST_TITLE);
  await clickTestId(page, 'add-text-block');
  await clickTestId(page, 'add-text-block');
  await clickTestId(page, 'add-heading-block');

  const textareas = page.locator('.block-item__textarea');
  await textareas.nth(0).fill(`${SMOKE_TEXT} Block one.`);
  await textareas.nth(1).fill(`${SMOKE_TEXT} Block two.`);

  await setSmokeImage(page);
  await clickTestId(page, 'add-image-block');
  await page.locator('[data-testid="editor-image"]').waitFor({ state: 'visible', timeout: 15000 });

  const handles = page.locator('[data-testid="block-handle"]');
  const handleCount = await handles.count();
  if (handleCount < 2) appFail('Expected at least two draggable blocks');
  await handles.first().dragTo(handles.nth(handleCount - 1));

  await waitSaved(page);
  const state = await getSmokeState(page);
  if (state.title !== TEST_TITLE) appFail(`Title not saved: ${state.title}`);
  if (state.blockCount < 3) appFail(`Expected at least 3 blocks, got ${state.blockCount}`);
  if (!state.hasImage) appFail('Image block missing after import');
  return state;
}

export async function runPhaseA() {
  return withSession(async ({ page, runtimeErrors }) => {
    await createSmokePost(page);
    assertNoAppErrors(runtimeErrors);
    return { pass: true };
  });
}

export async function runPhaseB() {
  return withSession(async ({ page, runtimeErrors }) => {
    await ensureEditor(page);
    const state = await getSmokeState(page);
    if (state.title !== TEST_TITLE) appFail(`Master Post not restored: ${state.title}`);

    await openAllPlatformTabs(page);

    for (const platformId of ['instagram', 'telegram', 'vk']) {
      await activatePlatformTab(page, platformId);
      const preview = page.locator('[data-testid="platform-preview-panel"]');
      await preview.waitFor({ state: 'visible', timeout: 10000 });
      const text = await preview.innerText();
      if (!text.includes('Smoke test')) appFail(`${platformId} preview missing smoke text`);
      if ((await preview.locator('img').count()) === 0) appFail(`${platformId} preview missing image`);
    }

    await page.locator('[data-testid="inspector-panel"]').waitFor({ state: 'visible', timeout: 8000 });
    const inspectorText = await page.locator('[data-testid="inspector-panel"]').innerText();
    if (!inspectorText.trim()) appFail('Inspector panel is empty');

    await activatePlatformTab(page, 'instagram');
    await activatePlatformTab(page, 'telegram');

    await setThemeMode(page, 'light');
    if ((await getResolvedTheme(page)) !== 'light') appFail('Light theme not applied');
    await ensureEditor(page);
    await activatePlatformTab(page, 'vk');

    await setThemeMode(page, 'dark');
    if ((await getResolvedTheme(page)) !== 'dark') appFail('Dark theme not applied');

    assertNoAppErrors(runtimeErrors);
    return { pass: true };
  });
}

export async function runPhaseC() {
  return withSession(async ({ page, runtimeErrors }) => {
    await ensureEditor(page);
    await openAllPlatformTabs(page);

    await smokeCall(page, 'setPickerOpen', true);
    await page.locator('[data-testid="platform-picker"]').waitFor({ state: 'visible', timeout: 8000 });
    if ((await page.locator('[data-testid="platform-picker-general-instagram"]').count()) === 0) {
      appFail('Platform picker missing available platforms');
    }
    if ((await page.locator('[data-testid="platform-picker"]').getByText('Threads').count()) === 0) {
      appFail('Platform picker missing planned platforms');
    }

    await clickTestId(page, 'platform-picker-close');
    await page.waitForFunction(() => window.__REIZOKO_SMOKE__?.getState().showPlatformPicker === false, null, {
      timeout: 8000,
    });

    await smokeCall(page, 'setPickerOpen', true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__REIZOKO_SMOKE__?.getState().showPlatformPicker === false, null, {
      timeout: 8000,
    });

    await smokeCall(page, 'closePlatform', 'vk');
    await page.waitForFunction(
      (id) => !window.__REIZOKO_SMOKE__?.getState().workspace.openPlatformTabs.includes(id),
      'vk',
      { timeout: 8000 },
    );

    await smokeCall(page, 'openPlatform', 'vk');
    await page.waitForFunction(
      (id) => window.__REIZOKO_SMOKE__?.getState().workspace.openPlatformTabs.includes(id),
      'vk',
      { timeout: 8000 },
    );

    await activatePlatformTab(page, 'vk');
    const previewText = await page.locator('[data-testid="platform-preview-panel"]').innerText();
    if (!previewText.includes('Smoke test')) appFail('VK tab did not receive current Master Post');

    await smokeCall(page, 'closePlatform', 'telegram');
    await page.waitForFunction(
      (id) => !window.__REIZOKO_SMOKE__?.getState().workspace.openPlatformTabs.includes(id),
      'telegram',
      { timeout: 8000 },
    );
    await smokeCall(page, 'openPlatform', 'telegram');
    await page.waitForFunction(
      (id) => window.__REIZOKO_SMOKE__?.getState().workspace.openPlatformTabs.includes(id),
      'telegram',
      { timeout: 8000 },
    );

    assertNoAppErrors(runtimeErrors);
    return { pass: true };
  });
}

export async function runPhaseD() {
  return withSession(async ({ page, runtimeErrors }) => {
    await navigateSection(page, 'library');
    await page.locator('[data-testid="library-view"]').waitFor({ state: 'visible', timeout: 10000 });

    const cards = page.locator('[data-testid="library-card"]');
    if ((await cards.count()) === 0) appFail('Smoke post missing from library');
    const cardText = await cards.first().innerText();
    if (!cardText.includes(TEST_TITLE)) appFail('Library card title mismatch');

    await page.locator('[data-testid="library-search"]').fill('Smoke Test');
    await page.waitForFunction(
      (title) =>
        [...document.querySelectorAll('[data-testid="library-card"]')].some((card) =>
          card.textContent?.includes(title),
        ),
      TEST_TITLE,
      { timeout: 8000 },
    );

    await clickTestId(page, 'library-list');
    await page.locator('[data-testid="library-layout-list"]').waitFor({ state: 'visible', timeout: 5000 });
    await clickTestId(page, 'library-grid');
    await page.locator('[data-testid="library-layout-grid"]').waitFor({ state: 'visible', timeout: 5000 });

    await clickTestId(page, 'library-open');
    await ensureEditor(page);

    const opened = await getSmokeState(page);
    if (opened.title !== TEST_TITLE) appFail('Opened post title mismatch');
    if (opened.blockCount < 3) appFail('Opened post blocks not restored');
    if (!opened.hasImage) appFail('Opened post image not restored');
    const smokePostId = opened.contentId;
    if (!smokePostId) appFail('Opened post has no content id');

    await navigateSection(page, 'library');
    await page.locator('[data-testid="library-view"]').waitFor({ state: 'visible', timeout: 10000 });
    const libraryCountBefore = (await getSmokeState(page)).libraryCount;
    await clickTestId(page, 'library-duplicate');
    await page.waitForFunction(
      (expected) => window.__REIZOKO_SMOKE__?.getState().libraryCount >= expected,
      libraryCountBefore + 1,
      { timeout: 10000 },
    );

    const afterDuplicate = await getSmokeState(page);
    if (afterDuplicate.libraryCount < libraryCountBefore + 1) {
      appFail('Duplicate did not create a new library item');
    }
    if (afterDuplicate.contentId !== smokePostId) {
      appFail('Duplicating changed the original content item');
    }

    assertNoAppErrors(runtimeErrors);
    return { pass: true };
  });
}

export async function runPhaseE() {
  async function restartAndCheckTheme(expectedMode, expectedResolved) {
    return withSession(async ({ page, runtimeErrors }) => {
      await waitAppReady(page);
      const state = await getSmokeState(page);
      if (state.themeMode !== expectedMode) {
        appFail(`Theme mode not restored: expected ${expectedMode}, got ${state.themeMode}`);
      }
      const resolved = await getResolvedTheme(page);
      if (expectedResolved && resolved !== expectedResolved) {
        appFail(`Resolved theme mismatch: expected ${expectedResolved}, got ${resolved}`);
      }
      assertNoAppErrors(runtimeErrors);
      return { pass: true };
    });
  }

  await withSession(async ({ page, runtimeErrors }) => {
    await setThemeMode(page, 'dark');
    if ((await getResolvedTheme(page)) !== 'dark') appFail('Dark theme not applied before restart');
    assertNoAppErrors(runtimeErrors);
  });
  await restartAndCheckTheme('dark', 'dark');

  await withSession(async ({ page, runtimeErrors }) => {
    await setThemeMode(page, 'light');
    if ((await getResolvedTheme(page)) !== 'light') appFail('Light theme not applied before restart');
    assertNoAppErrors(runtimeErrors);
  });
  await restartAndCheckTheme('light', 'light');

  await withSession(async ({ page, runtimeErrors }) => {
    await setThemeMode(page, 'system');
    const state = await getSmokeState(page);
    if (state.themeMode !== 'system') appFail('System theme mode not saved');
    const prefersDark = await page.evaluate(
      () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    );
    const resolved = await getResolvedTheme(page);
    const expected = prefersDark ? 'dark' : 'light';
    if (resolved !== expected) {
      appFail(`System resolved theme mismatch: expected ${expected}, got ${resolved}`);
    }
    assertNoAppErrors(runtimeErrors);
  });

  return { pass: true };
}

export async function runPhaseF() {
  await withSession(async ({ page, runtimeErrors }) => {
    await ensureEditor(page);
    await openAllPlatformTabs(page);
    await activatePlatformTab(page, 'telegram');
    await waitSaved(page);
    assertNoAppErrors(runtimeErrors);
  });

  return withSession(async ({ page, runtimeErrors }) => {
    await waitAppReady(page);
    const state = await getSmokeState(page);
    if (state.title !== TEST_TITLE) appFail(`Workspace title not restored: ${state.title}`);
    if (state.blockCount < 3) appFail('Workspace blocks not restored');
    if (!state.hasImage) appFail('Workspace image not restored');
    if (!state.workspace.openPlatformTabs.includes('instagram')) appFail('Instagram tab not restored');
    if (!state.workspace.openPlatformTabs.includes('telegram')) appFail('Telegram tab not restored');
    if (!state.workspace.openPlatformTabs.includes('vk')) appFail('VK tab not restored');
    if (state.workspace.activeTabId !== 'platform-telegram') {
      appFail(`Active tab not restored: ${state.workspace.activeTabId}`);
    }
    assertNoAppErrors(runtimeErrors);
    return { pass: true };
  });
}

async function checkScreen(page, testId, runtimeErrors) {
  await page.locator(`[data-testid="${testId}"]`).waitFor({ state: 'visible', timeout: 10000 });
  assertNoAppErrors(runtimeErrors);
}

export async function runPhaseG() {
  return withSession(async ({ page, runtimeErrors }) => {
    await navigateSection(page, 'settings');
    await checkScreen(page, 'settings-view', runtimeErrors);
    await checkScreen(page, 'theme-system', runtimeErrors);
    await checkScreen(page, 'theme-light', runtimeErrors);
    await checkScreen(page, 'theme-dark', runtimeErrors);
    await checkScreen(page, 'about-card', runtimeErrors);

    await smokeCall(page, 'setPickerOpen', true);
    await checkScreen(page, 'platform-picker', runtimeErrors);
    await clickTestId(page, 'platform-picker-close');

    await navigateSection(page, 'library');
    await checkScreen(page, 'library-view', runtimeErrors);

    await ensureEditor(page);
    await openAllPlatformTabs(page);
    for (const platformId of ['instagram', 'telegram', 'vk']) {
      await activatePlatformTab(page, platformId);
      await checkScreen(page, 'platform-preview-panel', runtimeErrors);
    }

    await checkScreen(page, 'inspector-panel', runtimeErrors);
    await checkScreen(page, 'status-bar', runtimeErrors);

    await setThemeMode(page, 'light');
    await ensureEditor(page);
    await checkScreen(page, 'status-bar', runtimeErrors);

    await setThemeMode(page, 'dark');
    await ensureEditor(page);
    await checkScreen(page, 'status-bar', runtimeErrors);

    assertNoAppErrors(runtimeErrors);
    return { pass: true };
  });
}

export const PHASES = [
  { id: 'A', label: 'Editor/Media', run: runPhaseA },
  { id: 'B', label: 'Previews', run: runPhaseB },
  { id: 'C', label: 'Tabs/Picker', run: runPhaseC },
  { id: 'D', label: 'Library', run: runPhaseD },
  { id: 'E', label: 'Theme Persistence', run: runPhaseE },
  { id: 'F', label: 'Workspace Persistence', run: runPhaseF },
  { id: 'G', label: 'Settings', run: runPhaseG },
];
