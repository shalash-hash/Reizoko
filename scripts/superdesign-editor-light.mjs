import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const projectId = '8b96e25f-d203-462f-b546-813068902b21';
const refId = 'e0424f0f-a97b-4bd8-a841-da98ae386db1';
const prompt = readFileSync('.superdesign/tmp/editor-light-ref-prompt.txt', 'utf8');

const cmd = [
  'npx --yes @superdesign/cli@latest create-design-draft',
  `--project-id ${projectId}`,
  '--title "Editor — Light"',
  '--device custom --width 1920 --height 1080',
  `--reference-id ${refId}`,
  `--prompt ${JSON.stringify(prompt)}`,
  '--user-request "Single Editor Light screen from approved reference board"',
].join(' ');

console.log('Generating Editor — Light...');
execSync(cmd, { stdio: 'inherit', shell: true, cwd: process.cwd() });
