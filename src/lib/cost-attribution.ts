/** Bounded FinOps attribution over evidence that actually exists.
 *
 * The Cloudflare read authority available to this repository can list Workers,
 * D1 databases and R2 buckets and read D1 `file_size` and R2 bucket usage. It
 * cannot read request/CPU analytics (GraphQL requires POST and an analytics
 * scope) or billing (read endpoints return 403). So:
 *
 * - storage bytes are `measured` when the provider returned them;
 * - requests, CPU time and cost are `unverified`, with the exact missing
 *   authority recorded;
 * - a resource with no recorded Composer mapping stays `unallocated`, and an
 *   unknown value is never rendered as zero.
 *
 * This is an adapter boundary, not a billing system. It makes no provider call,
 * writes nothing and never infers that a resource belongs to an app because its
 * name looks similar.
 */
export const attributionContract = 'composer.cost-attribution/1';
export const attributionReviewed = '2026-10-25';

export const measureIds = ['workerExists', 'd1StorageBytes', 'r2StorageBytes', 'requests', 'cpuMs', 'cost'] as const;
export type MeasureId = (typeof measureIds)[number];

export interface AttributionMappingEntry {
  appId: string;
  environmentId: string;
  kind: 'worker' | 'd1' | 'r2';
  resourceName: string;
  resourceId?: string;
  recordedIn: string;
}

export interface ProviderObservation {
  source: 'cloudflare-rest-read';
  accountId: string;
  capturedAt: string;
  windowEnd: string;
  workers: { id: string }[];
  d1: { uuid: string; name: string; fileSize: number }[];
  r2: { name: string; payloadBytes: number; objectCount: number; periodEnd: string }[];
}

export interface Measure {
  id: MeasureId;
  label: string;
  state: 'measured' | 'unverified';
  value: number | null;
  unit: string;
  source: string;
  reason?: string;
  missingAuthority?: string;
}

export interface ResourceRow {
  appId: string;
  environmentId: string;
  kind: AttributionMappingEntry['kind'];
  resourceName: string;
  recordedIn: string;
  present: boolean;
  measures: Measure[];
}

export interface AttributionResult {
  contract: typeof attributionContract;
  accountId: string;
  capturedAt: string;
  windowEnd: string;
  rows: ResourceRow[];
  coverage: { measure: MeasureId; measured: number; total: number; state: 'complete' | 'partial' | 'unverified' }[];
  unallocated: { kind: AttributionMappingEntry['kind']; resourceName: string }[];
  limits: string[];
}

export class AttributionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AttributionError';
    this.code = code;
  }
}

const requestAuthority =
  'Cloudflare GraphQL analytics requires a POST request and an account analytics read scope. This collector is GET-only, so request and CPU measures stay unverified.';
const costAuthority =
  'Cloudflare billing reads require a billing scope. GET /accounts/{account}/billing/profile, /billing/history and /subscriptions returned HTTP 403 (code 10000).';
const costNote = 'Unknown cost is not zero. No plan, invoice or allocation is inferred.';

const text = (value: unknown, label: string, max = 200): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AttributionError('invalid-mapping', `${label} must be bounded text.`);
  }
  return value;
};
const iso = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new AttributionError('invalid-observation', `${label} must be an ISO timestamp.`);
  return value;
};
const bytes = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new AttributionError('invalid-observation', `${label} must be a non-negative whole number of bytes.`);
  return value;
};

function validateMapping(mapping: unknown): AttributionMappingEntry[] {
  if (!Array.isArray(mapping) || mapping.length === 0 || mapping.length > 200) throw new AttributionError('invalid-mapping', 'A bounded, non-empty mapping is required.');
  const seen = new Set<string>();
  const claimed = new Set<string>();
  return mapping.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new AttributionError('invalid-mapping', `mapping[${index}] must be an object.`);
    const value = entry as Record<string, unknown>;
    if (!['worker', 'd1', 'r2'].includes(String(value.kind))) throw new AttributionError('invalid-mapping', `mapping[${index}].kind must be worker, d1 or r2.`);
    const clean = {
      appId: text(value.appId, `mapping[${index}].appId`),
      environmentId: text(value.environmentId, `mapping[${index}].environmentId`),
      kind: value.kind as AttributionMappingEntry['kind'],
      resourceName: text(value.resourceName, `mapping[${index}].resourceName`),
      ...(value.resourceId === undefined ? {} : { resourceId: text(value.resourceId, `mapping[${index}].resourceId`) }),
      recordedIn: text(value.recordedIn, `mapping[${index}].recordedIn`),
    };
    const key = `${clean.kind}:${clean.resourceName}`;
    if (seen.has(key)) throw new AttributionError('duplicate-resource', `mapping[${index}] repeats ${key}.`);
    seen.add(key);
    const claim = `${clean.appId}/${clean.environmentId}/${key}`;
    if (claimed.has(claim)) throw new AttributionError('duplicate-claim', `mapping[${index}] claims ${claim} twice.`);
    claimed.add(claim);
    return clean;
  });
}

function validateObservation(observation: unknown, now: number): ProviderObservation {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) throw new AttributionError('invalid-observation', 'A provider observation is required.');
  const value = observation as Record<string, unknown>;
  if (value.source !== 'cloudflare-rest-read') throw new AttributionError('invalid-observation', 'Only a bounded read-only Cloudflare observation is accepted.');
  const accountId = text(value.accountId, 'accountId', 32);
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new AttributionError('invalid-observation', 'accountId must be the exact 32-character account id.');
  const capturedAt = iso(value.capturedAt, 'capturedAt');
  const windowEnd = iso(value.windowEnd, 'windowEnd');
  if (Date.parse(capturedAt) > now + 300_000) throw new AttributionError('invalid-observation', 'capturedAt is in the future.');
  if (!Array.isArray(value.workers) || value.workers.length > 1000) throw new AttributionError('invalid-observation', 'workers must be a bounded list.');
  if (!Array.isArray(value.d1) || value.d1.length > 500) throw new AttributionError('invalid-observation', 'd1 must be a bounded list.');
  if (!Array.isArray(value.r2) || value.r2.length > 500) throw new AttributionError('invalid-observation', 'r2 must be a bounded list.');
  return {
    source: 'cloudflare-rest-read',
    accountId,
    capturedAt,
    windowEnd,
    workers: value.workers.map((item, index) => ({ id: text((item as Record<string, unknown>)?.id, `workers[${index}].id`) })),
    d1: value.d1.map((item, index) => {
      const row = item as Record<string, unknown>;
      return { uuid: text(row?.uuid, `d1[${index}].uuid`), name: text(row?.name, `d1[${index}].name`), fileSize: bytes(row?.fileSize, `d1[${index}].fileSize`) };
    }),
    r2: value.r2.map((item, index) => {
      const row = item as Record<string, unknown>;
      return { name: text(row?.name, `r2[${index}].name`), payloadBytes: bytes(row?.payloadBytes, `r2[${index}].payloadBytes`), objectCount: bytes(row?.objectCount, `r2[${index}].objectCount`), periodEnd: iso(row?.periodEnd, `r2[${index}].periodEnd`) };
    }),
  };
}

const unverified = (id: MeasureId, label: string, unit: string, reason: string, missingAuthority: string): Measure => ({
  id,
  label,
  state: 'unverified',
  value: null,
  unit,
  source: 'not-measured',
  reason,
  missingAuthority,
});

const measured = (id: MeasureId, label: string, unit: string, value: number, source: string): Measure => ({
  id,
  label,
  state: 'measured',
  value,
  unit,
  source,
});

export function buildAttribution({ mapping, observation, now = Date.now() }: { mapping: unknown; observation: unknown; now?: number }): AttributionResult {
  if (!Number.isFinite(now)) throw new AttributionError('invalid-observation', 'A valid instant is required.');
  const entries = validateMapping(mapping);
  const observed = validateObservation(observation, now);
  const accounts = new Set(entries.map((entry) => entry.recordedIn));
  if (!accounts.size) throw new AttributionError('invalid-mapping', 'Each mapping entry must record where it came from.');

  const workerNames = new Set(observed.workers.map((worker) => worker.id));
  const databases = new Map(observed.d1.map((database) => [database.name, database]));
  const buckets = new Map(observed.r2.map((bucket) => [bucket.name, bucket]));

  const rows: ResourceRow[] = entries.map((entry) => {
    const base = { appId: entry.appId, environmentId: entry.environmentId, kind: entry.kind, resourceName: entry.resourceName, recordedIn: entry.recordedIn };
    if (entry.kind === 'worker') {
      const present = workerNames.has(entry.resourceName);
      const measures: Measure[] = [
        present
          ? measured('workerExists', 'Worker script', 'present', 1, `cloudflare REST /accounts/${observed.accountId}/workers/scripts`)
          : unverified('workerExists', 'Worker script', 'present', 'The mapped Worker was not in the observed account inventory.', 'Re-read the account inventory or correct the mapping; do not infer a rename.'),
        unverified('requests', 'Requests', 'requests', 'Request analytics were not collected.', requestAuthority),
        unverified('cpuMs', 'CPU time', 'ms', 'CPU analytics were not collected.', requestAuthority),
        unverified('cost', 'Cost', 'billing currency', costNote, costAuthority),
      ];
      return { ...base, present, measures };
    }
    if (entry.kind === 'd1') {
      const database = databases.get(entry.resourceName);
      const measures: Measure[] = [
        database
          ? measured('d1StorageBytes', 'D1 storage', 'bytes', database.fileSize, `cloudflare REST /accounts/${observed.accountId}/d1/database`)
          : unverified('d1StorageBytes', 'D1 storage', 'bytes', 'The mapped database was not in the observed account inventory.', 'Re-read the account inventory or correct the mapping; do not infer a rename.'),
        unverified('requests', 'Read/write queries', 'queries', 'D1 query analytics were not collected.', requestAuthority),
        unverified('cost', 'Cost', 'billing currency', costNote, costAuthority),
      ];
      return { ...base, present: Boolean(database), measures };
    }
    const bucket = buckets.get(entry.resourceName);
    const measures: Measure[] = [
      bucket
        ? measured('r2StorageBytes', 'R2 stored payload', 'bytes', bucket.payloadBytes, `cloudflare REST /accounts/${observed.accountId}/r2/buckets/${entry.resourceName}/usage`)
        : unverified('r2StorageBytes', 'R2 stored payload', 'bytes', 'The mapped bucket was not in the observed account inventory.', 'Read the bucket usage endpoint or correct the mapping; do not infer a rename.'),
      unverified('requests', 'Class A/B operations', 'operations', 'R2 operation analytics were not collected.', requestAuthority),
      unverified('cost', 'Cost', 'billing currency', costNote, costAuthority),
    ];
    return { ...base, present: Boolean(bucket), measures };
  });

  const mappedWorkers = new Set(entries.filter((entry) => entry.kind === 'worker').map((entry) => entry.resourceName));
  const mappedDatabases = new Set(entries.filter((entry) => entry.kind === 'd1').map((entry) => entry.resourceName));
  const mappedBuckets = new Set(entries.filter((entry) => entry.kind === 'r2').map((entry) => entry.resourceName));
  const unallocated = [
    ...observed.workers.filter((worker) => !mappedWorkers.has(worker.id)).map((worker) => ({ kind: 'worker' as const, resourceName: worker.id })),
    ...observed.d1.filter((database) => !mappedDatabases.has(database.name)).map((database) => ({ kind: 'd1' as const, resourceName: database.name })),
    ...observed.r2.filter((bucket) => !mappedBuckets.has(bucket.name)).map((bucket) => ({ kind: 'r2' as const, resourceName: bucket.name })),
  ].slice(0, 200);

  const coverage = measureIds
    .map((measure) => {
      const cells = rows.flatMap((row) => row.measures.filter((entry) => entry.id === measure));
      const measuredCells = cells.filter((entry) => entry.state === 'measured');
      return {
        measure,
        measured: measuredCells.length,
        total: cells.length,
        state: (measuredCells.length === cells.length && cells.length > 0 ? 'complete' : measuredCells.length === 0 ? 'unverified' : 'partial') as 'complete' | 'partial' | 'unverified',
      };
    })
    .filter((entry) => entry.total > 0);

  return {
    contract: attributionContract,
    accountId: observed.accountId,
    capturedAt: observed.capturedAt,
    windowEnd: observed.windowEnd,
    rows,
    coverage,
    unallocated,
    limits: [
      'Storage bytes are a point-in-time provider observation, not an invoice and not a period total.',
      'Requests, CPU and cost remain unverified until a read authority for analytics and billing exists.',
      'An unallocated resource is reported, never assigned to a nearby app name.',
      'A record here is not a budget, a quota or an enforced spend limit.',
    ],
  };
}

/** The exact read authority this adapter needs to stop reporting `unverified`. */
export function missingAuthority() {
  return [
    { measure: 'requests' as MeasureId, authority: requestAuthority },
    { measure: 'cpuMs' as MeasureId, authority: requestAuthority },
    { measure: 'cost' as MeasureId, authority: costAuthority },
  ];
}
