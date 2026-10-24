// Local dependency freshness report.
//
// Reads only committed files plus the installed `node_modules` metadata:
// `package.json`, `pnpm-lock.yaml` and `config/dependency-policy.json`. It
// makes no network request, starts no child process and reads no environment
// credential. "Fresh" here means every declared dependency is covered by the
// reviewed policy and the installed version still sits inside that policy's
// supported range. It is not a check for the newest available release.
//
// Exit codes:
//   0  every declared dependency is covered and inside its supported range
//   1  a covered dependency resolved outside its supported range
//   2  a declared dependency has no policy entry
//   3  the policy, lockfile or manifest could not be used
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export class FreshnessInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FreshnessInputError';
    this.code = 'input';
  }
}

/** Parse `major.minor.patch`, ignoring a leading `v` and any prerelease tail. */
export function parseVersion(value) {
  if (typeof value !== 'string') throw new FreshnessInputError('Version must be a string.');
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  if (!match) throw new FreshnessInputError(`Unsupported version: ${value}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * Parse a version inside a supported range. A bare `7` or `7.4` is allowed, but
 * only where padding the missing parts with zero means the same thing as the
 * usual npm reading. Ambiguous operators are refused instead of guessed.
 */
function parseRangeVersion(literal, operator) {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec(literal);
  if (!match) throw new FreshnessInputError(`Unsupported range version: ${literal}`);
  const parts = Number(match[3] !== undefined ? 3 : match[2] !== undefined ? 2 : 1);
  if (parts < 3 && ['>', '<=', '='].includes(operator)) {
    throw new FreshnessInputError(
      `Write the full major.minor.patch version for "${operator}${literal}" in a supported range.`,
    );
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

function compare(left, right) {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

function upperForCaret(version) {
  // Caret keeps the leftmost non-zero component, per the usual npm reading.
  if (version.major > 0) return { major: version.major + 1, minor: 0, patch: 0 };
  if (version.minor > 0) return { major: 0, minor: version.minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: version.patch + 1 };
}

function upperForTilde(version) {
  return { major: version.major, minor: version.minor + 1, patch: 0 };
}

function testComparator(version, comparator) {
  if (comparator === '*' || comparator === 'x') return true;
  const match = /^(>=|<=|>|<|=|\^|~)?(v?\d[\w.+-]*)$/.exec(comparator);
  if (!match) throw new FreshnessInputError(`Unsupported range comparator: ${comparator}`);
  const [, operator = '=', literal] = match;
  const target = parseRangeVersion(literal, operator);
  const order = compare(version, target);
  switch (operator) {
    case '=': return order === 0;
    case '>=': return order >= 0;
    case '<=': return order <= 0;
    case '>': return order > 0;
    case '<': return order < 0;
    case '^': return order >= 0 && compare(version, upperForCaret(target)) < 0;
    case '~': return order >= 0 && compare(version, upperForTilde(target)) < 0;
    default: throw new FreshnessInputError(`Unsupported range comparator: ${comparator}`);
  }
}

/**
 * Test a version against the supported subset of npm range syntax:
 * `*`, an exact version, `^`, `~`, comparison operators, AND by space and
 * OR by `||`. Anything outside that subset is refused rather than guessed.
 */
export function satisfies(version, range) {
  if (typeof range !== 'string' || range.trim() === '') {
    throw new FreshnessInputError('Supported range must be a non-empty string.');
  }
  const parsed = parseVersion(version);
  return range.split('||').some((alternative) => {
    const comparators = alternative.trim().split(/\s+/).filter(Boolean);
    if (comparators.length === 0) throw new FreshnessInputError(`Empty range: ${range}`);
    return comparators.every((comparator) => testComparator(parsed, comparator));
  });
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length > 1 && /^(['"]).*\1$/.test(trimmed)) return trimmed.slice(1, -1);
  return trimmed;
}

/**
 * Read the root importer from `pnpm-lock.yaml`. pnpm writes more than one YAML
 * document, so select the one that actually holds the project importer instead
 * of assuming a position, and drop the peer-resolution suffix pnpm appends to
 * `version`.
 */
export function readLockfileImporter(lockfile) {
  const documents = lockfile.split(/^---$/m);
  for (const document of documents) {
    const lines = document.split('\n');
    const start = lines.indexOf('importers:');
    if (start === -1) continue;
    let name = null;
    let section = null;
    let current = null;
    const entries = new Map();
    for (let index = start + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^[A-Za-z]/.test(line)) break;
      const importer = /^  (\S.*):$/.exec(line);
      if (importer) {
        if (name !== null) break;
        name = unquote(importer[1]);
        continue;
      }
      if (name === null) continue;
      const block = /^    (dependencies|devDependencies):$/.exec(line);
      if (block) {
        section = block[1];
        current = null;
        continue;
      }
      if (/^    \S/.test(line)) {
        section = null;
        current = null;
        continue;
      }
      if (!section) continue;
      const entry = /^      (\S.*):$/.exec(line);
      if (entry) {
        current = { section, specifier: null, version: null };
        entries.set(unquote(entry[1]), current);
        continue;
      }
      if (!current) continue;
      const specifier = /^        specifier: (.*)$/.exec(line);
      if (specifier) {
        current.specifier = unquote(specifier[1]);
        continue;
      }
      const version = /^        version: (.*)$/.exec(line);
      if (version) current.version = unquote(version[1]).split('(')[0];
    }
    if (entries.size > 0) return entries;
  }
  throw new FreshnessInputError('No root importer found in pnpm-lock.yaml.');
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new FreshnessInputError(`${label} could not be read as JSON: ${error.message}`);
  }
}

function installedVersion(root, name) {
  try {
    return readJson(join(root, 'node_modules', name, 'package.json'), `${name} metadata`).version ?? null;
  } catch {
    return null;
  }
}

function classify(current, supported) {
  if (!current) return 'unresolved';
  return satisfies(current, supported) ? 'ok' : 'drift';
}

export function inspectFreshness({ root = repositoryRoot, policyPath } = {}) {
  const manifest = readJson(join(root, 'package.json'), 'package.json');
  let lockfile;
  try {
    lockfile = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
  } catch (error) {
    throw new FreshnessInputError(`pnpm-lock.yaml could not be read: ${error.message}`);
  }
  const policy = readJson(policyPath ?? join(root, 'config', 'dependency-policy.json'), 'dependency policy');
  if (policy.contract !== 1) throw new FreshnessInputError('Unsupported dependency policy contract.');
  if (!policy.packages || typeof policy.packages !== 'object') {
    throw new FreshnessInputError('Dependency policy has no packages object.');
  }
  const importer = readLockfileImporter(lockfile);

  const declared = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).map(
    ([name, specifier]) => ({ name, specifier, kind: manifest.dependencies?.[name] ? 'dependencies' : 'devDependencies' }),
  );

  const packages = declared.map(({ name, specifier, kind }) => {
    const entry = policy.packages[name];
    const locked = importer.get(name)?.version ?? null;
    // The declared spec is exact for this repository, so the lockfile is the
    // authority on what would be installed and node_modules on what is.
    const current = installedVersion(root, name) ?? locked;
    const supported = entry?.supported ?? null;
    const status = supported ? classify(current, supported) : 'unknown';
    return {
      name,
      kind,
      declared: specifier,
      locked,
      current,
      supported,
      reviewed: entry?.reviewed ?? null,
      note: entry?.note ?? null,
      status,
    };
  });

  const runtime = [];
  const nodePolicy = policy.runtime?.node;
  if (nodePolicy) {
    const current = process.versions.node;
    runtime.push({ name: 'node', current, supported: nodePolicy, status: classify(current, nodePolicy) });
  }
  const pnpmPolicy = policy.runtime?.pnpm;
  if (pnpmPolicy) {
    const declaredManager = /^pnpm@(.+)$/.exec(manifest.packageManager ?? '')?.[1] ?? null;
    const current = declaredManager;
    runtime.push({ name: 'pnpm', current, supported: pnpmPolicy, status: current ? classify(current, pnpmPolicy) : 'unresolved' });
  }

  const drift = [...packages, ...runtime].filter((row) => row.status === 'drift').length;
  const unknown = packages.filter((row) => row.status === 'unknown').length;
  const unresolved = [...packages, ...runtime].filter((row) => row.status === 'unresolved').length;
  const ok = [...packages, ...runtime].filter((row) => row.status === 'ok').length;

  return {
    kind: 'app-composer.dependency-freshness',
    contract: 1,
    reviewed: policy.reviewed ?? null,
    runtime,
    packages,
    summary: { ok, drift, unknown, unresolved },
    status: unknown > 0 ? 'unknown' : drift > 0 || unresolved > 0 ? 'drift' : 'ok',
  };
}

export function exitCodeFor(report) {
  if (report.summary.unknown > 0) return 2;
  if (report.summary.drift > 0 || report.summary.unresolved > 0) return 1;
  return 0;
}

function pad(value, width) {
  const text = value ?? '-';
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

export function formatReport(report) {
  const rows = [
    ...report.runtime.map((row) => ({ ...row, kind: 'runtime' })),
    ...report.packages,
  ];
  const nameWidth = Math.max(9, ...rows.map((row) => row.name.length));
  const currentWidth = Math.max(7, ...rows.map((row) => (row.current ?? '-').length));
  const supportedWidth = Math.max(9, ...rows.map((row) => (row.supported ?? '-').length));
  const lines = [
    `Dependency freshness${report.reviewed ? ` (policy reviewed ${report.reviewed})` : ''}`,
    '',
    `  ${pad('name', nameWidth)}  ${pad('current', currentWidth)}  ${pad('supported', supportedWidth)}  status`,
  ];
  for (const row of rows) {
    lines.push(
      `  ${pad(row.name, nameWidth)}  ${pad(row.current, currentWidth)}  ${pad(row.supported, supportedWidth)}  ${row.status}`,
    );
  }
  const { ok, drift, unknown, unresolved } = report.summary;
  lines.push('', `Summary: ${ok} ok, ${drift} drift, ${unknown} unknown, ${unresolved} unresolved`);
  if (unknown > 0) lines.push('Add the missing dependencies to config/dependency-policy.json after reviewing them.');
  if (drift > 0) lines.push('Review every drifted version against its release notes before moving the policy.');
  if (unresolved > 0) lines.push('A version could not be resolved; run pnpm install so node_modules matches the lockfile.');
  return lines.join('\n');
}

function parseArguments(argv) {
  const options = { json: false, root: repositoryRoot, policyPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--root') options.root = resolve(argv[(index += 1)] ?? '');
    else if (argument === '--policy') options.policyPath = resolve(argv[(index += 1)] ?? '');
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new FreshnessInputError(`Unknown argument: ${argument}`);
  }
  return options;
}

export function run(argv = process.argv.slice(2), write = (text) => process.stdout.write(`${text}\n`)) {
  const options = parseArguments(argv);
  if (options.help) {
    write('Usage: node scripts/freshness.mjs [--json] [--root DIR] [--policy FILE]');
    return 0;
  }
  const report = inspectFreshness(options);
  write(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
  return exitCodeFor(report);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run();
  } catch (error) {
    process.stderr.write(`${error instanceof FreshnessInputError ? 'Freshness input error' : 'Freshness error'}: ${error.message}\n`);
    process.exitCode = 3;
  }
}
