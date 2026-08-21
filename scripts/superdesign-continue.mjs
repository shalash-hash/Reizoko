import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const projectId = '8b96e25f-d203-462f-b546-813068902b21';
const refId = 'e0424f0f-a97b-4bd8-a841-da98ae386db1';
const editorDraftId = '5c2d4af7-13e1-44fe-8815-f42ad1c29097';

function run(cmd) {
  console.log('\n>', cmd.slice(0, 120) + '...\n');
  execSync(cmd, { stdio: 'inherit', shell: true, cwd: process.cwd() });
}

// Step 1: Refine Editor Light closer to reference
const refinePrompt = readFileSync('.superdesign/tmp/editor-light-refine-prompt.txt', 'utf8');
run([
  'npx --yes @superdesign/cli@latest iterate-design-draft',
  `--draft-id ${editorDraftId}`,
  '--mode replace',
  `--reference-id ${refId}`,
  `--prompt ${JSON.stringify(refinePrompt)}`,
].join(' '));

// Step 2: Generate remaining screens from refined editor
const pages = JSON.stringify(JSON.parse(readFileSync('.superdesign/tmp/flow-pages-batch-ref.json', 'utf8')));
const context = 'Match approved Reizoko reference board exactly. Use same design system as source draft. Russian UI. Teal accent. Compact desktop 1920x1080.';

run([
  'npx --yes @superdesign/cli@latest execute-flow-pages',
  `--draft-id ${editorDraftId}`,
  `--context ${JSON.stringify(context)}`,
  `--reference-id ${refId}`,
  `--pages ${JSON.stringify(pages)}`,
].join(' '));

console.log('\nDone. Fetch nodes with fetch-design-nodes.');
