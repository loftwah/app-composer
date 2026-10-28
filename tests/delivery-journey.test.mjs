import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  assertCandidateSource,
  assertPreviewGenerated,
  assertReleaseSource,
  inspectPreviewIsolation,
  isReleaseEligible,
  previewBuildEnvironment,
  productionEnvironment,
  readSourceIdentity,
  receiptSchema,
  runDeliveryJourney,
} from '../scripts/delivery-journey.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'composition.lock.json'), 'utf8'));
const source = (changes = {}) => ({
  available: true,
  repository: 'loftwah/app-composer',
  branch: 'main',
  commit: 'a'.repeat(40),
  originCommit: 'a'.repeat(40),
  dirty: false,
  pushed: true,
  ...changes,
});

function generatedPreview() {
  const preview = config.env.preview;
  return {
    name: preview.name,
    account_id: config.account_id,
    vars: {...preview.vars},
    d1_databases: preview.d1_databases.map(({migrations_dir, ...binding}) => binding),
    r2_buckets: preview.r2_buckets.map(binding => ({...binding})),
    kv_namespaces: preview.kv_namespaces.map(binding => ({...binding})),
    services: [],
    routes: [],
    triggers: {crons: []},
  };
}

test('preview configuration and generated candidates refuse unqualified Queue or Workflow access', () => {
  for (const binding of [
    {queues: {producers: [{binding: 'OUTBOX', queue: 'production-outbox'}]}},
    {queues: {consumers: [{queue: 'production-outbox'}]}},
    {workflows: [{binding: 'RECOVERY', name: 'production-recovery', class_name: 'Recovery'}]},
  ]) {
    const selected = structuredClone(config);
    Object.assign(selected.env.preview, binding);
    assert.throws(() => inspectPreviewIsolation(selected), /Queue|Workflows/);
    assert.throws(() => assertPreviewGenerated({...generatedPreview(), ...binding}, config), /Queue|Workflows/);
  }
  assert.equal(inspectPreviewIsolation(config).isolated, true);
  assert.equal(assertPreviewGenerated(generatedPreview(), config).isolated, true);
});

function workspaceFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'composer-delivery-journey-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  copyFileSync(join(root, 'wrangler.jsonc'), join(directory, 'wrangler.jsonc'));
  copyFileSync(join(root, 'composition.lock.json'), join(directory, 'composition.lock.json'));
  mkdirSync(join(directory, '.wrangler', 'deploy'), {recursive: true});
  mkdirSync(join(directory, 'dist', 'server'), {recursive: true});
  writeFileSync(join(directory, '.wrangler', 'deploy', 'config.json'), JSON.stringify({configPath: '../../dist/server/wrangler.json'}));
  writeFileSync(join(directory, 'dist', 'server', 'wrangler.json'), JSON.stringify(generatedPreview()));
  return directory;
}

test('source identity distinguishes a clean pushed checkout from local or unpushed work', () => {
  const clean = readSourceIdentity({
    workspace: '/fictional',
    runGit: (_workspace, args) =>
      ({
        'rev-parse HEAD': 'a'.repeat(40),
        'branch --show-current': 'main',
        'status --porcelain': '',
        'rev-parse --verify origin/main': 'a'.repeat(40),
        'config --get remote.origin.url': 'git@github.com:loftwah/app-composer.git',
      })[args.join(' ')],
  });
  assert.equal(clean.dirty, false);
  assert.equal(clean.pushed, true);
  assert.equal(clean.repository, 'loftwah/app-composer');
  assert.equal(isReleaseEligible(clean), true);

  const changed = readSourceIdentity({
    workspace: '/fictional',
    runGit: (_workspace, args) =>
      ({
        'rev-parse HEAD': 'a'.repeat(40),
        'branch --show-current': 'main',
        'status --porcelain': ' M scripts/delivery-journey.mjs',
        'rev-parse --verify origin/main': 'b'.repeat(40),
        'config --get remote.origin.url': 'https://user:secret-token@github.com/loftwah/app-composer.git',
      })[args.join(' ')],
  });
  assert.equal(changed.dirty, true);
  assert.equal(changed.pushed, false);
  assert.equal(changed.repository, 'loftwah/app-composer');
  assert.equal(isReleaseEligible(changed), false);
  assert.doesNotMatch(JSON.stringify(changed), /secret-token/);

  const missing = readSourceIdentity({workspace: '/fictional', runGit: () => { throw new Error('no git'); }});
  assert.equal(missing.available, false);
  assert.equal(isReleaseEligible(missing), false);
});

test('the checked preview environment has isolated bindings and no app services', () => {
  const preview = inspectPreviewIsolation(config);
  assert.equal(preview.worker, 'app-composer-preview');
  assert.equal(preview.services, 0);
  assert.equal(preview.routes, 0);
  assert.equal(preview.crons, 0);
  assert.notEqual(preview.origin, config.vars.PUBLIC_ORIGIN);
  assert.notEqual(preview.d1[0].id, config.d1_databases[0].database_id);
  assert.notEqual(preview.r2[0].id, config.r2_buckets[0].bucket_name);
  assert.notEqual(preview.kv[0].id, config.kv_namespaces[0].id);
});

test('preview isolation refuses shared production resources, services, routes and origins', () => {
  const variants = [
    {env: {}},
    {env: {preview: {...config.env.preview, name: config.name}}},
    {env: {preview: {...config.env.preview, d1_databases: config.d1_databases}}},
    {env: {preview: {...config.env.preview, r2_buckets: config.r2_buckets}}},
    {env: {preview: {...config.env.preview, kv_namespaces: config.kv_namespaces}}},
    {env: {preview: {...config.env.preview, services: config.services}}},
    {env: {preview: {...config.env.preview, routes: config.routes}}},
    {env: {preview: {...config.env.preview, vars: {...config.vars}}}},
  ];
  for (const variant of variants) assert.throws(() => inspectPreviewIsolation({...config, ...variant}));
});

test('the generated worker must prove build-time preview selection and exact isolated bindings', () => {
  const generated = generatedPreview();
  assert.doesNotThrow(() => assertPreviewGenerated(generated, config));
  const mutations = [
    {name: config.name},
    {account_id: 'another-account'},
    {vars: {PUBLIC_ORIGIN: config.vars.PUBLIC_ORIGIN}},
    {d1_databases: config.d1_databases},
    {r2_buckets: config.r2_buckets},
    {kv_namespaces: config.kv_namespaces},
    {services: config.services},
    {routes: config.routes},
    {triggers: {crons: ['* * * * *']}},
  ];
  for (const mutation of mutations) assert.throws(() => assertPreviewGenerated({...generated, ...mutation}, config));
  const extra = {...generated, kv_namespaces: [...generated.kv_namespaces, {binding: 'EXTRA', id: 'another'}]};
  assert.throws(() => assertPreviewGenerated(extra, config));
});

test('dirty, detached and unpushed source is refused before candidate and release work', () => {
  assert.throws(() => assertCandidateSource(source({dirty: true})), /Commit or remove local changes/);
  assert.throws(() => assertCandidateSource(source({branch: null})), /Select a branch/);
  assert.throws(() => assertCandidateSource(source({originCommit: null, pushed: false})), /Push main/);
  assert.throws(() => assertCandidateSource(source({originCommit: 'b'.repeat(40), pushed: false})), /exact candidate commit/);
  assert.throws(() => assertReleaseSource(source({branch: 'feature'})), /clean pushed main/);
  assert.throws(() => assertReleaseSource(source({dirty: true})), /Commit or remove local changes/);
  assert.doesNotThrow(() => assertCandidateSource(source({branch: 'feature'})));
  assert.doesNotThrow(() => assertReleaseSource(source()));
  assert.equal(isReleaseEligible(source()), true);
  assert.equal(isReleaseEligible(source({branch: 'feature'})), false);
});

test('preview and production environments stay separate', () => {
  assert.equal(previewBuildEnvironment({HOME: '/tmp'}).CLOUDFLARE_ENV, 'preview');
  assert.doesNotThrow(() => productionEnvironment({HOME: '/tmp'}));
  assert.throws(() => productionEnvironment({CLOUDFLARE_ENV: 'preview'}), /Unset CLOUDFLARE_ENV/);
});

test('the default journey runs local checks only and has no release side effects', async t => {
  const workspace = workspaceFixture(t);
  const calls = [];
  const receipt = await runDeliveryJourney({
    workspace,
    mode: 'local',
    source: source(),
    environment: {},
    execute: async (command, args) => calls.push([command, ...args]),
    verify: async () => assert.fail('local checks must not verify or deploy live'),
  });
  assert.equal(receipt.state, 'passed');
  assert.deepEqual(calls, [['pnpm', 'check']]);
  assert.equal(receipt.release.performed, false);
  assert.equal(receipt.release.attempted, false);
  assert.equal(receipt.verification.performed, false);
  assert.equal(receipt.candidate, null);
  assert.equal(receipt.review.required, true);
  assert.match(receipt.nextAction, /--candidate/);
  assert.equal(receipt.source.releaseEligible, true);
});

test('a dirty local checkout still checks locally but is not release eligible', async t => {
  const workspace = workspaceFixture(t);
  const receipt = await runDeliveryJourney({
    workspace,
    mode: 'local',
    source: source({dirty: true}),
    environment: {},
    execute: async () => {},
    verify: async () => assert.fail('local checks must not verify live'),
  });
  assert.equal(receipt.state, 'passed');
  assert.equal(receipt.source.releaseEligible, false);
  assert.match(receipt.nextAction, /Commit and push/);
});

test('candidate mode builds the preview and records its exact isolated identity', async t => {
  const workspace = workspaceFixture(t);
  const calls = [];
  const receipt = await runDeliveryJourney({
    workspace,
    mode: 'candidate',
    source: source({branch: 'lane-h-delivery-20261024'}),
    environment: {HOME: '/tmp'},
    execute: async (command, args, options) => {
      calls.push([command, ...args, options.env.CLOUDFLARE_ENV ?? null]);
    },
    verify: async () => assert.fail('candidate must not verify or deploy live'),
  });
  assert.equal(receipt.state, 'passed');
  assert.deepEqual(calls, [
    ['pnpm', 'check', null],
    ['pnpm', 'build', 'preview'],
  ]);
  assert.equal(receipt.candidate.built, true);
  assert.equal(receipt.candidate.uploaded, false);
  assert.equal(receipt.candidate.versionUrlUsed, false);
  assert.equal(receipt.candidate.worker, config.env.preview.name);
  assert.match(receipt.candidate.digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(receipt.release.performed, false);
  assert.match(receipt.nextAction, /not release approval/);
});

test('dirty and wrongly sourced release attempts are refused before any command', async t => {
  const workspace = workspaceFixture(t);
  const scenarios = [
    [source({dirty: true}), 'dirty-source'],
    [source({branch: 'feature'}), 'wrong-branch'],
    [source({originCommit: 'b'.repeat(40), pushed: false}), 'unpushed-source'],
  ];
  for (const [selected, code] of scenarios) {
    let calls = 0;
    const receipt = await runDeliveryJourney({
      workspace,
      mode: 'release',
      source: selected,
      environment: {},
      execute: async () => calls++,
      verify: async () => calls++,
    });
    assert.equal(receipt.state, 'refused');
    assert.equal(receipt.error.code, code);
    assert.equal(calls, 0, `${code} must not run a command`);
    assert.equal(receipt.release.performed, false);
    assert.equal(receipt.release.attempted, false);
    assert.match(receipt.nextAction, /No upload occurred/);
  }
});

test('release refuses an ambient Cloudflare environment before building or deploying', async t => {
  const workspace = workspaceFixture(t);
  let calls = 0;
  const receipt = await runDeliveryJourney({
    workspace,
    mode: 'release',
    source: source(),
    environment: {CLOUDFLARE_ENV: 'preview'},
    execute: async () => calls++,
    verify: async () => calls++,
  });
  assert.equal(receipt.state, 'refused');
  assert.equal(receipt.error.code, 'cloudflare-environment-selected');
  assert.equal(calls, 0);
});

test('an explicitly authorised release reuses the guarded deploy and independent verifier', async t => {
  const workspace = workspaceFixture(t);
  const calls = [];
  const verified = [];
  const receipt = await runDeliveryJourney({
    workspace,
    mode: 'release',
    source: source(),
    environment: {HOME: '/tmp'},
    execute: async (command, args, options) => calls.push([command, ...args, options.env.CLOUDFLARE_ENV ?? null]),
    verify: async (...args) => verified.push(args),
  });
  assert.equal(receipt.state, 'passed');
  assert.deepEqual(calls, [['pnpm', 'deploy', null]]);
  assert.deepEqual(verified, [[source().commit, lock, config.vars.PUBLIC_ORIGIN]]);
  assert.equal(receipt.release.attempted, true);
  assert.equal(receipt.release.performed, true);
  assert.equal(receipt.release.command, 'pnpm deploy');
  assert.equal(receipt.release.commit, source().commit);
  assert.match(receipt.release.checks, /pnpm check and pnpm build run inside the guarded deploy/);
  assert.equal(receipt.verification.performed, true);
  assert.equal(receipt.verification.independent, true);
  assert.equal(receipt.approval.flag, '--release');
  assert.equal(receipt.approval.sourceCommit, source().commit);
  assert.equal(receipt.candidate, null);
  assert.equal(receipt.approval.candidateDigest, null);
});

test('the receipt has a bounded, explicit source, target and release identity', async t => {
  const workspace = workspaceFixture(t);
  const receipt = await runDeliveryJourney({
    workspace,
    mode: 'release',
    source: source(),
    environment: {},
    execute: async () => {},
    verify: async () => {},
  });
  assert.equal(receipt.schema, receiptSchema);
  assert.equal(receipt.mode, 'release');
  assert.equal(receipt.source.repository, 'loftwah/app-composer');
  assert.equal(receipt.source.branch, 'main');
  assert.equal(receipt.source.commit, source().commit);
  assert.equal(receipt.source.dirty, false);
  assert.equal(receipt.source.pushed, true);
  assert.equal(receipt.target.worker, config.name);
  assert.equal(receipt.target.account, config.account_id);
  assert.equal(receipt.target.environment, 'production');
  assert.equal(receipt.target.origin, config.vars.PUBLIC_ORIGIN);
  assert.equal(receipt.target.composition.id, lock.id);
  assert.deepEqual(
    receipt.target.composition.apps.map(app => [app.id, app.commit]),
    lock.apps.map(app => [app.id, app.commit]),
  );
  assert.match(receipt.finishedAt, /^\d{4}-\d{2}-\d{2}T/);
  const serialised = JSON.stringify(receipt);
  assert.ok(serialised.length < 20000, 'receipt stays bounded');
  assert.doesNotMatch(serialised, /OWNER_API_TOKEN|EMDASH_ENCRYPTION_KEY|GUESTBOOK_OWNER_TOKEN|SHOWCASE_OWNER_TOKEN/);
});

test('a failed release attempt stays ambiguous and is never reported as verified', async t => {
  const workspace = workspaceFixture(t);
  const calls = [];
  const receipt = await runDeliveryJourney({
    workspace,
    mode: 'release',
    source: source(),
    environment: {},
    execute: async (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === 'deploy') throw Object.assign(new Error('fictional deploy failure'), {code: 'command-failed'});
    },
    verify: async () => assert.fail('a failed deploy must not claim verification'),
  });
  assert.deepEqual(calls, [['pnpm', 'deploy']]);
  assert.equal(receipt.state, 'failed');
  assert.equal(receipt.release.attempted, true);
  assert.equal(receipt.release.performed, false);
  assert.equal(receipt.release.failed, true);
  assert.equal(receipt.verification.performed, false);
  assert.match(receipt.nextAction, /attempted/);
  assert.match(receipt.nextAction, /ambiguous/);
});

test('a failed candidate build is reported as failed and never as a candidate', async t => {
  const workspace = workspaceFixture(t);
  const receipt = await runDeliveryJourney({
    workspace,
    mode: 'candidate',
    source: source({branch: 'feature'}),
    environment: {},
    execute: async (command, args) => {
      if (args[0] === 'build') throw Object.assign(new Error('fictional build failure'), {code: 'command-failed'});
    },
    verify: async () => assert.fail('candidate must not verify live'),
  });
  assert.equal(receipt.state, 'failed');
  assert.equal(receipt.candidate, null);
  assert.equal(receipt.release.performed, false);
  assert.match(receipt.nextAction, /Nothing was uploaded/);
});
