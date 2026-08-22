/**
 * Stage 1 — Local Desktop final acceptance gate.
 * Usage: node scripts/stage1-acceptance.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoZombieProcess, EXE, prepareBetweenSmokeRuns, root } from './smoke/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.join(root, 'docs/STAGE1_ACCEPTANCE.md');

const ARTIFACTS = [
  {
    label: 'Release EXE',
    path: 'apps/desktop/src-tauri/target/release/reizoko-desktop.exe',
  },
  {
    label: 'MSI installer',
    path: 'apps/desktop/src-tauri/target/release/bundle/msi/Reizoko_0.1.0_x64_en-US.msi',
  },
  {
    label: 'NSIS installer',
    path: 'apps/desktop/src-tauri/target/release/bundle/nsis/Reizoko_0.1.0_x64-setup.exe',
  },
];

const results = [];

function runStep(id, label, command, args = [], options = {}) {
  console.log(`\n=== ${id}: ${label} ===\n`);
  const started = Date.now();
  const isWin = process.platform === 'win32';
  const executable = isWin && command === 'pnpm' ? 'pnpm.cmd' : command;
  const result = spawnSync(executable, args, {
    cwd: root,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: 'inherit',
    shell: isWin,
    windowsHide: true,
  });
  const durationMs = Date.now() - started;
  const pass = result.status === 0;
  results.push({ id, label, pass, durationMs, command: `${executable} ${args.join(' ')}` });
  if (!pass) {
    console.error(`\nFAIL: ${id} — ${label}`);
    writeReport(false);
    process.exit(result.status ?? 1);
  }
  console.log(`\nPASS: ${id} — ${label} (${Math.round(durationMs / 1000)}s)`);
}

function captureArtifactInfo() {
  return ARTIFACTS.map((artifact) => {
    const fullPath = path.join(root, artifact.path);
    if (!existsSync(fullPath)) {
      return { ...artifact, fullPath, exists: false };
    }
    const stats = statSync(fullPath);
    return {
      ...artifact,
      fullPath,
      exists: true,
      sizeBytes: stats.size,
      sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
      modifiedAt: stats.mtime.toISOString(),
    };
  });
}

function captureGitStatus() {
  const branch = spawnSync('git', ['branch', '--show-current'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  const status = spawnSync('git', ['status', '--short'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  const log = spawnSync('git', ['log', '-1', '--oneline'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  const remote = spawnSync('git', ['remote', '-v'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });

  return {
    branch: branch.stdout?.trim() || 'unknown',
    latestCommit: log.stdout?.trim() || 'none',
    remote: remote.stdout?.trim() || 'none',
    statusLines: (status.stdout ?? '').trim().split('\n').filter(Boolean),
  };
}

function writeReport(success) {
  const artifacts = captureArtifactInfo();
  const git = captureGitStatus();
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    '# Stage 1 Acceptance',
    '',
    `**Date:** ${date}`,
    '**App version:** 0.1.0',
    `**Result:** ${success ? 'PASS — Stage 1 Local Desktop COMPLETE' : 'FAIL — gate not passed'}`,
    '',
    '## Acceptance steps',
    '',
    '| Step | Check | Result | Duration |',
    '|------|-------|--------|----------|',
    ...results.map(
      (entry) =>
        `| ${entry.id} | ${entry.label} | ${entry.pass ? 'PASS' : 'FAIL'} | ${Math.round(entry.durationMs / 1000)}s |`,
    ),
    '',
    '## Vitest',
    '',
    '- Covered by `pnpm quality` + `pnpm test:coverage`',
    '- Packages: core, database, desktop',
    '',
    '## Smoke / E2E',
    '',
    '- Background Test Mode: `REIZOKO_SMOKE_TEST=1` (hidden window, isolated `reizoko-smoke.db`)',
    '- Targeted suite: clean-start, revision, accounts, publication, backup',
    '- Release phases A–G via `pnpm smoke:release`',
    '',
    '## Build artifacts',
    '',
    ...artifacts.map((artifact) =>
      artifact.exists
        ? `- **${artifact.label}:** \`${artifact.fullPath}\` — ${artifact.sizeMb} MB — ${artifact.modifiedAt}`
        : `- **${artifact.label}:** MISSING (\`${artifact.path}\`)`,
    ),
    '',
    '## Installer verification',
    '',
    '- **Automated:** artifact existence + size recorded above',
    '- **Manual (required):** install MSI/NSIS in disposable environment; verify first-run DB init; uninstall cleanly',
    '- Windows Sandbox not available in this automated run — recorded as manual acceptance item',
    '',
    '## Production UX',
    '',
    '- Without `REIZOKO_SMOKE_TEST=1`, app launches as normal visible desktop window (verified by code guards + manual)',
    '',
    '## User data isolation',
    '',
    '- Acceptance uses only `reizoko-smoke.db` and `media-smoke/`',
    '- User `reizoko.db`, user media, and real safety backups are not touched',
    '',
    '## Known non-blocking limitations',
    '',
    '- Full-text search → Stage 2',
    '- Planned block types (`video`, `link`, …) → Stage 2+',
    '- Real API publish / scheduler / OAuth → Stage 3',
    '- PowerShell execution policy / Cursor localhost tab → environment',
    '- Initial git commit → R.1 WAITING FOR USER COMMAND',
    '',
    '## Git status (read-only)',
    '',
    `- Branch: \`${git.branch}\``,
    `- Latest commit: \`${git.latestCommit}\``,
    `- Remote: ${git.remote.split('\n').join(' / ') || 'none'}`,
    `- Uncommitted paths: ${git.statusLines.length}`,
    '',
    '## Stage 2',
    '',
    '**NOT STARTED** — planning deferred until explicit user command.',
    '',
  ];

  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  console.log('Stage 1 — Local Desktop acceptance gate\n');

  runStep('A', 'Quality gate', 'pnpm', ['quality']);
  runStep('A2', 'Test coverage', 'pnpm', ['test:coverage']);

  if (!existsSync(EXE)) {
    console.log('\nRelease EXE missing — running production build before smoke tests...\n');
    runStep('PRE', 'Production build (pre-smoke)', 'pnpm', ['tauri:build']);
  }

  await prepareBetweenSmokeRuns();
  runStep('B-L-smoke', 'Targeted smoke suite (chained)', 'node', ['scripts/smoke/run-targeted-suite.mjs']);
  await prepareBetweenSmokeRuns();
  assertNoZombieProcess();

  runStep('J-K', 'Release smoke phases A–G', 'node', ['scripts/release-smoke-test.mjs'], {
    env: { SMOKE_RUNS: '1' },
  });
  await prepareBetweenSmokeRuns();
  assertNoZombieProcess();

  runStep('K', 'Production build verification', 'pnpm', ['quality:release']);

  console.log('\n=== L: Artifact verification ===\n');
  const artifacts = captureArtifactInfo();
  const missing = artifacts.filter((artifact) => !artifact.exists);
  for (const artifact of artifacts.filter((item) => item.exists)) {
    console.log(`${artifact.label}: ${artifact.fullPath} (${artifact.sizeMb} MB, ${artifact.modifiedAt})`);
  }
  results.push({
    id: 'L',
    label: 'Production artifact verification',
    pass: missing.length === 0,
    durationMs: 0,
    command: 'fs stat',
  });
  if (missing.length > 0) {
    console.error('Missing artifacts:', missing.map((item) => item.path).join(', '));
    writeReport(false);
    process.exit(1);
  }
  console.log('\nPASS: L — Production artifact verification');

  await prepareBetweenSmokeRuns();
  assertNoZombieProcess();
  results.push({
    id: 'Z',
    label: 'No zombie reizoko-desktop.exe',
    pass: true,
    durationMs: 0,
    command: 'tasklist',
  });
  console.log('\nPASS: Z — No zombie process after suite');

  writeReport(true);
  console.log(`\nAcceptance report written: ${REPORT_PATH}`);
  console.log('\nSTAGE 1 — LOCAL DESKTOP ✅ COMPLETE');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  writeReport(false);
  process.exit(1);
});
