#!/usr/bin/env node
/**
 * Read-only FinOps evidence collector and attribution view.
 *
 *   node scripts/finops-attribution.mjs --plan    # GET plan + missing authority (offline)
 *   node scripts/finops-attribution.mjs --allow-live-read > observation.json
 *   node scripts/finops-attribution.mjs --allow-live-read --view
 *
 * Only GET requests are made, to the fixed Cloudflare API v4 paths below. This
 * never writes, never changes a plan and never prints the token. The mapping is
 * read from wrangler.jsonc, so a resource is attributed only when this
 * repository records it. Independent apps have no recorded provider mapping
 * here and stay unallocated; that is honest, not an omission to guess around.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAttribution, attributionContract, missingAuthority } from '../src/lib/cost-attribution.ts';
import { apps } from '../src/lib/apps.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const API = 'https://api.cloudflare.com/client/v4';
export const readPaths = (account) => [
  `/accounts/${account}/`,
  `/accounts/${account}/workers/scripts`,
  `/accounts/${account}/d1/database`,
  `/accounts/${account}/r2/buckets`,
];

/** Mapping recorded by this repository: wrangler.jsonc only. */
export function recordedMapping(configuration) {
  const mapping = [];
  const add = (environmentId, kind, resourceName, extra = {}) =>
    mapping.push({ appId: 'app-composer', environmentId, kind, resourceName, recordedIn: 'wrangler.jsonc', ...extra });
  add('production', 'worker', configuration.name);
  for (const database of configuration.d1_databases ?? []) add('production', 'd1', database.database_name, { resourceId: database.database_id });
  for (const bucket of configuration.r2_buckets ?? []) add('production', 'r2', bucket.bucket_name);
  const preview = configuration.env?.preview;
  if (preview?.name) add('preview', 'worker', preview.name);
  for (const database of preview?.d1_databases ?? []) add('preview', 'd1', database.database_name, { resourceId: database.database_id });
  for (const bucket of preview?.r2_buckets ?? []) add('preview', 'r2', bucket.bucket_name);
  return mapping;
}

/** Independent apps whose provider resources are not recorded in this repo. */
export function unmappedApps() {
  return apps.map((app) => app.id);
}

async function getJson(token, path) {
  const response = await fetch(API + path, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

export async function collect({ token, account, now = new Date() }) {
  if (!/^[a-f0-9]{32}$/.test(account ?? '')) throw new Error('Select the exact 32-character Cloudflare account id.');
  if (!token) throw new Error('No Cloudflare token is available for the read.');
  const results = {};
  for (const path of readPaths(account)) results[path] = await getJson(token, path);
  const workers = results[`/accounts/${account}/workers/scripts`];
  const databases = results[`/accounts/${account}/d1/database`];
  const buckets = results[`/accounts/${account}/r2/buckets`];
  if (workers.status !== 200 || databases.status !== 200 || buckets.status !== 200) {
    throw new Error(`Provider inventory was not readable (workers ${workers.status}, d1 ${databases.status}, r2 ${buckets.status}).`);
  }
  const r2 = [];
  for (const bucket of buckets.body?.result?.buckets ?? []) {
    const usage = await getJson(token, `/accounts/${account}/r2/buckets/${encodeURIComponent(bucket.name)}/usage`);
    if (usage.status !== 200) continue;
    r2.push({
      name: bucket.name,
      payloadBytes: Number(usage.body?.result?.payloadSize ?? 0),
      objectCount: Number(usage.body?.result?.objectCount ?? 0),
      periodEnd: usage.body?.result?.end ?? now.toISOString(),
    });
  }
  return {
    source: 'cloudflare-rest-read',
    accountId: account,
    capturedAt: now.toISOString(),
    windowEnd: now.toISOString(),
    workers: (workers.body?.result ?? []).map((worker) => ({ id: worker.id })),
    d1: (databases.body?.result ?? []).map((database) => ({ uuid: database.uuid, name: database.name, fileSize: database.file_size })),
    r2,
  };
}

function plan(account) {
  return {
    contract: attributionContract,
    mode: 'plan',
    account,
    requests: readPaths(account).map((path) => ({ method: 'GET', path })),
    additionalReads: ['/accounts/{account}/r2/buckets/{bucket}/usage for each listed bucket'],
    missingAuthority: missingAuthority(),
    note: 'No billing, plan, subscription or analytics write is attempted. GraphQL analytics needs POST and is outside this read-only authority.',
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
  if (args.has('--plan')) {
    process.stdout.write(JSON.stringify(plan(account || '{account}'), null, 2) + '\n');
    return 0;
  }
  if (!args.has('--allow-live-read')) {
    process.stderr.write('Refused: pass --allow-live-read for the fixed GET reads, or --plan to inspect them offline.\n');
    return 2;
  }
  const observation = await collect({ token: process.env.CLOUDFLARE_API_TOKEN, account });
  if (args.has('--view')) {
    const configuration = JSON.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
    const view = buildAttribution({ mapping: recordedMapping(configuration), observation });
    process.stdout.write(JSON.stringify({ ...view, unmappedApps: unmappedApps() }, null, 2) + '\n');
    return 0;
  }
  process.stdout.write(JSON.stringify(observation, null, 2) + '\n');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`FinOps read failed: ${error instanceof Error ? error.message : 'unknown'}. No write was attempted.\n`);
    process.exitCode = 1;
  }
}
