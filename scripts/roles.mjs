#!/usr/bin/env node
// Assemble and validate App Composer role-pack review briefs.
//
//   node scripts/roles.mjs list
//   node scripts/roles.mjs check
//   node scripts/roles.mjs brief --role qa --input examples/role-packs/fictional-trail-notes.json
//   node scripts/roles.mjs brief --role security --input bundle.json --out output/security-brief.md
//
// Exit codes: 0 brief emitted and unblocked; 2 input refused; 3 brief emitted
// with a blocking stop. Nothing here executes a target, spends or approves.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRoleBrief,
  getRolePack,
  rolePackIds,
  rolePackReviewed,
  rolePackSuite,
  rolePacks,
  validateRolePacks,
  RolePackError,
} from '../src/lib/role-packs.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '..');

function parseArgs(argv) {
  const options = { command: 'help', role: '', input: '', out: '', json: false };
  const rest = [...argv];
  const first = rest[0];
  if (first && !first.startsWith('-')) options.command = rest.shift();
  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--role' || arg === '-r') options.role = rest.shift() ?? '';
    else if (arg === '--input' || arg === '-i') options.input = rest.shift() ?? '';
    else if (arg === '--out' || arg === '-o') options.out = rest.shift() ?? '';
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.command = 'help';
    else throw new RolePackError('unknown-argument', `Unknown argument: ${arg}`, 'Run node scripts/roles.mjs --help.');
  }
  return options;
}

function help() {
  return `App Composer role packs ${rolePackSuite}
Reviewed ${rolePackReviewed}

Usage
  node scripts/roles.mjs list
  node scripts/roles.mjs check
  node scripts/roles.mjs brief --role <id> --input <bundle.json> [--out <brief.md>] [--json]

Roles
${rolePacks.map((pack) => `  ${pack.id.padEnd(14)} ${pack.label} — ${pack.title}`).join('\n')}

The brief is a proposal. It cannot approve, deploy, merge, spend or change
access. Unsafe or incomplete input is refused before a brief is rendered.
`;
}

function list() {
  return [
    `Role packs ${rolePackSuite} · reviewed ${rolePackReviewed}`,
    '',
    ...rolePacks.map((pack) => `${pack.number}  ${pack.id.padEnd(14)} v${pack.version.padEnd(6)} ${pack.label.padEnd(15)} ${pack.title}`),
    '',
    `${rolePacks.length} packs, ${rolePacks.reduce((sum, pack) => sum + pack.negativeTests.length, 0)} negative tests, 1 shared fictional bundle.`,
  ].join('\n');
}

function readBundle(path) {
  if (!path) throw new RolePackError('missing-input', 'No evidence bundle was supplied.', 'Pass --input examples/role-packs/fictional-trail-notes.json.');
  const absolute = resolve(repository, path);
  let raw;
  try {
    raw = readFileSync(absolute, 'utf8');
  } catch {
    throw new RolePackError('unreadable-input', `Cannot read ${path}.`, 'Check the path. Do not retry with guessed owner or provider data.');
  }
  if (raw.length > 2_000_000) throw new RolePackError('oversized-input', 'Bundle exceeds 2 MB.', 'Keep only the bounded, redacted evidence needed for this job.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new RolePackError('invalid-json', `${path} is not valid JSON.`, 'Fix the JSON syntax. A parse failure is not an empty bundle.');
  }
}

function writeOut(path, text) {
  const absolute = resolve(repository, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, text);
  return absolute;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'help' || options.command === '--help') {
    process.stdout.write(help());
    return 0;
  }
  if (options.command === 'list') {
    process.stdout.write(list() + '\n');
    return 0;
  }
  if (options.command === 'check') {
    const issues = validateRolePacks();
    if (issues.length) {
      process.stderr.write(`Role packs refused:\n${issues.map((issue) => '  - ' + issue).join('\n')}\n`);
      return 1;
    }
    process.stdout.write(`Role packs valid: ${rolePacks.length} packs, ${rolePackIds.length} required ids, ${rolePacks.reduce((sum, pack) => sum + pack.negativeTests.length, 0)} negative tests.\n`);
    return 0;
  }
  if (options.command === 'brief') {
    if (!getRolePack(options.role)) {
      throw new RolePackError('unknown-role', `Unknown role pack: ${options.role || '(empty)'}.`, `Choose one of: ${rolePackIds.join(', ')}.`);
    }
    const { markdown, meta } = buildRoleBrief(options.role, readBundle(options.input));
    if (options.out) {
      const absolute = writeOut(options.out, markdown);
      process.stderr.write(`Brief written: ${absolute}\n`);
    }
    if (options.json) process.stdout.write(JSON.stringify({ meta, markdown }, null, 2) + '\n');
    else if (!options.out) process.stdout.write(markdown);
    else process.stdout.write(`Role: ${meta.role} v${meta.packVersion}\nDecision: ${meta.decision}\nBlocked: ${meta.blocked ? 'yes' : 'no'}\nEvidence: ${meta.evidenceCount}\n`);
    process.stderr.write(`${options.out ? 'Brief' : 'Brief'} ${meta.blocked ? 'emitted with a blocking stop' : 'emitted'}: ${meta.role}, decision ${meta.decision}, ${meta.stops.length} stop rule(s). Proposal only.\n`);
    return meta.blocked ? 3 : 0;
  }
  throw new RolePackError('unknown-command', `Unknown command: ${options.command}.`, 'Run node scripts/roles.mjs --help.');
}

try {
  process.exitCode = main();
} catch (error) {
  if (error instanceof RolePackError) {
    process.stderr.write(`Refused (${error.code}): ${error.message}\nHuman action: ${error.humanAction}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
