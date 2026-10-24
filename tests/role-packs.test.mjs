import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import {
  buildRoleBrief,
  getRolePack,
  renderRolePack,
  renderRolePrompt,
  rolePackIds,
  rolePackReviewed,
  rolePackSuite,
  rolePacks,
  validateRolePacks,
  RolePackError,
} from '../src/lib/role-packs.ts';
import { packageRolePacks } from '../scripts/package-roles.mjs';

const root = resolve('.');
const examplePath = join(root, 'examples/role-packs/fictional-trail-notes.json');
const example = JSON.parse(readFileSync(examplePath, 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function run(args, options = {}) {
  const result = spawnSync(process.execPath, ['scripts/roles.mjs', ...args], { cwd: root, encoding: 'utf8', ...options });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
function variant(mutate) {
  const copy = structuredClone(example);
  mutate(copy);
  return copy;
}
function writeTemp(directory, name, value) {
  const path = join(directory, name);
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

test('six role packs are complete, versioned job contracts rather than personas', () => {
  assert.deepEqual(validateRolePacks(), []);
  assert.deepEqual(rolePacks.map((pack) => pack.id), rolePackIds);
  assert.equal(rolePackSuite, 'composer.role-packs/1');
  assert.equal(rolePackReviewed, '2026-10-24');
  for (const pack of rolePacks) {
    assert.equal(getRolePack(pack.id), pack);
    assert.match(pack.version, /^\d+\.\d+\.\d+$/);
    assert.ok(pack.purpose.length < 320, `${pack.id}: purpose is not a persona essay`);
    assert.ok(pack.job.length > 80, `${pack.id}: job is not concrete`);
    assert.ok(pack.inputs.filter((input) => input.required).length >= 3, `${pack.id}: inputs are not required`);
    assert.ok(pack.output.length >= 6);
    assert.ok(pack.stops.some((stop) => /Production|production/.test(stop)) || ['architect', 'service-owner', 'security'].includes(pack.id));
    assert.ok(pack.prohibited.some((line) => /approve its own action|self-approve/i.test(line)), `${pack.id}: self-approval boundary missing`);
    assert.ok(pack.prohibited.some((line) => /deploy|change access|spend/i.test(line)), `${pack.id}: privilege boundary missing`);
    assert.match(pack.worked.measured, /\d/);
    assert.ok(pack.negativeTests.length >= 4);
    assert.ok(pack.related.length >= 2);
  }
});

test('downloads and prompt text are deterministic and generated from the maintained packs', () => {
  const before = new Map();
  for (const pack of rolePacks) {
    before.set(`${pack.id}.md`, readFileSync(join(root, 'public/roles/v1', `${pack.id}.md`)));
    before.set(`${pack.id}.txt`, readFileSync(join(root, 'public/roles/v1/prompts', `${pack.id}.txt`)));
  }
  before.set('role-packs.zip', readFileSync(join(root, 'public/roles/v1/role-packs.zip')));
  const metadata = packageRolePacks();
  assert.equal(metadata.version, rolePackSuite);
  assert.equal(metadata.packs.length, 6);
  assert.deepEqual(metadata.packs.map((pack) => pack.id), [...rolePackIds]);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'public/roles/v1/manifest.json'), 'utf8')), metadata);
  for (const pack of rolePacks) {
    const markdown = renderRolePack(pack.id);
    assert.equal(markdown, readFileSync(join(root, 'public/roles/v1', `${pack.id}.md`), 'utf8'));
    assert.equal(before.get(`${pack.id}.md`).toString(), markdown);
    assert.equal(renderRolePrompt(pack.id).trim(), readFileSync(join(root, 'public/roles/v1/prompts', `${pack.id}.txt`), 'utf8').trim());
    assert.equal(before.get(`${pack.id}.txt`).toString(), renderRolePrompt(pack.id));
    for (const heading of ['## Job', '## Inputs', '## Evidence you must cite', '## Method', '## Output', '## Stop and escalate', '## Prohibited', '## Negative tests', '## Worked fictional example', '## Prompt for a local agent']) {
      assert.ok(markdown.includes(heading), `${pack.id}: missing ${heading}`);
    }
    assert.ok(markdown.includes(pack.worked.measured));
  }
  const archive = readFileSync(join(root, 'public/roles/v1/role-packs.zip'));
  assert.deepEqual(archive, before.get('role-packs.zip'));
  assert.equal(sha(archive), metadata.sha256);
  assert.equal(readFileSync(join(root, 'public/roles/v1/examples/fictional-trail-notes.json'), 'utf8'), readFileSync(examplePath, 'utf8'));
  const members = new Map();
  for (let position = 0; archive.readUInt32LE(position) === 0x04034b50;) {
    const method = archive.readUInt16LE(position + 8);
    const size = archive.readUInt32LE(position + 18);
    const nameLength = archive.readUInt16LE(position + 26);
    const extraLength = archive.readUInt16LE(position + 28);
    const name = archive.subarray(position + 30, position + 30 + nameLength).toString();
    const start = position + 30 + nameLength + extraLength;
    const data = archive.subarray(start, start + size);
    assert.doesNotMatch(name, /(^\/|\.\.|\\)/);
    assert.ok(!members.has(name));
    members.set(name, method === 8 ? inflateRawSync(data) : data);
    position = start + size;
  }
  assert.equal(members.size, metadata.files.length);
  for (const file of metadata.files) assert.equal(sha(members.get(file.name)), file.sha256);
  assert.ok(members.has('INDEX.md'));
  for (const pack of rolePacks) {
    assert.equal(members.get(`${pack.id}.md`).toString(), renderRolePack(pack.id));
    assert.equal(members.get(`prompts/${pack.id}.txt`).toString(), renderRolePrompt(pack.id));
  }
});

test('every pack assembles the same evidence into a distinct, useful brief', () => {
  const expected = {
    'service-owner': ['**Decision: HOLD**', 'Ada Nguyen', 'Sam Okafor', 'G3'],
    programmer: ['Defect brief TL-142', 'src/postcards/approve.ts:42', 'regression test', 'draft'],
    architect: ['Proposed decision', '```mermaid', 'graph TD', 'Reversal'],
    devops: ['Isolation: FAILED', 'db-postcards-prod', 'Rollback', '0 provider writes'],
    security: ['Release: BLOCKED', 'sec-01', 'DEV_BYPASS=1', 'owner console'],
    qa: ['Verdict: BLOCKED', '3/3 failed', 'Coverage gaps', 'Release blocker'],
  };
  for (const pack of rolePacks) {
    const result = run(['brief', '--role', pack.id, '--input', 'examples/role-packs/fictional-trail-notes.json']);
    assert.ok([0, 3].includes(result.status), `${pack.id} exited ${result.status}: ${result.stderr}`);
    assert.ok(result.stdout.startsWith(`# ${pack.label} review brief`));
    assert.ok(result.stdout.includes('Proposal only'));
    assert.ok(result.stdout.includes('## Evidence to cite (7 items)'));
    for (const id of ['ev-01', 'ev-02', 'ev-03', 'ev-04', 'ev-05', 'ev-06', 'ev-07']) assert.ok(result.stdout.includes(id), `${pack.id}: missing ${id}`);
    for (const marker of expected[pack.id]) assert.ok(result.stdout.includes(marker), `${pack.id}: missing ${marker}`);
    assert.ok(result.stderr.includes('Proposal only'));
    const json = run(['brief', '--role', pack.id, '--input', 'examples/role-packs/fictional-trail-notes.json', '--json']);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.meta.role, pack.id);
    assert.equal(parsed.meta.evidenceCount, 7);
    assert.equal(parsed.meta.fictional, true);
    assert.ok(parsed.meta.stops.length >= 4);
    assert.equal(json.status, result.status);
  }
});

test('unsafe and incomplete input is refused with a human action, before a brief exists', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'composer-roles-test-'));
  try {
    const pathFor = (name, mutate) => writeTemp(temporary, name, variant(mutate));
    const cases = [
      ['examples/role-packs/unsafe-self-approval.json', 'programmer', /self-approval/i, /separate accountable human/i],
      ['examples/role-packs/unsafe-secret.json', 'programmer', /secret-like-value/i, /rotate/i],
      ['examples/role-packs/wrong-target-production.json', 'programmer', /production-target/i, /Preview or local/i],
      [pathFor('owner-missing.json', (bundle) => { delete bundle.workspace.owner.name; }), 'qa', /bundle-incomplete/i, /Do not invent/i],
      [pathFor('stale.json', (bundle) => { bundle.evidence.forEach((item) => { item.observedAt = '2026-10-20T00:00:00Z'; }); }), 'devops', /stale-evidence/i, /Refresh/i],
      [pathFor('wrong-env.json', (bundle) => { bundle.evidence[2].environment = 'env-production'; }), 'programmer', /wrong-environment/i, /selected environment/i],
      [pathFor('no-gates.json', (bundle) => { delete bundle.gates; }), 'qa', /missing-gates/i, /not a pass/i],
      [pathFor('no-deps.json', (bundle) => { bundle.dependencies = []; }), 'architect', /missing-dependencies/i, /observed edges/i],
      [pathFor('no-access.json', (bundle) => { delete bundle.security; }), 'security', /missing-access/i, /access paths/i],
      [pathFor('no-impact.json', (bundle) => { delete bundle.signals.impact; }), 'service-owner', /missing-service-evidence/i, /signals.impact/i],
    ];
    for (const [input, role, message, action] of cases) {
      const result = run(['brief', '--role', role, '--input', input]);
      assert.equal(result.status, 2, `${input} was not refused: ${result.stdout}`);
      assert.match(result.stderr, message);
      assert.match(result.stderr, /Human action:/);
      assert.match(result.stderr, action);
      assert.equal(result.stdout, '');
    }
    for (const args of [
      ['brief', '--role', 'unknown', '--input', 'examples/role-packs/fictional-trail-notes.json'],
      ['brief', '--role', '../private', '--input', 'examples/role-packs/fictional-trail-notes.json'],
      ['brief', '--role', 'qa', '--input', 'examples/role-packs/missing.json'],
      ['brief', '--role', 'qa'],
      ['nonsense'],
    ]) {
      const result = run(args);
      assert.equal(result.status, 2, `${args.join(' ')} exited ${result.status}`);
      assert.match(result.stderr, /Refused \(/);
      assert.match(result.stderr, /Human action:/);
    }
    const secret = run(['brief', '--role', 'programmer', '--input', 'unsafe-secret.json']);
    assert.doesNotMatch(secret.stderr, /example.invalid.token.value/, 'a refused brief must not echo the secret');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('approval cannot be forged by the requesting agent and blocked work exits non-zero', () => {
  const self = run(['brief', '--role', 'qa', '--input', 'examples/role-packs/unsafe-self-approval.json']);
  assert.equal(self.status, 2);
  assert.match(self.stderr, /agent cannot approve/i);
  const direct = variant((bundle) => { bundle.change.approvedBy = 'Ada Nguyen'; bundle.change.approvedByKind = 'human'; });
  const brief = buildRoleBrief('architect', direct);
  assert.equal(brief.markdown.includes('accepted by Ada Nguyen'), false, 'a recorded approval is not an acceptance by this runner');
  assert.match(brief.markdown, /proposed until the named owners accept/i);
  assert.throws(() => buildRoleBrief('service-owner', variant((bundle) => { bundle.change.approvedBy = bundle.change.requestedBy; })), RolePackError);
  assert.throws(() => buildRoleBrief('__proto__', example), RolePackError);
  const blocked = run(['brief', '--role', 'devops', '--input', 'examples/role-packs/fictional-trail-notes.json']);
  assert.equal(blocked.status, 3);
  assert.match(blocked.stderr, /blocking stop/i);
});

test('the runner writes an explicit brief only when asked, and never mutates the bundle', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'composer-roles-write-'));
  try {
    const target = join(temporary, 'programmer-brief.md');
    const before = readFileSync(examplePath);
    const result = run(['brief', '--role', 'programmer', '--input', 'examples/role-packs/fictional-trail-notes.json', '--out', target]);
    assert.equal(result.status, 0);
    assert.ok(existsSync(target));
    assert.ok(readFileSync(target, 'utf8').includes('Defect brief TL-142'));
    assert.deepEqual(readFileSync(examplePath), before);
    assert.match(result.stdout, /Decision: proposal/);
    assert.match(result.stdout, /Evidence: 7/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('the committed captures are real phone and desktop renders with matching provenance', () => {
  const provenance = JSON.parse(readFileSync(join(root, 'docs/images/role-packs-20261024.json'), 'utf8'));
  assert.equal(provenance.captures.length, 6);
  const widths = new Set(provenance.captures.map((capture) => capture.viewport.width));
  assert.deepEqual([...widths].sort((a, b) => a - b), [390, 1440]);
  for (const capture of provenance.captures) {
    const bytes = readFileSync(join(root, 'docs/images', capture.name));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), capture.viewport.width);
    assert.equal(bytes.readUInt32BE(20), capture.viewport.height);
    assert.equal(sha(bytes), capture.sha256);
    assert.ok(capture.path.startsWith('/roles'));
    assert.match(capture.theme, /^(dark|light)$/);
  }
  const paths = provenance.captures.map((capture) => capture.path);
  assert.ok(paths.includes('/roles'));
  assert.ok(paths.includes('/roles/qa'));
  assert.ok(paths.includes('/roles/service-owner'));
  const doc = readFileSync(join(root, 'docs/role-packs.md'), 'utf8');
  for (const capture of provenance.captures) assert.ok(doc.includes(capture.name), `docs missing ${capture.name}`);
});

test('roles are linked from the prompt desk, runbooks, role discovery, owner admin and public routes', () => {
  const pages = [
    ['src/pages/roles.astro', /rolePacks\.map/, /Download all six/, /refus/i],
    ['src/pages/roles/[id].astro', /Astro\.response\.status = 404/, /renderRolePrompt/, /buildRoleBrief/, /Proposal only/],
    ['src/pages/prompts.astro', /href="\/roles"/, /role packs/i],
    ['src/components/ResourceDesk.astro', /href="\/roles"/],
    ['src/components/RoleDiscovery.astro', /href="\/roles"/, /versioned role pack/i],
    ['src/pages/manage.astro', /href="\/roles"/, /acceptance stays with the accountable human/i],
    ['src/layouts/Base.astro', /href="\/roles">Agent role packs/],
  ];
  for (const [path, ...patterns] of pages) {
    const source = readFileSync(join(root, path), 'utf8');
    for (const pattern of patterns) assert.match(source, pattern, `${path} is missing ${pattern}`);
  }
  const publicPages = readFileSync(join(root, 'src/lib/public-pages.mjs'), 'utf8');
  for (const path of ['/roles', ...rolePackIds.map((id) => `/roles/${id}`)]) assert.ok(publicPages.includes(`'${path}'`), `sitemap missing ${path}`);
  const index = readFileSync(join(root, 'public/roles/v1/INDEX.md'), 'utf8');
  for (const pack of rolePacks) assert.ok(index.includes(`${pack.id}.md`));
  assert.ok(existsSync(join(root, 'docs/role-packs.md')));
});
