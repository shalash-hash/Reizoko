/**
 * Capture UI screenshots for docs. Requires built app with VITE_SCREENSHOT_MODE=1.
 * Usage: node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'screenshots');

const scenes = [
  { name: 'editor-light', scene: 'editor-light' },
  { name: 'editor-dark', scene: 'editor-dark' },
  { name: 'instagram-light', scene: 'instagram-light' },
  { name: 'telegram-dark', scene: 'telegram-dark' },
  { name: 'library-light', scene: 'library-light' },
  { name: 'platform-picker', scene: 'platform-picker' },
];

function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn('pnpm', ['--filter', '@reizoko/desktop', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
      cwd: root,
      shell: true,
      env: { ...process.env, VITE_SCREENSHOT_MODE: '1' },
      stdio: 'pipe',
    });

    let resolved = false;
    proc.stdout?.on('data', (d) => {
      const text = d.toString();
      if (!resolved && text.includes('Local:')) {
        resolved = true;
        resolve(proc);
      }
    });
    proc.stderr?.on('data', (d) => {
      const text = d.toString();
      if (!resolved && text.includes('Local:')) {
        resolved = true;
        resolve(proc);
      }
    });
    proc.on('error', reject);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(proc);
      }
    }, 15000);
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });

  // Build with screenshot mode
  await new Promise((resolve, reject) => {
    const build = spawn('pnpm', ['--filter', '@reizoko/desktop', 'build'], {
      cwd: root,
      shell: true,
      env: { ...process.env, VITE_SCREENSHOT_MODE: '1' },
      stdio: 'inherit',
    });
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))));
  });

  const preview = await startPreview();
  await new Promise((r) => setTimeout(r, 2000));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screenshot-ready="1"]', { timeout: 30000 });

  for (const { name, scene } of scenes) {
    await page.evaluate((s) => window.__REIZOKO_SCREENSHOT__?.applyScene(s), scene);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
    console.log(`Saved ${name}.png`);
  }

  await browser.close();
  preview.kill('SIGTERM');
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
