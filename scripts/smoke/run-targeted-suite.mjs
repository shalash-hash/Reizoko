/**
 * Chained targeted smoke suite with deterministic process isolation between scripts.
 * Usage: node scripts/smoke/run-targeted-suite.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoZombieProcess, EXE, prepareBetweenSmokeRuns, root } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGETED_SCRIPTS = [
  { id: 'clean-start', label: 'Fresh database / clean-start', script: 'clean-start.mjs' },
  { id: 'revision', label: 'Revision History', script: 'revision-history.mjs' },
  { id: 'accounts', label: 'Social Accounts', script: 'accounts.mjs' },
  { id: 'publication', label: 'Publication drafts', script: 'publication-draft.mjs' },
  { id: 'backup', label: 'Backup / Restore', script: 'backup-restore.mjs' },
];

function runNodeScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  if (!existsSync(EXE)) {
    console.error(`Release EXE not found: ${EXE}`);
    console.error('Run: pnpm tauri:build');
    process.exit(1);
  }

  console.log('Targeted smoke suite — chained with process isolation\n');

  for (const entry of TARGETED_SCRIPTS) {
    console.log(`\n--- ${entry.label} (${entry.id}) ---\n`);
    await prepareBetweenSmokeRuns();
    runNodeScript(entry.script);
    await prepareBetweenSmokeRuns();
    assertNoZombieProcess();
    console.log(`\n✓ ${entry.label}: PASS\n`);
  }

  assertNoZombieProcess();
  console.log('PASS: targeted smoke suite');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
