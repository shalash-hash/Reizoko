import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'docs', 'superdesign-approved');

const drafts = [
  { name: 'editor-light', id: '5c2d4af7-13e1-44fe-8815-f42ad1c29097' },
  { name: 'editor-dark', id: '3d8b7472-f911-46ff-b7e1-66ed54f943d4' },
  { name: 'instagram-light', id: 'fb5b1ff5-b0e5-40eb-8314-0c511118d80a' },
  { name: 'telegram-dark', id: 'e2e6a280-d84d-4e21-a9c7-df3f5e8ec8e3' },
  { name: 'library-light', id: 'f997e1c5-0ac3-4041-b30c-63276517115c' },
  { name: 'platform-picker', id: 'fb79cd05-4036-4f92-8811-f71a9ecbc342' },
  { name: 'settings-light', id: '0e4b2ff8-4cff-42c2-b27c-4df9265fbbcd' },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  for (const { name, id } of drafts) {
    await page.goto(`https://p.superdesign.dev/draft/${id}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    console.log(`Saved ${name}.png`);
  }

  await browser.close();
}

main();
