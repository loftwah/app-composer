#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setupGuideVersion } from '../src/lib/project-setup.ts';
import { validateSetupEvaluation, summariseSetupEvaluations } from '../src/lib/setup-evaluation.ts';

// This validates observations; it never starts agents, provisions resources or certifies a setup.
const args = process.argv.slice(2);
try {
  if (args[0] === '--hash-export' && args.length === 2) {
    const bytes = await readFile(args[1]);
    if (bytes.length > 240000 || !bytes.toString('utf8').includes(`Guide: ${setupGuideVersion}`)) throw new Error('Supply the bounded Markdown actually copied/downloaded from /setup.');
    console.log(JSON.stringify({ guideVersion: setupGuideVersion, guideHash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, scope: 'Export identity only; no setup executed.' }, null, 2));
  } else if (args.length === 0 || (args.length === 1 && args[0] === '--summary')) {
    const ledger = JSON.parse(await readFile(fileURLToPath(new URL('../labs/setup-evaluation/runs.json', import.meta.url)), 'utf8'));
    const runs = validateSetupEvaluation(ledger);
    console.log(JSON.stringify({ schema: ledger.schema, guideVersion: setupGuideVersion, runs: runs.length, paths: summariseSetupEvaluations(runs, setupGuideVersion), scope: 'Only observed fresh-agent sessions enter this ledger. Deterministic guide tests are separate.' }, null, 2));
  } else throw new Error('Usage: node scripts/setup-evaluation.mjs [--summary | --hash-export /absolute/export.md]');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Setup evaluation failed.');
  process.exitCode = 1;
}
