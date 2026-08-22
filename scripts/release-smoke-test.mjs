/**
 * Phased release EXE smoke test orchestrator.
 * Usage: node scripts/release-smoke-test.mjs
 */
import { existsSync } from 'node:fs';
import { EXE, assertNoZombieProcess, cleanupSmokeData, prepareBetweenSmokeRuns } from './smoke/lib.mjs';
import { PHASES } from './smoke/phases.mjs';

const RUNS = Number(process.env.SMOKE_RUNS ?? 3);

function formatFailure(error) {
  if (error?.kind === 'APP') return `APP FAILURE: ${error.message}`;
  if (error?.kind === 'AUTOMATION') return `TEST AUTOMATION FAILURE: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

async function runSuite(runNumber) {
  cleanupSmokeData();
  const results = [];

  for (const phase of PHASES) {
    process.stdout.write(`Run ${runNumber} Phase ${phase.id} ${phase.label} ... `);
    try {
      await phase.run();
      results.push({ id: phase.id, label: phase.label, pass: true });
      console.log('PASS');
    } catch (error) {
      results.push({ id: phase.id, label: phase.label, pass: false, error: formatFailure(error) });
      console.log('FAIL');
      console.log(`  ${formatFailure(error)}`);
    }
  }

  return results;
}

function printSummary(runResults) {
  console.log('\n=== Smoke Test Summary ===\n');
  for (const [index, results] of runResults.entries()) {
    const allPass = results.every((result) => result.pass);
    console.log(`Run ${index + 1}: ${allPass ? 'PASS' : 'FAIL'}`);
    for (const result of results) {
      console.log(`  Phase ${result.id} ${result.label.padEnd(22)} ${result.pass ? 'PASS' : 'FAIL'}`);
      if (!result.pass && result.error) console.log(`    ${result.error}`);
    }
    console.log('');
  }

  const phaseRows = PHASES.map((phase) => {
    const passes = runResults.filter((results) =>
      results.find((result) => result.id === phase.id)?.pass,
    ).length;
    const pass = passes === runResults.length;
    return {
      label: `Phase ${phase.id} ${phase.label}`.padEnd(28),
      pass,
      detail: `${passes}/${runResults.length}`,
    };
  });

  for (const row of phaseRows) {
    console.log(`${row.label} ${row.pass ? 'PASS' : 'FAIL'} (${row.detail})`);
  }

  const allRunsPass = runResults.every((results) => results.every((result) => result.pass));
  console.log('\n3 consecutive runs:');
  runResults.forEach((results, index) => {
    const pass = results.every((result) => result.pass);
    console.log(`#${index + 1} ${pass ? 'PASS' : 'FAIL'}`);
  });

  return allRunsPass;
}

async function main() {
  if (!existsSync(EXE)) {
    console.error(`Release EXE not found: ${EXE}`);
    console.error('Run: pnpm tauri:build');
    process.exit(1);
  }

  console.log(`Release smoke test — ${RUNS} consecutive suite run(s)\n`);

  const runResults = [];
  for (let run = 1; run <= RUNS; run++) {
    if (run > 1) {
      await prepareBetweenSmokeRuns();
    }
    console.log(`\n--- Suite run ${run}/${RUNS} ---\n`);
    runResults.push(await runSuite(run));
    await prepareBetweenSmokeRuns();
    assertNoZombieProcess();
  }

  const allPass = printSummary(runResults);
  assertNoZombieProcess();
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
