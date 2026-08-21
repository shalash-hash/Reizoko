import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const draftId = 'f9757a4a-71d4-4ec7-a8d3-202f7ee9c82a';
const batch = process.argv[2] ?? 'batch1';
const pagesRaw = readFileSync(`.superdesign/tmp/flow-pages-${batch}.json`, 'utf8');
const pagesCompact = JSON.stringify(JSON.parse(pagesRaw));
const context = 'Use exact Reizoko Approved Design system from source draft. Match sidebar, header, tabs, inspector, status bar geometry. Teal accent. Compact desktop 1920x1080.';

const cmd = [
  'npx --yes @superdesign/cli@latest execute-flow-pages',
  `--draft-id ${draftId}`,
  `--context ${JSON.stringify(context)}`,
  `--pages ${JSON.stringify(pagesCompact)}`,
].join(' ');

console.log(`Running batch ${batch}...`);
execSync(cmd, { stdio: 'inherit', shell: true, cwd: process.cwd() });
