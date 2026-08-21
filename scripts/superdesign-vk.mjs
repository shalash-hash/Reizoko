import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pages = JSON.stringify(JSON.parse(readFileSync('.superdesign/tmp/flow-vk.json', 'utf8')));
const cmd = [
  'npx --yes @superdesign/cli@latest execute-flow-pages',
  '--draft-id 5c2d4af7-13e1-44fe-8815-f42ad1c29097',
  '--reference-id e0424f0f-a97b-4bd8-a841-da98ae386db1',
  '--context "Match approved Reizoko reference"',
  `--pages ${JSON.stringify(pages)}`,
].join(' ');

execSync(cmd, { stdio: 'inherit', shell: true });
