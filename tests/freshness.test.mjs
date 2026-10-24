import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  exitCodeFor,
  formatReport,
  inspectFreshness,
  parseVersion,
  readLockfileImporter,
  satisfies,
  FreshnessInputError,
} from '../scripts/freshness.mjs';

const repository = resolve(import.meta.dirname, '..');
const script = join(repository, 'scripts/freshness.mjs');

const lockfile = `---
lockfileVersion: '9.0'

importers:

  .:
    configDependencies: {}
    packageManagerDependencies:
      pnpm:
        specifier: 12.8.1
        version: 12.8.1

packages:

  '@pnpm/exe.darwin-arm64@12.8.1':
    resolution: {integrity: sha512-fictional}

---
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  .:
    dependencies:
      astro:
        specifier: 7.4.2
        version: 7.4.2(@types/node@26.6.5)(esbuild@0.28.2)
      '@emdash-cms/cloudflare':
        specifier: 1.3.1
        version: 1.3.1(089f9373a419bc858c7897bc0947b8be)
    devDependencies:
      wrangler:
        specifier: 4.152.0
        version: 4.152.0(@cloudflare/workers-types@5.20261024.1)

packages:
`;

function fixture({ manifest, policy, installed = {} }) {
  const root = mkdtempSync(join(tmpdir(), 'composer-freshness-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'pnpm-lock.yaml'), lockfile);
  mkdirSync(join(root, 'config'));
  writeFileSync(join(root, 'config', 'dependency-policy.json'), JSON.stringify(policy));
  for (const [name, version] of Object.entries(installed)) {
    mkdirSync(join(root, 'node_modules', name), { recursive: true });
    writeFileSync(join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
  }
  return root;
}

const baseManifest = {
  packageManager: 'pnpm@12.8.1',
  dependencies: { astro: '7.4.2', '@emdash-cms/cloudflare': '1.3.1' },
  devDependencies: { wrangler: '4.152.0' },
};
const basePolicy = {
  contract: 1,
  reviewed: '2026-10-24',
  // Fixture reports must not depend on the Node running the tests; runtime
  // drift has its own test below.
  runtime: { node: '*', pnpm: '12.8.1' },
  packages: {
    astro: { supported: '^7.4.2', reviewed: '7.4.2' },
    '@emdash-cms/cloudflare': { supported: '^1.3.1', reviewed: '1.3.1' },
    wrangler: { supported: '^4.152.0', reviewed: '4.152.0' },
  },
};

test('supported ranges use npm semantics and refuse syntax they cannot read', () => {
  assert.deepEqual(parseVersion('v7.4.2-rc.1'), { major: 7, minor: 4, patch: 2 });
  assert.throws(() => parseVersion('7.4'), FreshnessInputError);
  assert.equal(satisfies('7.4.2', '^7.4.2'), true);
  assert.equal(satisfies('7.9.0', '^7.4.2'), true);
  assert.equal(satisfies('8.0.0', '^7.4.2'), false);
  assert.equal(satisfies('0.9.12', '^0.9.12'), true);
  assert.equal(satisfies('0.10.0', '^0.9.12'), false);
  assert.equal(satisfies('7.4.9', '~7.4.2'), true);
  assert.equal(satisfies('7.5.0', '~7.4.2'), false);
  assert.equal(satisfies('22.23.4', '>=22.23.4 <23'), true);
  assert.equal(satisfies('22.9.0', '>=22.23.4 <23'), false);
  assert.equal(satisfies('23.0.0', '>=22.23.4 <23'), false);
  assert.equal(satisfies('19.3.1', '^19.3.1 || ^20.0.0'), true);
  assert.equal(satisfies('20.4.0', '^19.3.1 || ^20.0.0'), true);
  assert.equal(satisfies('21.0.0', '^19.3.1 || ^20.0.0'), false);
  assert.equal(satisfies('7.4.2', '7.4.2'), true);
  assert.equal(satisfies('7.4.3', '7.4.2'), false);
  assert.throws(() => satisfies('7.4.2', 'latest'), FreshnessInputError);
  assert.throws(() => satisfies('7.4.2', '<=7'), FreshnessInputError);
  assert.throws(() => satisfies('7.4.2', ''), FreshnessInputError);
});

test('the project importer is read past the tooling document, quoted names and peer suffixes', () => {
  const importer = readLockfileImporter(lockfile);
  assert.deepEqual(importer.get('astro'), { section: 'dependencies', specifier: '7.4.2', version: '7.4.2' });
  assert.deepEqual(importer.get('@emdash-cms/cloudflare'), {
    section: 'dependencies',
    specifier: '1.3.1',
    version: '1.3.1',
  });
  assert.deepEqual(importer.get('wrangler'), { section: 'devDependencies', specifier: '4.152.0', version: '4.152.0' });
  assert.equal(importer.has('pnpm'), false);
  assert.throws(() => readLockfileImporter('lockfileVersion: 9.0\n'), FreshnessInputError);
});

test('a covered and satisfied stack reports ok and exits zero', () => {
  const root = fixture({ manifest: baseManifest, policy: basePolicy });
  try {
    const report = inspectFreshness({ root });
    assert.equal(report.kind, 'app-composer.dependency-freshness');
    assert.equal(report.status, 'ok');
    assert.deepEqual(report.summary, { ok: 5, drift: 0, unknown: 0, unresolved: 0 });
    assert.equal(report.packages.find((row) => row.name === 'astro').current, '7.4.2');
    assert.equal(exitCodeFor(report), 0);
    assert.match(formatReport(report), /Summary: 5 ok, 0 drift, 0 unknown, 0 unresolved/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an installed version outside its supported range reports drift and exits one', () => {
  const root = fixture({ manifest: baseManifest, policy: basePolicy, installed: { astro: '8.0.0' } });
  try {
    const report = inspectFreshness({ root });
    assert.equal(report.packages.find((row) => row.name === 'astro').status, 'drift');
    assert.equal(report.status, 'drift');
    assert.equal(exitCodeFor(report), 1);
    assert.match(formatReport(report), /Review every drifted version/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a declared dependency with no policy entry is unknown and exits two', () => {
  const root = fixture({
    manifest: { ...baseManifest, dependencies: { ...baseManifest.dependencies, jose: '6.2.13' } },
    policy: basePolicy,
  });
  try {
    const report = inspectFreshness({ root });
    assert.equal(report.packages.find((row) => row.name === 'jose').status, 'unknown');
    assert.equal(report.status, 'unknown');
    assert.equal(exitCodeFor(report), 2);
    assert.match(formatReport(report), /Add the missing dependencies/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an unsupported runtime is reported as drift rather than ignored', () => {
  const root = fixture({ manifest: baseManifest, policy: { ...basePolicy, runtime: { node: '>=0.0.1 <0.0.2', pnpm: '12.8.1' } } });
  try {
    const report = inspectFreshness({ root });
    assert.equal(report.runtime.find((row) => row.name === 'node').status, 'drift');
    assert.equal(exitCodeFor(report), 1);
    assert.match(formatReport(report), /Review every drifted version/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an unresolvable version is reported instead of assumed', () => {
  const root = fixture({
    manifest: { dependencies: { astro: '7.4.2' } },
    policy: { ...basePolicy, runtime: {}, packages: { astro: basePolicy.packages.astro } },
  });
  try {
    // The lockfile resolves astro, so the covered case stays ok even without node_modules.
    assert.equal(inspectFreshness({ root }).packages[0].status, 'ok');
    // Remove the only record of the version: neither node_modules nor the lockfile has it.
    writeFileSync(
      join(root, 'pnpm-lock.yaml'),
      lockfile.replace(
        /^      astro:$[\s\S]*?^        version: 7\.4\.2.*$/m,
        '      astro:\n        specifier: 7.4.2',
      ),
    );
    const unresolved = inspectFreshness({ root });
    assert.equal(unresolved.packages[0].status, 'unresolved');
    assert.equal(unresolved.summary.unresolved, 1);
    assert.equal(exitCodeFor(unresolved), 1);
    assert.match(formatReport(unresolved), /could not be resolved/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an unreadable policy or unsupported contract is an input error', () => {
  const root = fixture({ manifest: baseManifest, policy: basePolicy });
  try {
    writeFileSync(join(root, 'config', 'dependency-policy.json'), '{not json');
    assert.throws(() => inspectFreshness({ root }), FreshnessInputError);
    writeFileSync(join(root, 'config', 'dependency-policy.json'), JSON.stringify({ ...basePolicy, contract: 2 }));
    assert.throws(() => inspectFreshness({ root }), FreshnessInputError);
    writeFileSync(join(root, 'config', 'dependency-policy.json'), JSON.stringify({ ...basePolicy, packages: {} }));
    const uncovered = inspectFreshness({ root });
    assert.equal(uncovered.summary.unknown, 3);
    assert.equal(exitCodeFor(uncovered), 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the CLI returns the documented exit codes and emits JSON on request', () => {
  const run = (root, extra = []) => {
    try {
      return { status: 0, stdout: execFileSync(process.execPath, [script, '--root', root, ...extra], { encoding: 'utf8' }) };
    } catch (error) {
      return { status: error.status, stdout: error.stdout ?? '' };
    }
  };
  const ok = fixture({ manifest: baseManifest, policy: basePolicy });
  const drift = fixture({ manifest: baseManifest, policy: basePolicy, installed: { astro: '8.0.0' } });
  const unknown = fixture({
    manifest: { ...baseManifest, dependencies: { ...baseManifest.dependencies, jose: '6.2.13' } },
    policy: basePolicy,
  });
  try {
    assert.equal(run(ok).status, 0);
    const json = JSON.parse(run(ok, ['--json']).stdout);
    assert.equal(json.contract, 1);
    assert.equal(json.status, 'ok');
    assert.equal(run(drift).status, 1);
    assert.equal(run(unknown).status, 2);
    assert.equal(run(ok, ['--policy', join(ok, 'missing.json')]).status, 3);
    assert.equal(run(ok, ['--unknown-flag']).status, 3);
  } finally {
    for (const root of [ok, drift, unknown]) rmSync(root, { recursive: true, force: true });
  }
});

test('the committed policy covers every declared dependency and the committed lockfile', () => {
  const report = inspectFreshness({ root: repository });
  assert.deepEqual(
    report.packages.filter((row) => row.status !== 'ok').map((row) => `${row.name}:${row.status}`),
    [],
  );
  assert.equal(report.summary.unknown, 0);
  assert.equal(report.summary.unresolved, 0);
  // The runtime row reports the Node actually running the command, so it is
  // only expected to be ok on a supported runtime. The package rows above are
  // the invariant this test protects.
  assert.deepEqual(
    report.runtime.map((row) => row.name),
    ['node', 'pnpm'],
  );
  if (report.runtime.every((row) => row.status === 'ok')) {
    assert.equal(exitCodeFor(report), 0);
  } else {
    assert.equal(exitCodeFor(report), 1, 'an unsupported runtime must be reported as drift');
  }
});

test('the command stays local: no network, no child process and no environment credentials', () => {
  const source = readFileSync(script, 'utf8');
  for (const forbidden of [
    "from 'node:http'",
    "from 'node:https'",
    "from 'node:child_process'",
    'fetch(',
    'process.env',
  ]) {
    assert.equal(source.includes(forbidden), false, `freshness.mjs must not use ${forbidden}`);
  }
});
