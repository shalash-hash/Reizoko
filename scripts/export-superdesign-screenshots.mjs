import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'docs', 'superdesign-approved');

const drafts = [
  { name: 'editor-light', id: 'f9757a4a-71d4-4ec7-a8d3-202f7ee9c82a' },
  { name: 'editor-dark', id: '2f80b94c-f997-4489-a2fe-821cb73fe79e' },
  { name: 'library-light', id: 'bd4dcf7d-6ca3-4457-8dc8-a8fbf1613a68' },
  { name: 'platform-picker-light', id: '93ec951f-e4ab-4d51-a396-422dc94e5541' },
  { name: 'settings-light', id: 'c6a4c480-8801-4bb5-9b24-a2327a4c1eac' },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  for (const { name, id } of drafts) {
    const url = `https://p.superdesign.dev/draft/${id}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
    console.log(`Saved ${name}.png`);
  }

  await browser.close();
  console.log(`Exports: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
