import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { promisify } from 'node:util';
import test from 'node:test';
import { classifyFreshAgentRun, isolationReport, summariseFreshAgentReceipts, validateFreshAgentCase } from '../src/lib/fresh-agent.ts';

const run = promisify(execFile);
const casesDir = new URL('../labs/fresh-agent/cases/', import.meta.url);
const guidesDir = new URL('../labs/fresh-agent/guides/', import.meta.url);
const fixturesDir = new URL('../labs/fresh-agent/fixtures/', import.meta.url);
const cases = readdirSync(casesDir).filter((name) => name.endsWith('.json')).sort()
  .map((name) => ({ name, value: JSON.parse(readFileSync(new URL(name, casesDir), 'utf8')) }));
const provenance = JSON.parse(readFileSync(new URL('provenance.json', guidesDir), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('every fresh-agent case is reproducible from committed, hash-pinned inputs', () => {
  assert.equal(cases.length, 5);
  assert.deepEqual(cases.map((entry) => entry.value.task).sort(), ['A', 'B', 'C', 'D', 'E']);
  for (const { name, value } of cases) {
    assert.deepEqual(validateFreshAgentCase(value), [], name);
    assert.equal(`${value.id}.json`, name);
    assert.ok(existsSync(new URL(`${value.fixture}/`, fixturesDir)), `${name} fixture exists`);
    if (value.export) {
      const guide = readFileSync(new URL(`${value.id}.md`, guidesDir));
      const captured = provenance.exports.find((entry) => entry.case === value.id && entry.kind === 'setup-guide');
      assert.ok(captured, `${name} has a capture receipt`);
      assert.equal(hash(guide), captured.sha256, `${name} guide bytes match the capture receipt`);
      assert.equal(guide.length, captured.bytes);
      const text = guide.toString('utf8');
      assert.match(text, /Guide: app-composer\.project-setup\/1/);
      assert.ok(text.includes(value.export.outcome), `${name} export contains the owner outcome`);
      assert.doesNotMatch(text, /Bearer\s+[A-Za-z0-9]/);
    }
    if (value.pack) {
      const pack = readFileSync(new URL(`${value.id}-pack.md`, guidesDir));
      const captured = provenance.exports.find((entry) => entry.case === value.id && entry.kind === 'role-pack');
      assert.equal(hash(pack), captured.sha256, `${name} pack bytes match the capture receipt`);
      assert.match(pack.toString('utf8'), /^# .+ role pack/);
    }
  }
  assert.match(provenance.note, /fictional|Nothing was deployed/i);
});

test('case assertions cannot escape the workspace or invent a second result channel', () => {
  for (const { value } of cases) {
    for (const assertion of value.assertions) {
      for (const key of ['path', 'pattern']) {
        const path = assertion[key];
        if (path) assert.ok(!path.startsWith('/') && !path.split('/').includes('..'), `${value.id} ${path}`);
      }
      if (value.task === 'D' && assertion.path === 'role-output.json') assert.equal(assertion.type, 'file-absent');
    }
  }
  assert.deepEqual(validateFreshAgentCase({ id: 'Bad Id', task: 'A', title: 'x', fixture: 'f', prompt: 'p', assertions: [{ type: 'file-exists', path: '/etc/passwd' }] }).sort(), ['unsafe id', 'unsafe path /etc/passwd']);
});

test('a session that could read the harness is contaminated, never a pass', () => {
  const repository = '/Users/example/gits/app-composer-lane-g-evaluation';
  const markers = [repository, 'labs/fresh-agent', 'eval-fresh-agent', 'scripts/roles.mjs'];
  const clean = isolationReport('I created site/app.py and ran the tests.', markers);
  assert.deepEqual(clean, { clean: true, hits: {} });
  const leaked = isolationReport(`$ pwd\n${repository}\n$ node scripts/eval-fresh-agent.mjs verify`, markers);
  assert.equal(leaked.clean, false);
  assert.equal(leaked.hits[repository], 1);
  assert.equal(leaked.hits['eval-fresh-agent'], 1);
  assert.equal(classifyFreshAgentRun({ passed: true, expectsDecision: false, isolation: leaked }), 'contaminated');
  assert.equal(classifyFreshAgentRun({ passed: true, expectsDecision: false, isolation: clean }), 'passed');
  assert.equal(classifyFreshAgentRun({ passed: true, expectsDecision: true, isolation: clean }), 'refused-as-expected');
  assert.equal(classifyFreshAgentRun({ passed: false, expectsDecision: false, isolation: clean }), 'failed');
});

test('receipt summaries stay bounded and ordered, and an unknown isolation state is not clean', () => {
  const rows = summariseFreshAgentReceipts([
    { case: 'b', task: 'B', outcome: 'passed', passed: 10, total: 10, durationMs: 1000, agent: 'opencode', model: 'm', isolation: { clean: true, hits: {} } },
    { case: 'a', task: 'A', outcome: 'passed', passed: 7, total: 7, durationMs: 2000, agent: 'opencode', model: 'm' },
  ]);
  assert.deepEqual(rows.map((row) => row.case), ['a', 'b']);
  assert.deepEqual(rows[0].isolation, { clean: false, hits: { unknown: 1 } });
});

test('fictional fixtures keep their intended baseline (python3 required)', { skip: !existsSync('/usr/bin/python3') && !existsSync('/opt/homebrew/bin/python3') }, async () => {
  const python = existsSync('/opt/homebrew/bin/python3') ? '/opt/homebrew/bin/python3' : 'python3';
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
  const existing = await run(python, ['-m', 'unittest', '-q'], { cwd: new URL('existing-notes/', fixturesDir), env }).then(() => 'pass', (error) => error);
  assert.equal(existing, 'pass', 'the owner-customised fixture passes its own checks');
  const interrupted = await run(python, ['-m', 'unittest', '-q'], { cwd: new URL('interrupted/', fixturesDir), env }).then(() => 'pass', (error) => error);
  assert.notEqual(interrupted, 'pass', 'the interrupted fixture is genuinely incomplete');
  assert.match(String(interrupted.stderr ?? ''), /FAILED \(errors=1\)/);
  assert.doesNotMatch(readFileSync(new URL('interrupted/app.py', fixturesDir), 'utf8'), /["']\/health["']/);
  assert.equal(readdirSync(new URL('blank-start/', fixturesDir)).includes('site'), false);
});

test('the role-pack runner still refuses the production QA bundle before rendering a brief', async () => {
  const refused = await run(process.execPath, ['scripts/roles.mjs', 'brief', '--role', 'qa', '--input', 'examples/role-packs/wrong-target-production.json'], { cwd: new URL('..', import.meta.url) })
    .then(() => 'allowed', (error) => error);
  assert.notEqual(refused, 'allowed');
  assert.equal(refused.code, 2);
  assert.match(refused.stderr, /Human action:/);
  assert.doesNotMatch(refused.stdout ?? '', /## Output/);
});

test('the documented local dev command generates source identity before Astro starts', () => {
  // src/lib/build.json is gitignored and imported by src/worker.ts. Without this
  // step a fresh clone exits with "Dev server process exited before becoming
  // ready", which is the first failure a new contributor meets.
  const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
  const dev = String(scripts.dev);
  assert.match(dev, /node scripts\/identity\.mjs/);
  assert.ok(dev.indexOf('scripts/identity.mjs') < dev.indexOf('astro dev'));
  assert.match(readFileSync(new URL('../src/worker.ts', import.meta.url), 'utf8'), /import build from '\.\/lib\/build\.json'/);
  assert.match(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'), /^src\/lib\/build\.json$/m);
});
