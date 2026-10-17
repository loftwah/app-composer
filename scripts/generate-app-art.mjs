// MIT. Authoring-only helper for App Composer mini-app artwork.
//
// This is a local authoring tool, not part of the deployed product: nothing in
// src/ imports it, it is never bundled and no runtime image-generation service
// is added. It talks to fal's documented REST queue API with the installed
// Node fetch, so the product keeps no new dependency.
//
// Credentials are read from the environment only and never printed, logged or
// written to provenance. Use FAL_AI_API_KEY; FAL_KEY remains accepted for
// callers that already follow fal's own default.
//
// Usage:
//   node scripts/generate-app-art.mjs --jobs <file.json> --out <dir> [--only <id,id>]
//   node scripts/generate-app-art.mjs --jobs <file.json> --out <dir> --dry-run

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const QUEUE_ORIGIN = 'https://queue.fal.run';
const RESULT_ORIGIN = 'https://fal.run';
const POLL_MS = 2500;
const MAX_WAIT_MS = 15 * 60 * 1000;

function fail(message) {
  process.stderr.write('generate-app-art: ' + message + '\n');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { jobs: null, out: null, only: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--jobs') args.jobs = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--only') args.only = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else fail('unknown argument: ' + arg);
  }
  if (!args.jobs) fail('--jobs <file.json> is required');
  return args;
}

export function credential(env = process.env) {
  return env.FAL_AI_API_KEY ?? env.FAL_KEY ?? null;
}

function authHeaders(key) {
  return { Authorization: 'Key ' + key, 'Content-Type': 'application/json' };
}

async function readJson(response, what) {
  const text = await response.text();
  if (!response.ok) {
    // fal error bodies carry no secret; keep the first line only for brevity.
    throw Error(what + ' failed (' + response.status + '): ' + text.slice(0, 400));
  }
  try {
    return JSON.parse(text);
  } catch {
    throw Error(what + ' returned non-JSON: ' + text.slice(0, 200));
  }
}

// One bounded submission. fal's queue returns a real request id, which is what
// belongs in provenance; the synchronous endpoint does not expose one.
export async function submit(endpoint, input, key, fetchImpl = fetch) {
  const response = await fetchImpl(QUEUE_ORIGIN + '/' + endpoint, {
    method: 'POST',
    headers: authHeaders(key),
    body: JSON.stringify(input),
  });
  const body = await readJson(response, 'submit ' + endpoint);
  const requestId = body.request_id ?? body.requestId;
  if (typeof requestId !== 'string' || !requestId) throw Error('submit returned no request_id');
  // fal scopes the queue to the base application id, not the sub-path that was
  // submitted to, so its own URLs are the only reliable ones to poll.
  const statusUrl = body.status_url ?? QUEUE_ORIGIN + '/' + endpoint + '/requests/' + requestId + '/status';
  const responseUrl = body.response_url ?? RESULT_ORIGIN + '/' + endpoint + '/requests/' + requestId;
  return { requestId, statusUrl, responseUrl };
}

export async function awaitResult({ requestId, statusUrl, responseUrl }, key, fetchImpl = fetch) {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const body = await readJson(await fetchImpl(statusUrl, { headers: authHeaders(key) }), 'status');
    const state = body.status;
    if (state === 'COMPLETED') {
      return await readJson(await fetchImpl(responseUrl, { headers: authHeaders(key) }), 'result');
    }
    if (state === 'FAILED' || state === 'CANCELLED') {
      throw Error('request ' + requestId + ' ' + state + ': ' + JSON.stringify(body).slice(0, 400));
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw Error('request ' + requestId + ' did not finish within ' + MAX_WAIT_MS / 60000 + ' minutes');
}

function mediaFrom(result) {
  const images = result?.images ?? result?.data?.images ?? [];
  return images
    .filter(item => item && typeof item.url === 'string')
    .map(item => ({ url: item.url, contentType: item.content_type ?? null, fileName: item.file_name ?? null }));
}

export async function download(url, destination, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) throw Error('download failed (' + response.status + ') for ' + url);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(destination, bytes);
  return bytes.length;
}

function extensionFor(media) {
  if (media.contentType === 'image/svg+xml') return '.svg';
  if (media.contentType === 'image/png') return '.png';
  if (media.contentType === 'image/jpeg') return '.jpg';
  if (media.contentType === 'image/webp') return '.webp';
  const fromUrl = extname(new URL(media.url).pathname);
  return fromUrl && fromUrl.length <= 5 ? fromUrl : '.bin';
}

async function runJob(job, outDir, key) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const handle = await submit(job.endpoint, job.input, key);
  const { requestId } = handle;
  let result;
  let error = null;
  try {
    result = await awaitResult(handle, key);
  } catch (cause) {
    error = cause.message;
  }
  const record = {
    id: job.id,
    endpoint: job.endpoint,
    requestId,
    submittedAt: startedAt,
    durationMs: Date.now() - started,
    input: job.input,
    note: job.note ?? null,
    reference: job.reference ?? null,
    error,
    outputs: [],
  };
  if (result) {
    const media = mediaFrom(result);
    if (!media.length) record.error = 'no images returned: ' + JSON.stringify(result).slice(0, 300);
    for (const [index, item] of media.entries()) {
      const name = job.id + (media.length > 1 ? '-' + (index + 1) : '') + extensionFor(item);
      const destination = join(outDir, name);
      const bytes = await download(item.url, destination);
      record.outputs.push({ file: name, bytes, contentType: item.contentType });
    }
  }
  writeFileSync(join(outDir, job.id + '.result.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(args.jobs, 'utf8'));
  if (!Array.isArray(manifest.jobs) || !manifest.jobs.length) fail('manifest has no jobs');
  const selected = args.only ? new Set(args.only.split(',').map(s => s.trim())) : null;
  const jobs = selected ? manifest.jobs.filter(job => selected.has(job.id)) : manifest.jobs;
  if (!jobs.length) fail('no jobs selected');

  if (args.dryRun) {
    for (const job of jobs) process.stdout.write('dry-run ' + job.id + ' → ' + job.endpoint + '\n');
    return;
  }

  const key = credential();
  if (!key) fail('set FAL_AI_API_KEY (or FAL_KEY) in the local tool environment');
  if (!args.out) fail('--out <dir> is required');
  const outDir = resolve(args.out);
  mkdirSync(outDir, { recursive: true });

  // Bounded batches: sequential submission keeps rate and spend predictable.
  for (const job of jobs) {
    process.stdout.write('→ ' + job.id + ' (' + job.endpoint + ')\n');
    const record = await runJob(job, outDir, key);
    for (const output of record.outputs) {
      process.stdout.write('  ' + output.file + ' (' + output.bytes + ' bytes) request ' + record.requestId + '\n');
    }
    if (record.error) process.stdout.write('  error: ' + record.error + '\n');
  }
  process.stdout.write('wrote results to ' + basename(outDir) + '/\n');
}

if (process.argv[1] && import.meta.url === new URL('file://' + resolve(process.argv[1])).href) {
  await main();
}
