#!/usr/bin/env node
// Local-first delivery journey for App Composer.
//
// Default is read-only local checking. A preview candidate is a local build
// only. Production release always requires the explicit --release flag, a
// clean pushed main checkout and the existing guarded deploy script.
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyLive} from './verify-live.mjs';
import {assertProductionTarget} from './deployment-target.mjs';

export const receiptSchema = 'app-composer.delivery-receipt/1';
export const modeFlags = {
  local: '--local',
  candidate: '--candidate',
  release: '--release',
  verify: '--verify',
};
const limits = [
  'Local checks and candidate builds do not verify production.',
  'A Version URL is not an isolated test environment. A deployed preview needs the preview bindings and no production services.',
  'The release step delegates to the existing clean pushed-main guard in scripts/deploy.mjs.',
  'This journey does not roll back, approve content, create cloud resources or replace owner authentication.',
];
const previewWarning =
  'The local dist directory now contains the preview candidate. The release step rebuilds production before upload.';

export class DeliveryRefusal extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeliveryRefusal';
    this.code = code;
  }
}

const list = value => (Array.isArray(value) ? value : []);
const text = value => (typeof value === 'string' && value.trim() ? value.trim() : null);
const bounded = (value, limit = 240) => {
  const message = String(value ?? '');
  return message.length > limit ? `${message.slice(0, limit - 1)}…` : message;
};

export function repositoryFromRemote(value) {
  const match = String(value ?? '').match(/github\.com[:/]+([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function git(workspace, args) {
  return execFileSync('git', args, {cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
}

export function readSourceIdentity({workspace = process.cwd(), runGit = git} = {}) {
  const call = args => {
    try {
      return runGit(workspace, args);
    } catch {
      return null;
    }
  };
  const commit = text(call(['rev-parse', 'HEAD']));
  if (!commit) {
    return {available: false, repository: null, branch: null, commit: null, originCommit: null, dirty: null, pushed: false};
  }
  const branch = text(call(['branch', '--show-current']));
  const status = call(['status', '--porcelain']);
  const originCommit = branch ? text(call(['rev-parse', '--verify', `origin/${branch}`])) : null;
  return {
    available: true,
    repository: repositoryFromRemote(call(['config', '--get', 'remote.origin.url'])),
    branch,
    commit,
    originCommit,
    dirty: status === null ? null : status.trim() !== '',
    pushed: Boolean(branch && originCommit === commit),
  };
}

export function isReleaseEligible(source) {
  return Boolean(
    source?.available &&
      source.dirty === false &&
      source.branch === 'main' &&
      source.originCommit === source.commit &&
      source.pushed,
  );
}

export function assertCandidateSource(source) {
  if (!source?.available) throw new DeliveryRefusal('missing-source', 'A Git checkout is required for a preview candidate.');
  if (source.dirty !== false) throw new DeliveryRefusal('dirty-source', 'Commit or remove local changes before building a preview candidate.');
  if (!source.branch) throw new DeliveryRefusal('detached-source', 'Select a branch before building a preview candidate.');
  if (!source.originCommit) throw new DeliveryRefusal('unpushed-source', `Push ${source.branch} to origin before building a preview candidate.`);
  if (source.originCommit !== source.commit || !source.pushed)
    throw new DeliveryRefusal('unpushed-source', `Push the exact candidate commit to origin/${source.branch} first.`);
}

export function assertReleaseSource(source) {
  assertCandidateSource(source);
  if (source.branch !== 'main')
    throw new DeliveryRefusal('wrong-branch', `Production release requires clean pushed main. Current branch is ${source.branch}.`);
}

function requireText(value, code, message) {
  const selected = text(value);
  if (!selected) throw new DeliveryRefusal(code, message);
  return selected;
}

function bindingPairs(value, key) {
  return list(value).map(item => ({
    binding: text(item?.binding),
    id: text(item?.[key]),
  }));
}

function requireBindings(value, key, code, message) {
  const bindings = bindingPairs(value, key);
  if (!bindings.length) throw new DeliveryRefusal(code, message);
  for (const binding of bindings) {
    if (!binding.binding || !binding.id)
      throw new DeliveryRefusal(code, `${message} Every binding needs a name and an exact resource identity.`);
  }
  return bindings;
}

function sharedBinding(bindings, production, field) {
  const shared = new Set(list(production).map(item => text(item?.[field])).filter(Boolean));
  return bindings.find(binding => shared.has(binding.id)) ?? null;
}

export function inspectPreviewIsolation(config) {
  const preview = config?.env?.preview;
  if (!preview) throw new DeliveryRefusal('preview-missing', 'wrangler.jsonc must define an isolated env.preview environment.');
  const worker = requireText(preview.name, 'preview-name-missing', 'Preview needs its own Worker name.');
  if (worker === config.name) throw new DeliveryRefusal('preview-shared-worker', 'Preview and production must use different Worker names.');
  if (list(preview.routes).length) throw new DeliveryRefusal('preview-route', 'Preview must not attach a production route.');
  if (list(preview.services).length) throw new DeliveryRefusal('preview-service', 'Preview must not bind production app services.');
  if (list(preview.triggers?.crons).length) throw new DeliveryRefusal('preview-cron', 'Preview must not inherit production cron triggers.');
  const previewOrigin = requireText(
    preview.vars?.PUBLIC_ORIGIN,
    'preview-origin-missing',
    'Preview needs its own public HTTPS origin.',
  );
  if (!/^https:\/\//.test(previewOrigin))
    throw new DeliveryRefusal('preview-origin', 'Preview needs its own public HTTPS origin.');
  if (previewOrigin === text(config.vars?.PUBLIC_ORIGIN))
    throw new DeliveryRefusal('preview-origin', 'Preview needs a distinct public origin.');
  if (text(preview.account_id) && text(preview.account_id) !== text(config.account_id))
    throw new DeliveryRefusal('preview-account', 'Preview must stay in the selected production account.');

  const d1 = requireBindings(preview.d1_databases, 'database_id', 'preview-d1', 'Preview needs its own D1 database.');
  const r2 = requireBindings(preview.r2_buckets, 'bucket_name', 'preview-r2', 'Preview needs its own R2 bucket.');
  const kv = requireBindings(preview.kv_namespaces, 'id', 'preview-kv', 'Preview needs its own KV namespace.');
  for (const [kind, bindings, production, field] of [
    ['d1', d1, config.d1_databases, 'database_id'],
    ['r2', r2, config.r2_buckets, 'bucket_name'],
    ['kv', kv, config.kv_namespaces, 'id'],
  ]) {
    const shared = sharedBinding(bindings, production, field);
    if (shared)
      throw new DeliveryRefusal(
        `preview-shared-${kind}`,
        `Preview ${kind} binding ${shared.binding} points at production resource ${shared.id}.`,
      );
  }
  return {
    worker,
    environment: 'preview',
    origin: text(preview.vars?.PUBLIC_ORIGIN) ?? null,
    d1,
    r2,
    kv,
    services: list(preview.services).length,
    routes: list(preview.routes).length,
    crons: list(preview.triggers?.crons).length,
    isolated: true,
  };
}

export function inspectTarget(workspace = process.cwd()) {
  const configPath = resolve(workspace, 'wrangler.jsonc');
  const lockPath = resolve(workspace, 'composition.lock.json');
  if (!existsSync(configPath) || !existsSync(lockPath))
    throw new DeliveryRefusal('missing-target', 'Run this journey from an App Composer checkout with wrangler.jsonc and composition.lock.json.');
  let config;
  let lock;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    throw new DeliveryRefusal('invalid-target', 'The selected Wrangler or composition configuration is not valid JSON.');
  }
  try {
    assertProductionTarget(config, config, lock);
  } catch (error) {
    throw new DeliveryRefusal('target-identity', bounded(error.message));
  }
  return {
    config,
    lock,
    identity: {
      worker: config.name,
      account: config.account_id,
      environment: text(config.vars?.RESOURCE_ENVIRONMENT) ?? 'production',
      origin: config.vars.PUBLIC_ORIGIN,
      compatibilityDate: config.compatibility_date ?? null,
      composition: {
        id: lock.id,
        apps: list(lock.apps).map(app => ({id: app.id, commit: app.commit, dataVersion: app.manifest?.dataVersion ?? null})),
      },
      preview: inspectPreviewIsolation(config),
    },
  };
}

export function previewBuildEnvironment(environment) {
  return {...environment, CLOUDFLARE_ENV: 'preview'};
}

export function productionEnvironment(environment) {
  if (environment.CLOUDFLARE_ENV)
    throw new DeliveryRefusal('cloudflare-environment-selected', 'Unset CLOUDFLARE_ENV before an authorised release; preview selection belongs to the candidate build.');
  return {...environment};
}

export function readGeneratedConfig(workspace = process.cwd()) {
  const pointerPath = resolve(workspace, '.wrangler/deploy/config.json');
  if (!existsSync(pointerPath))
    throw new DeliveryRefusal('candidate-missing', 'No generated preview build was found. Run the candidate build first.');
  let pointer;
  let bytes;
  try {
    pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
    const configPath = resolve(dirname(pointerPath), pointer.configPath);
    const expected = resolve(workspace, 'dist/server/wrangler.json');
    if (configPath !== expected)
      throw new DeliveryRefusal('candidate-path', 'The generated deployment configuration is not dist/server/wrangler.json.');
    bytes = readFileSync(configPath);
    return {path: configPath, bytes, config: JSON.parse(bytes.toString('utf8'))};
  } catch (error) {
    if (error instanceof DeliveryRefusal) throw error;
    throw new DeliveryRefusal('candidate-invalid', 'The generated preview configuration could not be read.');
  }
}

export function assertPreviewGenerated(generated, config) {
  const preview = inspectPreviewIsolation(config);
  if (generated?.name !== preview.worker)
    throw new DeliveryRefusal('candidate-worker', 'The generated Worker name does not match env.preview. Select CLOUDFLARE_ENV at build time.');
  if (generated?.account_id !== config.account_id)
    throw new DeliveryRefusal('candidate-account', 'The generated preview account does not match the selected account.');
  if (text(generated?.vars?.PUBLIC_ORIGIN) !== preview.origin)
    throw new DeliveryRefusal('candidate-origin', 'The generated preview origin does not match env.preview.');
  if (list(generated.services).length) throw new DeliveryRefusal('candidate-service', 'The generated preview still binds app services.');
  if (list(generated.routes).length) throw new DeliveryRefusal('candidate-route', 'The generated preview still attaches routes.');
  if (list(generated.triggers?.crons).length) throw new DeliveryRefusal('candidate-cron', 'The generated preview still has cron triggers.');

  const checks = [
    ['d1', generated.d1_databases, preview.d1, 'database_id'],
    ['r2', generated.r2_buckets, preview.r2, 'bucket_name'],
    ['kv', generated.kv_namespaces, preview.kv, 'id'],
  ];
  for (const [kind, actualValue, expected, field] of checks) {
    const actual = bindingPairs(actualValue, field);
    if (actual.length !== expected.length)
      throw new DeliveryRefusal(`candidate-${kind}`, `The generated preview ${kind} bindings do not match env.preview.`);
    for (const binding of expected) {
      if (!actual.some(candidate => candidate.binding === binding.binding && candidate.id === binding.id))
        throw new DeliveryRefusal(`candidate-${kind}`, `The generated preview ${kind} binding ${binding.binding} does not match env.preview.`);
    }
    const shared = sharedBinding(actual, kind === 'r2' ? config.r2_buckets : kind === 'd1' ? config.d1_databases : config.kv_namespaces, field);
    if (shared) throw new DeliveryRefusal(`candidate-shared-${kind}`, `The generated preview ${kind} binding ${shared.binding} points at production.`);
  }
  return preview;
}

export function runCommand(command, args, {workspace = process.cwd(), env = process.env, stdio = 'inherit'} = {}) {
  const result = spawnSync(command, args, {cwd: workspace, env, stdio});
  if (result.error) throw new DeliveryRefusal('command-unavailable', `${command} could not start: ${result.error.code ?? 'unknown'}`);
  if (result.status !== 0)
    throw new DeliveryRefusal('command-failed', `${command} ${args.join(' ')} exited with status ${result.status ?? 'signal'}.`);
}

function sourceReceipt(source) {
  return {
    available: Boolean(source?.available),
    repository: source?.repository ?? null,
    branch: source?.branch ?? null,
    commit: source?.commit ?? null,
    originCommit: source?.originCommit ?? null,
    dirty: source?.dirty ?? null,
    pushed: Boolean(source?.pushed),
    releaseEligible: isReleaseEligible(source),
  };
}

function targetReceipt(target) {
  return target?.identity ? structuredClone(target.identity) : null;
}

function nextActionFor(mode, source) {
  if (mode === 'local') {
    if (isReleaseEligible(source))
      return 'Review this receipt, then build the safe preview candidate: node scripts/delivery-journey.mjs --candidate --receipt output/delivery/candidate.json';
    if (source?.dirty)
      return 'Commit and push the intended change, then run the candidate or release journey from clean source.';
    return 'Push the exact commit to origin/main before a candidate or release. Local checks remain local evidence.';
  }
  if (mode === 'candidate') {
    if (isReleaseEligible(source))
      return 'Review the candidate receipt, then authorise release: node scripts/delivery-journey.mjs --release --receipt output/delivery/release.json';
    return 'A candidate from a branch is not release approval. Merge the exact commit to clean pushed main before --release.';
  }
  if (mode === 'release') return 'Record this receipt in #11 and inspect the live result independently before calling the release accepted.';
  return 'Compare this independent result with the release receipt; local checks alone do not establish production acceptance.';
}

function failureAction(mode, receipt) {
  if (mode === 'release' && receipt.release.attempted)
    return 'The release command was attempted. Inspect the actual Worker version and live source before any retry. Do not repeat an ambiguous upload.';
  if (mode === 'release') return 'No upload occurred. Fix the reported source or target problem, then rerun from clean pushed main.';
  if (mode === 'candidate') return 'Fix the reported candidate problem and rerun from clean pushed source. Nothing was uploaded.';
  if (mode === 'verify') return 'Inspect the live source and deployed version; do not infer production acceptance from local checks.';
  return 'Fix the reported local problem and rerun. Nothing was released.';
}

export async function runDeliveryJourney({
  workspace = process.cwd(),
  mode = 'local',
  execute = runCommand,
  verify = verifyLive,
  source = null,
  environment = process.env,
  now = () => new Date(),
} = {}) {
  if (!(mode in modeFlags)) throw new DeliveryRefusal('unknown-mode', 'Select local, candidate, release or verify.');
  const started = now();
  const steps = [];
  const receipt = {
    schema: receiptSchema,
    mode,
    state: 'refused',
    generatedAt: started.toISOString(),
    source: null,
    target: null,
    steps,
    candidate: null,
    release: {attempted: false, performed: false, command: null, commit: null, checks: null},
    verification: {performed: false, independent: false, verifier: 'scripts/verify-live.mjs', origin: null},
    approval: {mode: 'explicit-flag', flag: modeFlags[mode], sourceCommit: null, candidateDigest: null},
    review: {required: mode === 'local' || mode === 'candidate', action: null},
    nextAction: null,
    limits,
    error: null,
  };
  let selectedTarget = null;
  try {
    const facts = source ?? readSourceIdentity({workspace});
    receipt.source = sourceReceipt(facts);

    if (mode === 'candidate') assertCandidateSource(facts);
    if (mode === 'release' || mode === 'verify') assertReleaseSource(facts);

    selectedTarget = inspectTarget(workspace);
    receipt.target = targetReceipt(selectedTarget);
    if (mode === 'release') productionEnvironment(environment);

    const runStep = async (id, label, command, args, options = {}) => {
      const stepStarted = Date.now();
      try {
        await execute(command, args, {workspace, env: options.env ?? environment, stdio: options.stdio ?? 'inherit'});
        const step = {id, label, command: [command, ...args].join(' '), state: 'passed', durationMs: Date.now() - stepStarted};
        steps.push(step);
        return step;
      } catch (error) {
        steps.push({
          id,
          label,
          command: [command, ...args].join(' '),
          state: 'failed',
          durationMs: Date.now() - stepStarted,
          error: bounded(error.message),
          code: error.code ?? 'command-failed',
        });
        throw error;
      }
    };

    // The guarded release runs `pnpm check` itself, first, on this exact clean
    // pushed commit. Repeating the same full gate here would not add a check:
    // deploy re-reads HEAD, origin/main and the working tree before uploading.
    if (mode !== 'verify' && mode !== 'release') {
      await runStep('local-checks', 'Required local checks', 'pnpm', ['check']);
    }

    if (mode === 'candidate' || mode === 'release') {
      await runStep('preview-build', 'Safe preview candidate build', 'pnpm', ['build'], {
        env: previewBuildEnvironment(environment),
      });
      const generated = readGeneratedConfig(workspace);
      assertPreviewGenerated(generated.config, selectedTarget.config);
      const digest = createHash('sha256').update(generated.bytes).digest('hex');
      receipt.candidate = {
        built: true,
        uploaded: false,
        versionUrlUsed: false,
        worker: generated.config.name,
        origin: generated.config.vars?.PUBLIC_ORIGIN ?? null,
        configPath: 'dist/server/wrangler.json',
        digest: `sha256:${digest}`,
        isolation: receipt.target.preview,
        warning: previewWarning,
      };
      receipt.approval.candidateDigest = receipt.candidate.digest;
    }

    if (mode === 'release') {
      receipt.approval.sourceCommit = facts.commit;
      receipt.release.attempted = true;
      receipt.release.command = 'pnpm deploy';
      receipt.release.commit = facts.commit;
      const releaseStepStarted = Date.now();
      try {
        await execute('pnpm', ['deploy'], {workspace, env: productionEnvironment(environment), stdio: 'inherit'});
        steps.push({
          id: 'release',
          label: 'Guarded production release',
          command: 'pnpm deploy',
          state: 'passed',
          durationMs: Date.now() - releaseStepStarted,
        });
      } catch (error) {
        steps.push({
          id: 'release',
          label: 'Guarded production release',
          command: 'pnpm deploy',
          state: 'failed',
          durationMs: Date.now() - releaseStepStarted,
          error: bounded(error.message),
          code: error.code ?? 'release-failed',
        });
        throw error;
      }
      receipt.release = {attempted: true, performed: true, command: 'pnpm deploy', commit: facts.commit, checks: 'pnpm check and pnpm build run inside the guarded deploy'};
      const verifyStarted = Date.now();
      try {
        await verify(facts.commit, selectedTarget.lock, selectedTarget.identity.origin);
        steps.push({
          id: 'verify',
          label: 'Independent live verification',
          command: 'scripts/verify-live.mjs',
          state: 'passed',
          durationMs: Date.now() - verifyStarted,
        });
      } catch (error) {
        steps.push({
          id: 'verify',
          label: 'Independent live verification',
          command: 'scripts/verify-live.mjs',
          state: 'failed',
          durationMs: Date.now() - verifyStarted,
          error: bounded(error.message),
          code: 'verification-failed',
        });
        throw error;
      }
      receipt.verification = {performed: true, independent: true, verifier: 'scripts/verify-live.mjs', origin: selectedTarget.identity.origin};
    }

    if (mode === 'verify') {
      const verifyStarted = Date.now();
      try {
        await verify(facts.commit, selectedTarget.lock, selectedTarget.identity.origin);
        steps.push({
          id: 'verify',
          label: 'Independent live verification',
          command: 'scripts/verify-live.mjs',
          state: 'passed',
          durationMs: Date.now() - verifyStarted,
        });
      } catch (error) {
        steps.push({
          id: 'verify',
          label: 'Independent live verification',
          command: 'scripts/verify-live.mjs',
          state: 'failed',
          durationMs: Date.now() - verifyStarted,
          error: bounded(error.message),
          code: 'verification-failed',
        });
        throw error;
      }
      receipt.verification = {performed: true, independent: true, verifier: 'scripts/verify-live.mjs', origin: selectedTarget.identity.origin};
    }

    receipt.state = 'passed';
    receipt.review.action = receipt.review.required ? 'Inspect source, target, candidate bindings and check results before the next step.' : null;
    receipt.nextAction = nextActionFor(mode, facts);
  } catch (error) {
    const known = error instanceof DeliveryRefusal || error?.code;
    receipt.state = known && !steps.some(step => step.state === 'failed') ? 'refused' : 'failed';
    receipt.error = {code: error?.code ?? 'journey-failed', message: bounded(error?.message)};
    if (mode === 'release' && receipt.release.attempted) receipt.release.failed = true;
    receipt.nextAction = failureAction(mode, receipt);
  }
  receipt.finishedAt = now().toISOString();
  return receipt;
}

export function humanSummary(receipt, receiptPath = null) {
  const source = receipt.source;
  const target = receipt.target;
  const lines = [];
  lines.push(`App Composer delivery journey — ${receipt.mode}`);
  lines.push(
    source?.available
      ? `Source: ${source.branch ?? '(detached)'} @ ${source.commit.slice(0, 12)}${source.dirty ? ' (changed files present)' : ''}${source.pushed ? ` (pushed to origin/${source.branch})` : ' (not pushed)'}`
      : 'Source: no Git checkout',
  );
  if (target)
    lines.push(
      `Target: ${target.worker} · account ${target.account} · ${target.environment} · ${target.origin}`,
    );
  if (target?.preview)
    lines.push(
      `Preview: ${target.preview.worker} · D1/R2/KV distinct · ${target.preview.services} services · ${target.preview.routes} routes`,
    );
  for (const step of receipt.steps)
    lines.push(`${step.state === 'passed' ? 'PASS' : 'FAIL'} ${step.label}: ${step.command} (${(step.durationMs / 1000).toFixed(1)}s)${step.error ? ` — ${step.error}` : ''}`);
  if (receipt.candidate)
    lines.push(`Candidate: ${receipt.candidate.worker} · ${receipt.candidate.digest} · uploaded: no`);
  if (receipt.verification.performed) lines.push(`Verified: ${receipt.verification.origin} independently via ${receipt.verification.verifier}`);
  lines.push(`State: ${receipt.state}`);
  if (receipt.error) lines.push(`Reason: ${receipt.error.code} — ${receipt.error.message}`);
  if (receiptPath) lines.push(`Receipt: ${receiptPath}`);
  lines.push(`Next: ${receipt.nextAction}`);
  return lines.join('\n');
}

function parseArguments(argv) {
  let mode = 'local';
  let receiptPath = null;
  let json = false;
  const selectedModes = [];
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--help') return {help: true};
    if (argument === '--json') {
      json = true;
      continue;
    }
    if (argument === '--receipt') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new DeliveryRefusal('receipt-path', '--receipt needs an explicit file path.');
      receiptPath = value;
      continue;
    }
    const found = Object.entries(modeFlags).find(([, flag]) => flag === argument);
    if (!found) throw new DeliveryRefusal('unknown-option', `Unsupported option ${argument}. Use --local, --candidate, --release, --verify, --json or --receipt PATH.`);
    selectedModes.push(found[0]);
  }
  if (selectedModes.length > 1) throw new DeliveryRefusal('multiple-modes', 'Select one delivery mode.');
  if (selectedModes.length === 1) mode = selectedModes[0];
  return {mode, receiptPath, json};
}

async function main() {
  let parsed;
  try {
    parsed = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  if (parsed.help) {
    process.stdout.write(`App Composer local-first delivery.

Usage: node scripts/delivery-journey.mjs [--local|--candidate|--release|--verify] [--json] [--receipt PATH]

  --local      Default. Inspect source/target, run pnpm check and refuse to release.
  --candidate  Check, then build and inspect a local preview candidate. No upload.
  --release    Check clean pushed main, rebuild the preview candidate, run pnpm deploy
               and independently verify the live source. Explicit approval only.
  --verify     Re-read the live root and mounted pins from clean pushed main.
  --json       Print only the bounded machine-readable receipt.
  --receipt    Also write the same receipt to an explicit path (for example output/delivery/receipt.json).

No GitHub Actions, recurring process, cloud resource creation or automatic retry is involved.
`);
    return;
  }
  const receipt = await runDeliveryJourney({mode: parsed.mode});
  if (parsed.json) process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  else process.stdout.write(`${humanSummary(receipt, parsed.receiptPath)}\n`);
  if (parsed.receiptPath) {
    const path = resolve(parsed.receiptPath);
    try {
      mkdirSync(dirname(path), {recursive: true});
      writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
      process.stderr.write(`Receipt written to ${path}\n`);
    } catch {
      process.stderr.write('The receipt path could not be written. No release state was changed by this failure.\n');
      process.exitCode = 1;
    }
  }
  if (receipt.state !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
