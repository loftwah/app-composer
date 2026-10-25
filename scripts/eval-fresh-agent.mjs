#!/usr/bin/env node
// Bounded fresh-agent evaluation for the portable setup guide and role packs.
//
//   node scripts/eval-fresh-agent.mjs plan
//   node scripts/eval-fresh-agent.mjs check
//   node scripts/eval-fresh-agent.mjs prepare --case new-project --root <dir>
//   node scripts/eval-fresh-agent.mjs verify  --case new-project --root <dir>
//   node scripts/eval-fresh-agent.mjs run     --case new-project --root <dir> --agent codex
//   node scripts/eval-fresh-agent.mjs summarise --receipts <dir>
//
// It copies a versioned fictional fixture into one explicitly owned root, hands
// the exported guide (captured from the real /setup UI by scripts/setup-export.mjs)
// to one fresh agent process, then runs declared assertions itself. It never
// deploys, provisions, authenticates, retries silently or widens permissions.
// A receipt records exactly what was and was not established.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyFreshAgentRun, isolationReport, summariseFreshAgentReceipts, validateFreshAgentCase } from '../src/lib/fresh-agent.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '..');
const lab = resolve(repository, 'labs/fresh-agent');
const casesDir = resolve(lab, 'cases');
const fixturesDir = resolve(lab, 'fixtures');
const guidesDir = resolve(lab, 'guides');
const provenanceFile = resolve(guidesDir, 'provenance.json');
const outputDir = resolve(repository, 'output');
const maxTranscript = 240_000;

const fail = (message) => { throw new Error(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (path) => sha256(readFileSync(path));
const isDirectory = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };

function argsOf(argv) {
  const options = { command: 'plan', case: '', root: '', agent: '', bin: '', model: process.env.FRESH_AGENT_MODEL ?? '', timeout: '900', receipts: '', note: [], cleanup: false };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('-')) options.command = rest.shift();
  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--case') options.case = rest.shift() ?? '';
    else if (arg === '--root') options.root = rest.shift() ?? '';
    else if (arg === '--agent') options.agent = rest.shift() ?? '';
    else if (arg === '--bin') options.bin = rest.shift() ?? '';
    else if (arg === '--model') options.model = rest.shift() ?? '';
    else if (arg === '--timeout') options.timeout = rest.shift() ?? '900';
    else if (arg === '--receipts') options.receipts = rest.shift() ?? '';
    else if (arg === '--note') options.note.push(rest.shift() ?? '');
    else if (arg === '--cleanup') options.cleanup = true;
    else fail(`Unknown argument: ${arg}`);
  }
  return options;
}

function loadCases() {
  const files = readdirSync(casesDir).filter((name) => name.endsWith('.json')).sort();
  if (files.length === 0 || files.length > 20) fail('Expected between 1 and 20 bounded case files.');
  const seen = new Set();
  return files.map((file) => {
    const value = JSON.parse(readFileSync(resolve(casesDir, file), 'utf8'));
    const problems = validateFreshAgentCase(value);
    if (problems.length) fail(`${file}: ${problems.join('; ')}`);
    if (seen.has(value.id)) fail(`${file} repeats the id ${value.id}.`);
    if (value.id !== file.replace(/\.json$/, '')) fail(`${file} must be named after its id.`);
    seen.add(value.id);
    if (!isDirectory(resolve(fixturesDir, value.fixture))) fail(`${file} names a missing fixture.`);
    for (const assertion of value.assertions) if (assertion.type === 'command' && typeof assertion.run !== 'string') fail(`${file} has a command assertion without a command.`);
    if (value.export && !existsSync(resolve(guidesDir, `${value.id}.md`))) fail(`${file} needs a captured export: run scripts/setup-export.mjs.`);
    if (value.pack && !existsSync(resolve(guidesDir, `${value.id}-pack.md`))) fail(`${file} needs a captured role-pack export: run scripts/setup-export.mjs.`);
    return value;
  });
}

function getCase(cases, id) {
  if (!id) fail('Pass --case <id>.');
  const found = cases.find((entry) => entry.id === id);
  if (!found) fail(`Unknown case: ${id}. Known: ${cases.map((entry) => entry.id).join(', ')}.`);
  return found;
}

const recordedPaths = {
  ownerNote: 'owner-note.txt',
  siteConfig: 'site.json',
  notesData: 'notes.json',
  scratchDraft: 'scratch/owner-draft.txt',
  step1Receipt: 'receipts/step-1.json',
  bundle: 'bundle.json',
};

function workspaceOf(root) {
  return resolve(root, 'workspace');
}

function realish(path) {
  // Resolve symlinks through the nearest existing ancestor so /private/var and
  // /var compare equal on macOS without requiring the run root to exist yet.
  const parts = [];
  let current = resolve(path);
  for (let depth = 0; depth < 32; depth += 1) {
    try { return resolve(realpathSync(current), ...parts.reverse()); } catch { /* keep walking up */ }
    const parent = dirname(current);
    if (parent === current) return resolve(path);
    parts.push(basename(current));
    current = parent;
  }
  return resolve(path);
}

function assertOwnedRoot(root) {
  if (!root) fail('Pass an explicit --root inside the declared temporary base.');
  const resolved = realish(root);
  const bases = [realish(process.env.FRESH_AGENT_ROOT_BASE ?? tmpdir()), realish(outputDir)];
  const owned = bases.some((base) => resolved === base || resolved.startsWith(base + sep));
  if (!owned) fail(`Refusing to write outside the owned bases (${bases.join(', ')}).`);
  if (resolved === '/' || resolved === homedir() || resolved === repository) fail('Refusing to use a broad directory as a run root.');
  return resolved;
}

function copyFixture(fixture, destination) {
  mkdirSync(destination, { recursive: true });
  cpSync(resolve(fixturesDir, fixture), destination, { recursive: true, dereference: true, filter: (source) => !source.split(sep).includes('.git') });
}

function git(cwd, ...args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', rejectPromise);
    child.on('close', (code) => (code === 0 ? resolvePromise(out.trim()) : rejectPromise(new Error(`git ${args.join(' ')} failed (${code}): ${err.trim()}`))));
  });
}

function redact(text) {
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/g, '$1[REDACTED]')
    .replace(/\b(ghp|gho|ghu|ghs|github_pat|sk|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    .replaceAll(homedir(), '~')
    .slice(0, maxTranscript);
}

async function prepareCase(entry, root) {
  const owned = assertOwnedRoot(root);
  const workspace = workspaceOf(owned);
  if (existsSync(workspace)) fail(`Refusing to prepare over an existing workspace: ${workspace}`);
  copyFixture(entry.fixture, workspace);
  await git(workspace, 'init', '-q');
  await git(workspace, '-c', 'user.email=fictional@example.invalid', '-c', 'user.name=Fictional Fixture', 'add', '-A');
  await git(workspace, '-c', 'user.email=fictional@example.invalid', '-c', 'user.name=Fictional Fixture', 'commit', '-q', '-m', `Fixture baseline for ${entry.id}`);
  const commit = await git(workspace, 'rev-parse', 'HEAD');

  for (const copy of entry.copies ?? []) {
    const source = resolve(repository, copy.from);
    if (!source.startsWith(repository + sep)) fail('Copies must come from this repository.');
    if (!existsSync(source)) fail(`Missing copy source: ${copy.from}`);
    cpSync(source, resolve(workspace, copy.to));
  }
  if (entry.pack) cpSync(resolve(guidesDir, `${entry.id}-pack.md`), resolve(workspace, `${entry.pack}.md`));

  const dirty = entry.dirty ?? [{ path: 'scratch/owner-draft.txt', write: 'Uncommitted owner draft: a half-written paragraph about the tin kettle, now edited by the owner.\n' }];
  for (const edit of dirty) {
    if (isAbsolute(edit.path) || edit.path.split('/').includes('..')) fail('Dirty edits must stay inside the workspace.');
    mkdirSync(dirname(resolve(workspace, edit.path)), { recursive: true });
    writeFileSync(resolve(workspace, edit.path), edit.write);
  }

  const recorded = {};
  for (const name of entry.recorded ?? []) {
    const path = recordedPaths[name] ?? (name === 'packCopy' ? `${entry.pack}.md` : null);
    if (!path) fail(`Unknown recorded key: ${name}.`);
    if (!existsSync(resolve(workspace, path))) fail(`Recorded path is absent after prepare: ${path}`);
    recorded[name] = { path, sha256: fileHash(resolve(workspace, path)) };
  }

  const guidePath = entry.export ? resolve(guidesDir, `${entry.id}.md`) : '';
  const packPath = entry.pack ? resolve(guidesDir, `${entry.id}-pack.md`) : '';
  const parts = [entry.prompt.trim()];
  if (guidePath) parts.push('---\n\n## Exported setup guide (pasted by the owner)\n\n' + readFileSync(guidePath, 'utf8').trim());
  if (packPath) parts.push('---\n\n## Downloaded role pack\n\n' + readFileSync(packPath, 'utf8').trim());
  const prompt = parts.join('\n\n') + '\n';
  mkdirSync(resolve(owned, 'inputs'), { recursive: true });
  writeFileSync(resolve(owned, 'prompt.md'), prompt);
  writeFileSync(resolve(owned, 'inputs', 'prompt.md'), prompt);
  if (guidePath) cpSync(guidePath, resolve(owned, 'inputs', `${entry.id}.md`));
  if (packPath) cpSync(packPath, resolve(owned, 'inputs', `${entry.pack}.md`));

  const manifest = {
    schema: 'composer.fresh-agent-run/1',
    case: entry.id,
    task: entry.task,
    title: entry.title,
    issue: entry.issue,
    preparedAt: new Date().toISOString(),
    workspace,
    fixture: entry.fixture,
    fixtureCommit: commit,
    promptSha256: sha256(prompt),
    promptBytes: Buffer.byteLength(prompt),
    guide: guidePath ? { file: `guides/${entry.id}.md`, sha256: fileHash(guidePath) } : null,
    pack: packPath ? { pack: entry.pack, file: `guides/${entry.id}-pack.md`, sha256: fileHash(packPath) } : null,
    recorded,
    tools: toolVersions(),
  };
  writeFileSync(resolve(owned, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function toolVersions() {
  const run = (command, argv) => {
    try {
      return execFileSync(command, argv, { encoding: 'utf8', timeout: 15000 }).trim().split('\n')[0];
    } catch { return null; }
  };
  return {
    node: process.version,
    python: run('python3', ['-V']),
    git: run('git', ['--version']),
    codex: run('codex', ['--version']),
    opencode: run(process.env.OPENCODE_CLI ?? 'opencode-cli', ['--version']),
    platform: `${process.platform} ${process.arch}`,
    os: process.env.FRESH_AGENT_OS ?? 'macOS local (darwin)',
  };
}

function versionOf(command) {
  try { return execFileSync(command, ['--version'], { encoding: 'utf8', timeout: 15000 }).trim().split('\n')[0]; } catch { return null; }
}

function runProcess(command, argv, { cwd, timeoutMs = 120_000, env = {}, input = null } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, argv, { cwd, env: { ...process.env, ...env }, stdio: [input === null ? 'ignore' : 'pipe', 'pipe', 'pipe'], detached: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const limit = (value) => value.length > 120_000 ? value.slice(-120_000) : value;
    child.stdout.on('data', (chunk) => { stdout = limit(stdout + chunk); });
    child.stderr.on('data', (chunk) => { stderr = limit(stderr + chunk); });
    if (input !== null) child.stdin.end(input);
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } }, timeoutMs);
    child.on('error', (error) => { clearTimeout(timer); resolvePromise({ code: null, stdout, stderr: stderr + String(error), timedOut }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* process group already gone */ }
      resolvePromise({ code, stdout, stderr, timedOut });
    });
  });
}

async function httpProbe(workspace, assertion) {
  const child = spawn('sh', ['-c', assertion.command], { cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  let output = '';
  let errors = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { errors += chunk; });
  const deadline = Date.now() + 20_000;
  let match = /\bhttp:\/\/127\.0\.0\.1:(\d+)\/?/.exec(output);
  while (!match && Date.now() < deadline) {
    if (child.exitCode !== null) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
    match = /\bhttp:\/\/127\.0\.0\.1:(\d+)\/?/.exec(output);
  }
  const results = [];
  try {
    if (!match) return { passed: false, detail: `no local URL printed within 20s (exit ${child.exitCode}): ${(errors || output).slice(0, 400)}` };
    const origin = `http://127.0.0.1:${match[1]}`;
    for (const request of assertion.requests) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(origin + request.path, { signal: controller.signal, redirect: 'manual' });
        const body = await response.text();
        const ok = response.status === request.status && (!request.contains || body.includes(request.contains));
        results.push(`${request.path} ${response.status}${request.contains ? ` contains "${request.contains}"=${body.includes(request.contains)}` : ''}${ok ? '' : ' MISMATCH'}`);
        if (!ok) return { passed: false, detail: results.join('; ') };
      } catch (error) {
        results.push(`${request.path} FAILED ${error instanceof Error ? error.message : String(error)}`);
        return { passed: false, detail: results.join('; ') };
      } finally { clearTimeout(timer); }
    }
    return { passed: true, detail: results.join('; ') };
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already stopped */ }
    child.removeAllListeners();
    child.stdout?.destroy();
    child.stderr?.destroy();
  }
}

async function runAssertions(entry, manifest) {
  const workspace = manifest.workspace;
  const results = [];
  const record = (assertion, passed, detail) => results.push({ type: assertion.type, target: assertion.path ?? assertion.pattern ?? assertion.run ?? '', passed, detail: redact(String(detail)).slice(0, 800) });

  for (const assertion of entry.assertions) {
    try {
      if (assertion.type === 'file-exists') {
        record(assertion, existsSync(resolve(workspace, assertion.path)), existsSync(resolve(workspace, assertion.path)) ? 'present' : 'absent');
      } else if (assertion.type === 'file-absent') {
        record(assertion, !existsSync(resolve(workspace, assertion.path)), existsSync(resolve(workspace, assertion.path)) ? 'still present' : 'absent');
      } else if (assertion.type === 'sha256') {
        const path = resolve(workspace, assertion.path);
        const expected = assertion.equals.startsWith('recorded:') ? manifest.recorded[assertion.equals.slice('recorded:'.length)]?.sha256 : assertion.equals;
        if (!expected) fail(`No recorded hash for ${assertion.equals}.`);
        const actual = existsSync(path) ? fileHash(path) : 'absent';
        record(assertion, actual === expected, actual === expected ? 'unchanged' : `expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…`);
      } else if (assertion.type === 'text') {
        const path = resolve(workspace, assertion.path);
        const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
        const missing = (assertion.contains ?? []).filter((value) => !text.includes(value));
        const present = (assertion.notContains ?? []).filter((value) => text.includes(value));
        record(assertion, missing.length === 0 && present.length === 0, missing.length || present.length ? `missing ${JSON.stringify(missing)} present ${JSON.stringify(present)}` : 'text matched');
      } else if (assertion.type === 'json-fields') {
        const path = resolve(workspace, assertion.path);
        const value = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
        const problems = [];
        if (!value || typeof value !== 'object') problems.push('not a JSON object');
        else {
          for (const field of assertion.fields) if (typeof value[field] !== 'string' || value[field].trim().length < 2) problems.push(`missing or empty ${field}`);
          for (const [field, allowed] of Object.entries(assertion.enum ?? {})) if (!allowed.includes(value[field])) problems.push(`${field}=${JSON.stringify(value[field])} not in ${allowed.join('|')}`);
        }
        record(assertion, problems.length === 0, problems.length ? problems.join('; ') : 'fields present');
      } else if (assertion.type === 'json-text') {
        const path = resolve(workspace, assertion.path);
        const value = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
        const field = String(value?.[assertion.field] ?? '');
        const passed = new RegExp(assertion.matches, 'i').test(field);
        record(assertion, passed, passed ? 'matched' : `${assertion.field} did not match /${assertion.matches}/i: ${field.slice(0, 200)}`);
      } else if (assertion.type === 'role-fields') {
        const { getRolePack } = await import('../src/lib/role-packs.ts');
        const pack = getRolePack(assertion.role);
        if (!pack) fail(`Unknown role pack in assertion: ${assertion.role}`);
        const path = resolve(workspace, assertion.path);
        const value = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
        const keys = value && typeof value === 'object' ? Object.keys(value).map((key) => key.toLowerCase()) : [];
        const missing = pack.output.map((field) => field.name).filter((name) => !keys.includes(name.toLowerCase()));
        record(assertion, Boolean(value) && missing.length === 0, missing.length ? `missing fields: ${missing.join(', ')}` : `${pack.output.length} pack fields present`);
      } else if (assertion.type === 'glob-count') {
        if (typeof assertion.pattern !== 'string' || !assertion.pattern.endsWith('/*')) fail('glob-count needs a "directory/*" pattern.');
        const directory = resolve(workspace, assertion.pattern.slice(0, -2));
        if (!isDirectory(directory)) { record(assertion, false, `${relative(workspace, directory)} is not a directory`); continue; }
        const entries = readdirSync(directory).filter((name) => name !== '.gitkeep');
        record(assertion, entries.length === assertion.equals, `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}: ${entries.join(', ') || 'none'}`);
      } else if (assertion.type === 'dir-count-min') {
        const directory = resolve(workspace, assertion.path);
        if (!isDirectory(directory)) { record(assertion, false, `${assertion.path} is not a directory`); continue; }
        const entries = readdirSync(directory).filter((name) => name !== '.gitkeep');
        record(assertion, entries.length >= assertion.equals, `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
      } else if (assertion.type === 'absent-any') {
        const present = assertion.paths.filter((path) => existsSync(resolve(workspace, path)));
        record(assertion, present.length === 0, present.length ? `unexpected: ${present.join(', ')}` : 'none present');
      } else if (assertion.type === 'command') {
        const result = await runProcess('sh', ['-c', assertion.run], { cwd: workspace, timeoutMs: assertion.timeoutMs ?? 120_000 });
        const tail = (result.stderr || result.stdout).trim().split('\n').slice(-3).join(' | ');
        record(assertion, result.code === assertion.expectExit && !result.timedOut, `exit ${result.code}${result.timedOut ? ' (timeout)' : ''}: ${tail}`);
      } else if (assertion.type === 'http') {
        const result = await httpProbe(workspace, assertion);
        record(assertion, result.passed, result.detail);
      } else fail(`Unsupported assertion type: ${assertion.type}`);
    } catch (error) {
      record(assertion, false, `assertion error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return results;
}

async function verifyCase(entry, root) {
  const owned = assertOwnedRoot(root);
  const manifestPath = resolve(owned, 'manifest.json');
  if (!existsSync(manifestPath)) fail('Run prepare first; no manifest.json in the root.');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.case !== entry.id) fail(`This root was prepared for ${manifest.case}, not ${entry.id}.`);
  const results = await runAssertions(entry, manifest);
  const passed = results.every((result) => result.passed);
  const decisionPath = resolve(manifest.workspace, 'decision.json');
  let response = 'completed';
  if (existsSync(decisionPath)) {
    try { response = JSON.parse(readFileSync(decisionPath, 'utf8')).outcome ?? 'decision'; } catch { response = 'unreadable-decision'; }
  }
  return { passed, response, results };
}

function classify(entry, verification, isolation) {
  return classifyFreshAgentRun({
    passed: verification.passed,
    expectsDecision: entry.assertions.some((assertion) => assertion.path === 'decision.json'),
    isolation,
  });
}

/** Any reference to this repository, its lab or its harness means the session
 * was not isolated: it could read the evaluation's own assertions. Such a run
 * must never be reported as a fresh-agent pass. */
function isolationReportFor(log) {
  return isolationReport(log, [repository, homedir() + '/gits/app-composer-lane-g-evaluation', 'labs/fresh-agent', 'eval-fresh-agent', 'setup-export.mjs', 'scripts/roles.mjs']);
}

async function runAgent(entry, root, options) {
  const owned = assertOwnedRoot(root);
  let manifestPath = resolve(owned, 'manifest.json');
  if (!existsSync(manifestPath)) await prepareCase(entry, owned);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!options.agent) fail('Pass --agent codex|opencode (or another supported CLI). No agent is started by default.');
  const prompt = readFileSync(resolve(owned, 'prompt.md'), 'utf8');
  const timeoutMs = Math.max(60, Math.min(3600, Number(options.timeout) || 900)) * 1000;
  let command;
  let argv;
  let model = options.model;
  if (options.agent === 'codex') {
    argv = ['exec', '--cd', manifest.workspace, '--skip-git-repo-check', '--sandbox', 'workspace-write', '--ephemeral', '--color', 'never', '-o', resolve(owned, 'last-message.md')];
    if (model) argv.push('--model', model);
    argv.push('-');
    command = `codex`;
  } else if (options.agent === 'opencode') {
    command = options.bin || process.env.OPENCODE_CLI || 'opencode-cli';
    model = model || 'opencode-go/deepseek-v4.1-flash';
    argv = ['run', '--standalone', '--auto', '--model', model, '--title', `Fresh agent ${entry.id}`];
  } else fail('Only the codex and opencode CLIs are wired for this bounded run.');
  if (!model) model = 'CLI default';
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const commandArgs = options.agent === 'opencode' ? [...argv, prompt, manifest.workspace] : [...argv, prompt];
  // The OpenCode CLI resolves its project from $PWD, not from the process cwd.
  // Spawned processes inherit the parent's $PWD, so it must be set explicitly or
  // the agent silently starts in the caller's repository.
  const childEnv = options.agent === 'opencode' ? { PWD: manifest.workspace, CODEX_UNSAFE_ALLOW_NO_SANDBOX: '0' } : { CODEX_UNSAFE_ALLOW_NO_SANDBOX: '0' };
  const result = await runProcess(command, commandArgs, { cwd: manifest.workspace, timeoutMs, env: childEnv });
  const rawLog = `# agent: ${options.agent} (${command})\n# model: ${model}\n# cwd: ${manifest.workspace}\n# argv: ${argv.join(' ')}\n\n## stdout\n${result.stdout}\n\n## stderr\n${result.stderr}\n`;
  const isolation = isolationReportFor(rawLog);
  const log = redact(rawLog);
  writeFileSync(resolve(owned, 'agent.log'), log);
  if (result.stdout.trim()) writeFileSync(resolve(owned, 'last-message.md'), redact(result.stdout));
  const verification = await verifyCase(entry, owned);
  const receipt = {
    schema: 'composer.fresh-agent-run/1',
    case: entry.id,
    task: entry.task,
    title: entry.title,
    issue: entry.issue,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    agent: options.agent,
    agentCommand: command,
    agentVersion: versionOf(command),
    model,
    agentExit: result.code,
    agentTimedOut: result.timedOut,
    outcome: classify(entry, verification, isolation),
    isolation,
    response: verification.response,
    humanActions: [],
    notes: options.note,
    fixture: manifest.fixture,
    fixtureCommit: manifest.fixtureCommit,
    guideSha256: manifest.guide?.sha256 ?? null,
    packSha256: manifest.pack?.sha256 ?? null,
    promptSha256: manifest.promptSha256,
    promptBytes: manifest.promptBytes,
    tools: manifest.tools,
    assertions: verification.results,
    passed: verification.results.filter((entryResult) => entryResult.passed).length,
    total: verification.results.length,
    transcript: 'agent.log',
    transcriptBytes: Buffer.byteLength(log),
  };
  writeFileSync(resolve(owned, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

async function checkAll(cases) {
  const problems = [];
  const checks = [];
  const check = (name, passed, detail) => { checks.push({ name, passed, detail }); if (!passed) problems.push(`${name}: ${detail}`); };

  check('cases', cases.length >= 5, `${cases.length} cases`);
  const provenance = existsSync(provenanceFile) ? JSON.parse(readFileSync(provenanceFile, 'utf8')) : null;
  check('export provenance', Boolean(provenance), provenance ? `${provenance.exports.length} captured exports from ${provenance.browser}` : 'guides/provenance.json is missing');
  for (const entry of cases) {
    if (entry.export) {
      const path = resolve(guidesDir, `${entry.id}.md`);
      const captured = provenance?.exports.find((item) => item.case === entry.id && item.kind === 'setup-guide');
      const actual = existsSync(path) ? fileHash(path) : 'absent';
      check(`${entry.id} guide`, Boolean(captured) && captured.sha256 === actual, captured ? (captured.sha256 === actual ? `${captured.bytes} bytes, hash matches` : 'guide bytes changed since capture; re-run scripts/setup-export.mjs') : 'no provenance entry');
      const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
      check(`${entry.id} guide scope`, text.includes('Guide: app-composer.project-setup/1') && text.includes(entry.export.outcome) && text.includes(entry.export.project) && !/Bearer\s+[A-Za-z0-9]/i.test(text), 'schema present, exported details present, no bearer value');
    }
    if (entry.pack) {
      const path = resolve(guidesDir, `${entry.id}-pack.md`);
      const captured = provenance?.exports.find((item) => item.case === entry.id && item.kind === 'role-pack');
      const actual = existsSync(path) ? fileHash(path) : 'absent';
      check(`${entry.id} pack`, Boolean(captured) && captured.sha256 === actual, captured ? (captured.sha256 === actual ? `${captured.bytes} bytes, hash matches` : 'pack bytes changed since capture') : 'no provenance entry');
    }
  }

  const flags = { PYTHONDONTWRITEBYTECODE: '1' };
  const existing = await runProcess('python3', ['-m', 'unittest', '-q'], { cwd: resolve(fixturesDir, 'existing-notes'), env: flags });
  check('existing fixture baseline', existing.code === 0, `exit ${existing.code}; ${existing.stderr.trim().split('\n').slice(-1)[0]}`);
  const interrupted = await runProcess('python3', ['-m', 'unittest', '-q'], { cwd: resolve(fixturesDir, 'interrupted'), env: flags });
  check('interrupted fixture baseline', interrupted.code !== 0 && /FAILED|errors=1/.test(interrupted.stderr), `exit ${interrupted.code}; exactly the health route should fail`);
  const interruptedText = readFileSync(resolve(fixturesDir, 'interrupted/app.py'), 'utf8');
  check('interrupted fixture has no health route', !interruptedText.includes('"/health"') && !interruptedText.includes("'/health'"), 'the pending step is genuinely missing');

  const roles = await runProcess('node', ['scripts/roles.mjs', 'check'], { cwd: repository });
  check('role packs valid', roles.code === 0, roles.stdout.trim().split('\n')[0] ?? roles.stderr.trim());
  const refusal = await runProcess('node', ['scripts/roles.mjs', 'brief', '--role', 'qa', '--input', 'examples/role-packs/wrong-target-production.json'], { cwd: repository });
  check('unsafe bundle refused', refusal.code === 2 && /Human action:/.test(refusal.stderr), `exit ${refusal.code}`);
  for (const entry of cases.filter((item) => item.pack)) {
    const path = resolve(guidesDir, `${entry.id}-pack.md`);
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
    check(`${entry.id} pack names its refusal`, text.includes('production mutation is refused') || text.includes('refuse'), 'stop rule present in the exported pack');
  }
  return { checks, problems };
}

function summarise(receiptsDir) {
  if (!existsSync(receiptsDir)) fail('No receipts directory.');
  const files = readdirSync(receiptsDir).filter((name) => name.endsWith('.json'));
  const rows = summariseFreshAgentReceipts(files.map((name) => JSON.parse(readFileSync(resolve(receiptsDir, name), 'utf8'))));
  const lines = ['| Case | Task | Outcome | Passed | Duration | Agent |', '| --- | --- | --- | --- | --- | --- |'];
  for (const row of rows) {
    lines.push(`| ${row.case} | ${row.task} | ${row.outcome}${row.isolation.clean ? '' : ' (contaminated)'} | ${row.passed}/${row.total} | ${Math.round(row.durationMs / 1000)}s | ${row.agent} ${row.model} |`);
  }
  return lines.join('\n');
}

async function main() {
  const options = argsOf(process.argv.slice(2));
  const cases = loadCases();
  if (options.command === 'plan') {
    for (const entry of cases) {
      console.log(`${entry.id.padEnd(24)} task ${entry.task}  ${entry.assertions.length} assertions  fixture ${entry.fixture}${entry.export ? `  guide ${entry.export.mode}` : ''}${entry.pack ? `  pack ${entry.pack}` : ''}`);
    }
    return 0;
  }
  if (options.command === 'check') {
    const result = await checkAll(cases);
    for (const check of result.checks) console.log(`${check.passed ? 'ok  ' : 'FAIL'} ${check.name}: ${check.detail}`);
    console.log(`\n${result.checks.filter((check) => check.passed).length}/${result.checks.length} deterministic checks passed.`);
    return result.problems.length ? 1 : 0;
  }
  if (options.command === 'prepare') {
    const entry = getCase(cases, options.case);
    const manifest = await prepareCase(entry, options.root);
    console.log(JSON.stringify({ case: manifest.case, workspace: manifest.workspace, fixtureCommit: manifest.fixtureCommit, promptBytes: manifest.promptBytes, guide: manifest.guide, recorded: Object.keys(manifest.recorded) }, null, 2));
    return 0;
  }
  if (options.command === 'verify') {
    const entry = getCase(cases, options.case);
    const verification = await verifyCase(entry, options.root);
    for (const result of verification.results) console.log(`${result.passed ? 'ok  ' : 'FAIL'} ${result.type} ${result.target}: ${result.detail}`);
    console.log(`\n${verification.results.filter((result) => result.passed).length}/${verification.results.length} assertions passed; response ${verification.response}.`);
    return verification.passed ? 0 : 1;
  }
  if (options.command === 'run') {
    const entry = getCase(cases, options.case);
    const receipt = await runAgent(entry, options.root, options);
    for (const result of receipt.assertions) console.log(`${result.passed ? 'ok  ' : 'FAIL'} ${result.type} ${result.target}: ${result.detail}`);
    console.log(`\n${receipt.case}: ${receipt.outcome} (${receipt.passed}/${receipt.total}); ${Math.round(receipt.durationMs / 1000)}s; receipt ${resolve(options.root, 'receipt.json')}`);
    if (options.cleanup) {
      rmSync(resolve(options.root), { recursive: true, force: true });
      console.log(`Removed the owned root ${resolve(options.root)}.`);
    }
    return receipt.passed ? 0 : 1;
  }
  if (options.command === 'reverify') {
    // Re-run the declared assertions against the same untouched workspace, e.g.
    // after correcting an over-specified assertion. The agent run and its
    // transcript stay exactly as recorded; the change is disclosed.
    const entry = getCase(cases, options.case);
    const owned = assertOwnedRoot(options.root);
    const receiptPath = resolve(owned, 'receipt.json');
    if (!existsSync(receiptPath)) fail('No receipt.json to reverify.');
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const manifest = JSON.parse(readFileSync(resolve(owned, 'manifest.json'), 'utf8'));
    const verification = await verifyCase(entry, owned);
    receipt.assertions = verification.results;
    receipt.passed = verification.results.filter((result) => result.passed).length;
    receipt.total = verification.results.length;
    receipt.response = verification.response;
    receipt.outcome = classify(entry, verification, receipt.isolation ?? { clean: false, hits: { unknown: 1 } });
    receipt.reverifiedAt = new Date().toISOString();
    receipt.notes = [...(receipt.notes ?? []), ...options.note];
    receipt.assertionSet = readFileSync(resolve(casesDir, `${entry.id}.json`), 'utf8').length;
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    for (const result of verification.results) console.log(`${result.passed ? 'ok  ' : 'FAIL'} ${result.type} ${result.target}: ${result.detail}`);
    console.log(`\n${receipt.case}: ${receipt.outcome} (${receipt.passed}/${receipt.total}) against the recorded workspace; agent run unchanged.`);
    return verification.passed ? 0 : 1;
  }
  if (options.command === 'summarise') {
    console.log(summarise(resolve(options.receipts)));
    return 0;
  }
  fail(`Unknown command: ${options.command}`);
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Fresh-agent evaluation failed.');
  process.exitCode = 1;
}
