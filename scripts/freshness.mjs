// Dependency freshness report.
//
// The default mode reads only committed files plus the installed `node_modules`
// metadata: `package.json`, `pnpm-lock.yaml` and
// `config/dependency-policy.json`. It makes no network request, starts no child
// process and reads no environment credential. "Fresh" here means every declared
// dependency is covered by the reviewed policy and the installed version still
// sits inside that policy's supported range. It is not a check for the newest
// available release.
//
// `--remote` is an explicit opt-in comparison with the official npm registry.
// It sends only public package names and locked versions, never paths, project
// data, credentials or environment values. It cannot install, update or deploy
// anything. A registry failure is reported as unknown and does not fail an
// ordinary build.
//
// Exit codes (local mode):
//   0  every declared dependency is covered and inside its supported range
//   1  a covered dependency resolved outside its supported range
//   2  a declared dependency has no policy entry
//   3  the policy, lockfile or manifest could not be used
//
// Remote mode keeps 0 for ordinary/unknown results and returns 4 only when a
// registry advisory names a locked version. It never turns an unreachable
// registry into a failed build.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const MAX_TIMEOUT_MS = 60000;
const MAX_RETRIES = 5;
const REMOTE_CONCURRENCY = 4;

export class FreshnessInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FreshnessInputError';
    this.code = 'input';
  }
}

class RegistryRequestError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.name = 'RegistryRequestError';
    this.retryable = retryable;
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

/**
 * The pnpm CLI that invoked this process records itself in
 * `npm_config_user_agent`. Reading it observes the actual executable without a
 * child process or network request; running the script directly under node
 * leaves the executable unobserved instead of copying the manifest pin.
 */
export function pnpmFromUserAgent(value = process.env.npm_config_user_agent) {
  const match = /(?:^|\s)pnpm\/(\d+\.\d+\.\d+)/.exec(value ?? '');
  return match ? match[1] : null;
}

/** Read the repository's selected Node default, if the file is a plain version. */
export function defaultNodeVersion(root = repositoryRoot) {
  try {
    const value = readFileSync(join(root, '.node-version'), 'utf8').trim();
    parseVersion(value);
    return value;
  } catch {
    return null;
  }
}

/** Read the reproducible pnpm toolchain pin from `packageManagerDependencies`. */
export function lockfileManagerVersion(lockfile, name = 'pnpm') {
  const lines = lockfile.split('\n');
  const start = lines.indexOf('packageManagerDependencies:');
  if (start === -1) return null;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z]/.test(line)) break;
    const entry = /^  (\S.*):$/.exec(line);
    if (entry && unquote(entry[1]) === name) {
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const version = /^    version: (.*)$/.exec(lines[cursor]);
        if (version) return unquote(version[1]).split('(')[0];
        if (/^  \S/.test(lines[cursor])) break;
      }
    }
  }
  return null;
}

function classify(current, supported) {
  if (!current) return 'unresolved';
  return satisfies(current, supported) ? 'ok' : 'drift';
}

/**
 * Runtime rows never borrow a declared value as an observation. Drift is raised
 * for an actually observed executable, the selected default, or the declared
 * compatibility range; an unknown executable stays visible as `unobserved`.
 */
export function runtimeStatus({ declared, selectedDefault, installed, supported }) {
  if (!supported) return 'unknown';
  try {
    if (installed && !satisfies(installed, supported)) return 'drift';
    if (selectedDefault && !satisfies(selectedDefault, supported)) return 'drift';
    const candidate = installed ?? selectedDefault;
    if (declared && candidate && !satisfies(candidate, declared)) return 'drift';
  } catch {
    return 'unknown';
  }
  if (!installed) return 'unobserved';
  return 'ok';
}

export function inspectFreshness({
  root = repositoryRoot,
  policyPath,
  nodeVersion = process.versions.node,
  pnpmVersion = pnpmFromUserAgent(),
} = {}) {
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
    const selectedDefault = policy.runtime?.nodeDefault ?? defaultNodeVersion(root);
    runtime.push({
      name: 'node',
      declared: manifest.engines?.node ?? null,
      default: selectedDefault,
      installed: nodeVersion,
      observed: true,
      supported: nodePolicy,
      tested: Array.isArray(policy.runtime?.nodeTested) ? policy.runtime.nodeTested : [],
      status: runtimeStatus({
        declared: manifest.engines?.node ?? null,
        selectedDefault,
        installed: nodeVersion,
        supported: nodePolicy,
      }),
    });
  }
  const pnpmPolicy = policy.runtime?.pnpm;
  if (pnpmPolicy) {
    const declaredManager = /^pnpm@(.+)$/.exec(manifest.packageManager ?? '')?.[1] ?? null;
    runtime.push({
      name: 'pnpm',
      declared: declaredManager,
      default: declaredManager,
      installed: pnpmVersion,
      observed: Boolean(pnpmVersion),
      locked: lockfileManagerVersion(lockfile),
      supported: pnpmPolicy,
      tested: Array.isArray(policy.runtime?.pnpmTested) ? policy.runtime.pnpmTested : [],
      status: declaredManager
        ? runtimeStatus({
            declared: declaredManager,
            selectedDefault: declaredManager,
            installed: pnpmVersion,
            supported: pnpmPolicy,
          })
        : 'unresolved',
    });
  }

  const drift = [...packages, ...runtime].filter((row) => row.status === 'drift').length;
  const unknown = packages.filter((row) => row.status === 'unknown').length;
  const unresolved = [...packages, ...runtime].filter((row) => row.status === 'unresolved').length;
  const unobserved = runtime.filter((row) => row.status === 'unobserved').length;
  const ok = [...packages, ...runtime].filter((row) => row.status === 'ok').length;

  return {
    kind: 'app-composer.dependency-freshness',
    contract: 1,
    reviewed: policy.reviewed ?? null,
    runtime,
    packages,
    summary: { ok, drift, unknown, unresolved, unobserved },
    status: unknown > 0 ? 'unknown' : drift > 0 || unresolved > 0 ? 'drift' : 'ok',
  };
}

function validateRegistry(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new FreshnessInputError(`Registry must be a valid URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new FreshnessInputError('Registry must use http or https.');
  }
  if (url.username || url.password) {
    throw new FreshnessInputError('Registry URLs must not contain credentials.');
  }
  if (url.search || url.hash) {
    throw new FreshnessInputError('Registry URLs must not contain a query or fragment.');
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)) {
    throw new FreshnessInputError('A plain-http registry is only accepted on this machine.');
  }
  return url.toString().replace(/\/$/, '');
}

function encodePackageName(name) {
  return name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
}

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

async function requestJson(url, {
  init = {},
  fetchImpl,
  timeoutMs,
  retries,
  retryDelayMs,
  label,
}) {
  let lastError = new RegistryRequestError(`${label} could not be read.`);
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...init,
        redirect: 'error',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'user-agent': 'app-composer-freshness/1 (read-only registry check)',
          ...(init.headers ?? {}),
        },
      });
      if (response.status === 429 || response.status >= 500) {
        throw new RegistryRequestError(`${label} returned HTTP ${response.status}.`, { retryable: true });
      }
      if (!response.ok) throw new RegistryRequestError(`${label} returned HTTP ${response.status}.`);
      try {
        return await response.json();
      } catch {
        throw new RegistryRequestError(`${label} was not valid JSON.`);
      }
    } catch (error) {
      const timedOut = controller.signal.aborted;
      lastError = timedOut
        ? new RegistryRequestError(`${label} timed out after ${timeoutMs}ms.`, { retryable: true })
        : error instanceof RegistryRequestError
          ? error
          : new RegistryRequestError(`${label} was unreachable: ${error.message}`, { retryable: true });
      if (attempt < retries && lastError.retryable) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function latestRelease(name, options) {
  try {
    const payload = await requestJson(
      `${options.registry}/${encodePackageName(name)}/latest`,
      { ...options, label: `${name} metadata` },
    );
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { state: 'unknown', reason: `${name} metadata was not a JSON object.` };
    }
    if (payload.name !== name) {
      return {
        state: 'unknown',
        reason: `${name} metadata named ${JSON.stringify(payload.name)} instead.`,
      };
    }
    if (typeof payload.version !== 'string') {
      return { state: 'unknown', reason: `${name} metadata did not include a version.` };
    }
    try {
      parseVersion(payload.version);
    } catch {
      return { state: 'unknown', reason: `${name} metadata returned an unsupported version: ${payload.version}` };
    }
    return {
      state: 'available',
      version: payload.version,
      publishedAt: typeof payload.publishedAt === 'string' ? payload.publishedAt : null,
      deprecated: typeof payload.deprecated === 'string' ? payload.deprecated : null,
      engines: payload.engines && typeof payload.engines === 'object' ? payload.engines : null,
    };
  } catch (error) {
    return { state: 'unknown', reason: error.message };
  }
}

async function latestAdvisories(packages, options) {
  const query = Object.fromEntries(
    packages
      .filter((entry) => entry.current)
      .map((entry) => [entry.name, [entry.current]]),
  );
  if (Object.keys(query).length === 0) {
    return { state: 'available', advisories: new Map() };
  }
  try {
    const payload = await requestJson(
      `${options.registry}/-/npm/v1/security/advisories/bulk`,
      {
        ...options,
        label: 'advisory response',
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(query),
        },
      },
    );
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new RegistryRequestError('Advisory response was not a JSON object.');
    }
    const advisories = new Map();
    for (const [name, list] of Object.entries(payload)) {
      if (!Array.isArray(list)) {
        throw new RegistryRequestError(`Advisory response for ${name} was not a list.`);
      }
      advisories.set(
        name,
        list
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => ({
            id: typeof entry.id === 'number' || typeof entry.id === 'string' ? entry.id : null,
            severity: typeof entry.severity === 'string' ? entry.severity.slice(0, 40) : 'unknown',
            title: typeof entry.title === 'string' ? entry.title.slice(0, 300) : null,
            url: typeof entry.url === 'string' && /^https:\/\//.test(entry.url) ? entry.url : null,
            vulnerableVersions:
              typeof entry.vulnerable_versions === 'string'
                ? entry.vulnerable_versions.slice(0, 300)
                : null,
          })),
      );
    }
    return { state: 'available', advisories };
  } catch (error) {
    return { state: 'unknown', reason: error.message, advisories: new Map() };
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

const NODE_DIST_INDEX = 'https://nodejs.org/dist/index.json';

/**
 * Read the official Node release index in the explicit remote path only. The
 * newest Active LTS is a target to review, not an automatically qualified
 * version; prereleases are excluded.
 */
export async function inspectNodeUpstream({
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  retryDelayMs = 250,
  now = () => new Date(),
  indexUrl = NODE_DIST_INDEX,
} = {}) {
  const checkedAt = now().toISOString();
  try {
    const list = await requestJson(indexUrl, {
      fetchImpl,
      timeoutMs,
      retries,
      retryDelayMs,
      label: 'Node release index',
    });
    if (!Array.isArray(list)) {
      return { state: 'unknown', checkedAt, source: indexUrl, reason: 'The Node release index was not a list.' };
    }
    const releases = [];
    for (const entry of list) {
      if (!entry || typeof entry.version !== 'string' || entry.version.includes('-')) continue;
      try {
        const parsed = parseVersion(entry.version);
        releases.push({
          version: entry.version.replace(/^v/, ''),
          ...parsed,
          lts: typeof entry.lts === 'string' ? entry.lts : null,
          date: typeof entry.date === 'string' ? entry.date : null,
          security: entry.security === true,
        });
      } catch {
        // Ignore an unusable row rather than guessing.
      }
    }
    if (releases.length === 0) {
      return { state: 'unknown', checkedAt, source: indexUrl, reason: 'The Node release index had no usable release.' };
    }
    const newest = (rows) => rows.reduce((best, row) => (compare(row, best) > 0 ? row : best));
    const latest = newest(releases);
    const latestLts = newest(releases.filter((row) => row.lts));
    const byMajor = {};
    for (const major of [22, 24, 26]) {
      const rows = releases.filter((row) => row.major === major);
      if (rows.length > 0) {
        const row = newest(rows);
        byMajor[major] = { version: row.version, lts: row.lts, date: row.date, security: row.security };
      }
    }
    return {
      state: 'available',
      checkedAt,
      source: indexUrl,
      latest: { version: latest.version, lts: latest.lts, date: latest.date, security: latest.security },
      latestLts: { version: latestLts.version, lts: latestLts.lts, date: latestLts.date, security: latestLts.security },
      byMajor,
    };
  } catch (error) {
    return { state: 'unknown', checkedAt, source: indexUrl, reason: error.message };
  }
}

/** Read the official pnpm dist-tags and relate them to the selected executable. */
export async function inspectPnpmUpstream({
  registry = DEFAULT_REGISTRY,
  selected = null,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  retryDelayMs = 250,
  now = () => new Date(),
} = {}) {
  const checkedAt = now().toISOString();
  try {
    const tags = await requestJson(`${validateRegistry(registry)}/-/package/pnpm/dist-tags`, {
      fetchImpl,
      timeoutMs,
      retries,
      retryDelayMs,
      label: 'pnpm dist-tags',
    });
    if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
      return { state: 'unknown', checkedAt, reason: 'The pnpm dist-tags response was not an object.' };
    }
    const latest = typeof tags.latest === 'string' ? tags.latest : null;
    const next = typeof tags['next-12'] === 'string' ? tags['next-12'] : null;
    let relationship = 'uncompared';
    if (selected && latest) {
      try {
        const order = compare(parseVersion(selected), parseVersion(latest));
        relationship = order === 0 ? 'latest-tag' : order > 0 ? 'ahead-of-latest-tag' : 'behind-latest-tag';
      } catch {
        relationship = 'uncompared';
      }
    }
    return { state: 'available', checkedAt, latest, next, selected, relationship };
  } catch (error) {
    return { state: 'unknown', checkedAt, reason: error.message };
  }
}

function classifyRuntime(observed, target) {
  const current = parseVersion(observed);
  const latest = parseVersion(target);
  const order = compare(latest, current);
  if (order === 0) return { classification: 'current', reason: null };
  if (order < 0) {
    return {
      classification: 'current',
      reason: `Observed ${observed} is ahead of the official target ${target}; the policy controls the selected version.`,
    };
  }
  if (latest.major > current.major) {
    return {
      classification: 'breaking-major',
      reason: `The official target ${target} is a newer major; a runtime move needs its own qualification.`,
    };
  }
  if (latest.minor > current.minor) {
    return {
      classification: 'feature-opportunity',
      reason: `The official target ${target} is a newer minor; review it before changing the default.`,
    };
  }
  return {
    classification: 'compatible-patch',
    reason: `The official target ${target} is a newer patch than ${observed}.`,
  };
}

function remoteAssessment(pkg, release, advisories) {  if (!pkg.current) {
    return { classification: 'unknown', reason: 'No installed or locked version could be read.' };
  }
  let current;
  try {
    current = parseVersion(pkg.current);
  } catch {
    return { classification: 'unknown', reason: `Locked version is not semver: ${pkg.current}` };
  }
  const advisory = advisories.get(pkg.name)?.[0] ?? null;
  if (advisory) {
    return {
      classification: 'security-urgent',
      reason: `Registry advisory ${advisory.id ?? ''} affects ${pkg.current}: ${advisory.title ?? advisory.severity}`,
      advisory,
    };
  }
  if (!pkg.supported) {
    return { classification: 'unsupported', reason: 'No reviewed supported range is recorded.' };
  }
  let qualified = false;
  try {
    qualified = satisfies(pkg.current, pkg.supported);
  } catch {
    return { classification: 'unknown', reason: `Reviewed range could not be read: ${pkg.supported}` };
  }
  if (!qualified) {
    return {
      classification: 'unsupported',
      reason: `Locked ${pkg.current} is outside the reviewed range ${pkg.supported}.`,
    };
  }
  if (release.state !== 'available') {
    return { classification: 'unknown', reason: release.reason };
  }
  let latest;
  try {
    latest = parseVersion(release.version);
  } catch {
    return { classification: 'unknown', reason: `Registry returned an unsupported version: ${release.version}` };
  }
  const order = compare(latest, current);
  if (order < 0) {
    return {
      classification: 'unknown',
      reason: `Registry latest ${release.version} is older than the locked ${pkg.current}; check the package identity and dist-tags.`,
    };
  }
  if (order === 0) return { classification: 'current', reason: null };
  let latestQualified = false;
  try {
    latestQualified = satisfies(release.version, pkg.supported);
  } catch {
    latestQualified = false;
  }
  if (latest.major > current.major) {
    return {
      classification: 'breaking-major',
      reason: `Registry latest ${release.version} is a new major; the reviewed range is ${pkg.supported}.`,
      latestQualified,
    };
  }
  if (latest.minor > current.minor) {
    return {
      classification: 'feature-opportunity',
      reason: `Registry latest ${release.version} adds a minor release${latestQualified ? ' inside' : ' outside'} the reviewed range ${pkg.supported}.`,
      latestQualified,
    };
  }
  return {
    classification: 'compatible-patch',
    reason: `Registry latest ${release.version} is a patch release${latestQualified ? ' inside' : ' outside'} the reviewed range ${pkg.supported}.`,
    latestQualified,
  };
}

/**
 * Compare the local report with the official npm registry. Only public package
 * names and locked versions are sent. Every failure is contained in the report.
 */
export async function inspectRemoteFreshness({
  root = repositoryRoot,
  policyPath,
  report,
  registry = DEFAULT_REGISTRY,
  nodeIndexUrl = NODE_DIST_INDEX,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  retryDelayMs = 250,
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new FreshnessInputError('A fetch implementation is required for remote checks.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new FreshnessInputError(`Timeout must be an integer from 100 to ${MAX_TIMEOUT_MS}ms.`);
  }
  if (!Number.isInteger(retries) || retries < 0 || retries > MAX_RETRIES) {
    throw new FreshnessInputError(`Retries must be an integer from 0 to ${MAX_RETRIES}.`);
  }
  const local = report ?? inspectFreshness({ root, policyPath });
  const checkedAt = now().toISOString();
  const resolvedRegistry = validateRegistry(registry);
  const options = {
    fetchImpl,
    timeoutMs,
    retries,
    retryDelayMs,
    registry: resolvedRegistry,
  };
  const releases = await mapLimit(local.packages, REMOTE_CONCURRENCY, (pkg) =>
    latestRelease(pkg.name, options),
  );
  const advisoryLookup = await latestAdvisories(local.packages, options);
  const [nodeUpstream, pnpmUpstream] = await Promise.all([
    inspectNodeUpstream({ fetchImpl, timeoutMs, retries, retryDelayMs, now, indexUrl: nodeIndexUrl }),
    inspectPnpmUpstream({
      registry: resolvedRegistry,
      selected: local.runtime.find((row) => row.name === 'pnpm')?.default ?? null,
      fetchImpl,
      timeoutMs,
      retries,
      retryDelayMs,
      now,
    }),
  ]);
  const runtime = local.runtime.map((row) => {
    const observed = row.installed ?? row.default ?? null;
    if (row.name === 'node' && nodeUpstream.state === 'available' && observed) {
      const major = Number(observed.split('.')[0]);
      const target = nodeUpstream.byMajor[major] ?? nodeUpstream.latestLts;
      const assessment = classifyRuntime(observed, target.version);
      return {
        ...row,
        remote: {
          state: 'available',
          latest: target.version,
          checkedAt: nodeUpstream.checkedAt,
          security: target.security,
          classification: assessment.classification,
          reason: assessment.reason,
        },
      };
    }
    if (row.name === 'pnpm' && pnpmUpstream.state === 'available') {
      return {
        ...row,
        remote: {
          state: 'available',
          latest: pnpmUpstream.latest,
          checkedAt: pnpmUpstream.checkedAt,
          classification:
            pnpmUpstream.relationship === 'ahead-of-latest-tag'
              ? 'current'
              : pnpmUpstream.relationship === 'latest-tag'
                ? 'current'
                : 'unknown',
          reason:
            pnpmUpstream.relationship === 'ahead-of-latest-tag'
              ? `${pnpmUpstream.selected} is newer than the npm latest tag ${pnpmUpstream.latest}; it is a published stable release, not a floating tag.`
              : pnpmUpstream.relationship === 'behind-latest-tag'
                ? `${pnpmUpstream.selected} is behind the npm latest tag ${pnpmUpstream.latest}.`
                : null,
        },
      };
    }
    return {
      ...row,
      remote: {
        state: 'unknown',
        latest: null,
        checkedAt: null,
        classification: 'unknown',
        reason:
          row.name === 'node' ? nodeUpstream.reason ?? 'No official Node release target was read.' : pnpmUpstream.reason ?? 'No official pnpm metadata was read.',
      },
    };
  });
  const packages = local.packages.map((pkg, index) => {
    const release = releases[index];
    const assessment = remoteAssessment(pkg, release, advisoryLookup.advisories);
    return {
      ...pkg,
      latestTested: pkg.reviewed ?? null,
      remote: {
        state: release.state,
        latest: release.state === 'available' ? release.version : null,
        publishedAt: release.state === 'available' ? release.publishedAt : null,
        deprecated: release.state === 'available' ? release.deprecated : null,
        engines: release.state === 'available' ? release.engines : null,
        classification: assessment.classification,
        reason: assessment.reason,
        latestQualified: assessment.latestQualified ?? null,
        advisory: assessment.advisory ?? null,
      },
    };
  });
  const counts = {
    current: 0,
    compatiblePatch: 0,
    featureOpportunity: 0,
    breakingMajor: 0,
    securityUrgent: 0,
    unsupported: 0,
    unknown: 0,
  };
  for (const pkg of packages) {
    switch (pkg.remote.classification) {
      case 'current': counts.current += 1; break;
      case 'compatible-patch': counts.compatiblePatch += 1; break;
      case 'feature-opportunity': counts.featureOpportunity += 1; break;
      case 'breaking-major': counts.breakingMajor += 1; break;
      case 'security-urgent': counts.securityUrgent += 1; break;
      case 'unsupported': counts.unsupported += 1; break;
      default: counts.unknown += 1; break;
    }
  }
  const runtimeUnsupported = runtime.filter((row) =>
    ['drift', 'unresolved', 'unknown'].includes(row.status),
  ).length;
  const upstreamUnknown =
    (nodeUpstream.state === 'unknown' ? 1 : 0) + (pnpmUpstream.state === 'unknown' ? 1 : 0);
  const unknown =
    counts.unknown + (advisoryLookup.state === 'unknown' ? 1 : 0) + upstreamUnknown;
  const status =
    counts.securityUrgent > 0
      ? 'security'
      : counts.unsupported + runtimeUnsupported > 0 || counts.breakingMajor > 0
        ? 'attention'
        : unknown > 0
          ? 'unknown'
          : 'ok';
  return {
    kind: 'app-composer.dependency-freshness',
    contract: 1,
    mode: 'remote',
    reviewed: local.reviewed,
    checkedAt,
    registry: resolvedRegistry,
    runtime,
    packages,
    upstream: { node: nodeUpstream, pnpm: pnpmUpstream },
    advisoryLookup: {
      state: advisoryLookup.state,
      reason: advisoryLookup.reason ?? null,
    },
    summary: {
      ...local.summary,
      ...counts,
      runtimeUnsupported,
      upstreamUnknown,
      advisoryUnknown: advisoryLookup.state === 'unknown' ? 1 : 0,
    },
    status,
  };
}

export function exitCodeFor(report) {
  if (report.mode === 'remote') return report.summary.securityUrgent > 0 ? 4 : 0;
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
    ...report.runtime.map((row) => ({
      name: row.name,
      declared: row.declared ?? '-',
      selectedDefault: row.default ?? '-',
      installed: row.installed ?? 'unobserved',
      supported: row.supported ?? '-',
      status: row.status,
      remote: row.remote ?? null,
    })),
    ...report.packages.map((row) => ({
      name: row.name,
      declared: row.declared ?? '-',
      selectedDefault: '-',
      installed: row.current ?? 'unresolved',
      supported: row.supported ?? '-',
      status: row.status,
      remote: row.remote ?? null,
    })),
  ];
  const nameWidth = Math.max(9, ...rows.map((row) => row.name.length));
  const declaredWidth = Math.max(8, ...rows.map((row) => String(row.declared).length));
  const defaultWidth = Math.max(7, ...rows.map((row) => String(row.selectedDefault).length));
  const currentWidth = Math.max(9, ...rows.map((row) => String(row.installed).length));
  const supportedWidth = Math.max(9, ...rows.map((row) => String(row.supported).length));
  const latestWidth = Math.max(7, ...rows.map((row) => String(row.remote?.latest ?? '-').length));
  const head = [
    `  ${pad('name', nameWidth)}  ${pad('declared', declaredWidth)}  ${pad('default', defaultWidth)}  ${pad('installed', currentWidth)}  ${pad('supported', supportedWidth)}`,
  ];
  if (report.mode === 'remote') head[0] += `  ${pad('upstream', latestWidth)}  signal`;
  else head[0] += '  status';
  const lines = report.mode === 'remote'
    ? [
        `Remote dependency freshness (registry ${report.registry}; checked ${report.checkedAt}; policy reviewed ${report.reviewed ?? 'unknown'})`,
        '',
        head[0],
      ]
    : [
        `Dependency freshness${report.reviewed ? ` (policy reviewed ${report.reviewed})` : ''}`,
        '',
        head[0],
      ];
  for (const row of rows) {
    let line = `  ${pad(row.name, nameWidth)}  ${pad(row.declared, declaredWidth)}  ${pad(row.selectedDefault, defaultWidth)}  ${pad(row.installed, currentWidth)}  ${pad(row.supported, supportedWidth)}`;
    if (report.mode === 'remote') line += `  ${pad(row.remote?.latest, latestWidth)}  ${row.remote?.classification ?? row.status}`;
    else line += `  ${row.status}`;
    lines.push(line);
  }
  if (report.mode === 'remote') {
    const summary = report.summary;
    lines.push(
      '',
      `Summary: ${summary.current} current, ${summary.compatiblePatch} patch, ${summary.featureOpportunity} feature, ${summary.breakingMajor} breaking, ${summary.securityUrgent} security, ${summary.unsupported} unsupported, ${summary.unknown} unknown`,
    );
    const upstream = report.upstream ?? {};
    if (upstream.node?.state === 'available') {
      lines.push(
        `Node target: ${upstream.node.latestLts.version} is the newest Active LTS (${upstream.node.latestLts.lts}), released ${upstream.node.latestLts.date}${upstream.node.latestLts.security ? ' as a security release' : ''}. This is an upstream target, not an automatically qualified version.`,
      );
    } else {
      lines.push(`Node target unknown: ${upstream.node?.reason ?? 'no lookup was performed'}`);
    }
    if (upstream.pnpm?.state === 'available') {
      lines.push(
        `pnpm release channel: npm latest is ${upstream.pnpm.latest ?? 'unknown'}${upstream.pnpm.next ? `, next-12 is ${upstream.pnpm.next}` : ''}; the selected ${upstream.pnpm.selected ?? 'version'} is ${upstream.pnpm.relationship.replaceAll('-', ' ')}.`,
      );
    } else {
      lines.push(`pnpm release channel unknown: ${upstream.pnpm?.reason ?? 'no lookup was performed'}`);
    }
    if (report.advisoryLookup.state === 'unknown') {
      lines.push(`Advisory coverage unknown: ${report.advisoryLookup.reason}`);
    }
    if (summary.securityUrgent > 0) {
      lines.push('Security advisories affect locked versions. Review and qualify a fix before changing production.');
    } else if (summary.unsupported > 0 || summary.runtimeUnsupported > 0) {
      lines.push('A locked dependency or runtime is outside the reviewed policy. Record the blocker or qualify an update.');
    } else if (summary.breakingMajor > 0) {
      lines.push('A new major is available. Plan compatibility work separately; do not float the pin.');
    } else {
      lines.push('No urgent change is indicated by this registry observation.');
    }
    return lines.join('\n');
  }
  const { ok, drift, unknown, unresolved, unobserved = 0 } = report.summary;
  lines.push('', `Summary: ${ok} ok, ${drift} drift, ${unknown} unknown, ${unresolved} unresolved, ${unobserved} unobserved`);
  lines.push('unobserved means the actual executable did not identify itself; the declared/default pin is shown but not claimed as installed.');
  if (unknown > 0) lines.push('Add the missing dependencies to config/dependency-policy.json after reviewing them.');
  if (drift > 0) lines.push('Review every drifted version against its release notes before moving the policy.');
  if (unresolved > 0) lines.push('A version could not be resolved; run pnpm install so node_modules matches the lockfile.');
  return lines.join('\n');
}

function parseInteger(value, label, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new FreshnessInputError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function parseArguments(argv) {
  const options = {
    json: false,
    root: repositoryRoot,
    policyPath: null,
    remote: false,
    registry: DEFAULT_REGISTRY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
    writePath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--remote') options.remote = true;
    else if (argument === '--root') options.root = resolve(argv[(index += 1)] ?? '');
    else if (argument === '--policy') options.policyPath = resolve(argv[(index += 1)] ?? '');
    else if (argument === '--registry') options.registry = argv[(index += 1)] ?? '';
    else if (argument === '--timeout') options.timeoutMs = parseInteger(argv[(index += 1)], 'Timeout', 100, MAX_TIMEOUT_MS);
    else if (argument === '--retries') options.retries = parseInteger(argv[(index += 1)], 'Retries', 0, MAX_RETRIES);
    else if (argument === '--write') options.writePath = resolve(argv[(index += 1)] ?? '');
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new FreshnessInputError(`Unknown argument: ${argument}`);
  }
  if (!options.remote && options.registry !== DEFAULT_REGISTRY) {
    throw new FreshnessInputError('--registry requires --remote.');
  }
  if (!options.remote && (options.timeoutMs !== DEFAULT_TIMEOUT_MS || options.retries !== DEFAULT_RETRIES)) {
    throw new FreshnessInputError('--timeout and --retries require --remote.');
  }
  return options;
}

export async function run(argv = process.argv.slice(2), write = (text) => process.stdout.write(`${text}\n`)) {
  const options = parseArguments(argv);
  if (options.help) {
    write(
      'Usage: node scripts/freshness.mjs [--json] [--root DIR] [--policy FILE] [--write FILE]\n' +
        '       node scripts/freshness.mjs --remote [--registry URL] [--timeout MS] [--retries N] [--json] [--write FILE]',
    );
    return 0;
  }
  const report = options.remote
    ? await inspectRemoteFreshness(options)
    : inspectFreshness(options);
  if (options.writePath) {
    try {
      writeFileSync(options.writePath, `${JSON.stringify(report, null, 2)}\n`);
    } catch (error) {
      throw new FreshnessInputError(`The report could not be written: ${error.message}`);
    }
  }
  write(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
  return exitCodeFor(report);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await run();
  } catch (error) {
    process.stderr.write(`${error instanceof FreshnessInputError ? 'Freshness input error' : 'Freshness error'}: ${error.message}\n`);
    process.exitCode = 3;
  }
}
