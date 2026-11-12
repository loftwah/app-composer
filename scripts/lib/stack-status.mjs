// Build the read-only Stack status snapshot used by the native EmDash page.
//
// The snapshot is generated from committed policy/lockfile data, the local
// node_modules metadata (when present) and the last explicit registry report.
// Generating it never calls the registry: `pnpm freshness:remote` owns that
// opt-in network check, and its JSON report is committed separately.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  defaultNodeVersion,
  lockfileManagerVersion,
  parseVersion,
  pnpmFromUserAgent,
  readLockfileImporter,
  runtimeStatus,
  satisfies,
} from '../freshness.mjs';

export const REMOTE_REPORT_MAX_AGE_DAYS = 14;

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} could not be read as JSON: ${error.message}`);
  }
}

function statusFor(version, supported) {
  if (!version) return 'unresolved';
  if (!supported) return 'unknown';
  try {
    return satisfies(version, supported) ? 'ok' : 'drift';
  } catch {
    return 'unknown';
  }
}

function classifyRemote(report, name) {
  if (!report) {
    return {
      state: 'unknown',
      latest: null,
      checkedAt: null,
      classification: 'unknown',
      reason: 'No committed registry report is available.',
      latestQualified: null,
      advisory: null,
    };
  }
  const entry = report.packages.find((pkg) => pkg.name === name);
  if (!entry || !entry.remote) {
    return {
      state: 'unknown',
      latest: null,
      checkedAt: report.checkedAt ?? null,
      classification: 'unknown',
      reason: `The committed registry report has no entry for ${name}.`,
      latestQualified: null,
      advisory: null,
    };
  }
  const remote = entry.remote;
  const classification =
    typeof remote.classification === 'string' && remote.classification
      ? remote.classification
      : 'unknown';
  return {
    state: remote.state === 'available' ? 'available' : 'unknown',
    latest: typeof remote.latest === 'string' ? remote.latest : null,
    checkedAt: typeof report.checkedAt === 'string' ? report.checkedAt : null,
    classification,
    reason: typeof remote.reason === 'string' && remote.reason ? remote.reason : null,
    latestQualified:
      typeof remote.latestQualified === 'boolean' ? remote.latestQualified : null,
    advisory:
      remote.advisory && typeof remote.advisory === 'object'
        ? {
            id: remote.advisory.id ?? null,
            severity: remote.advisory.severity ?? 'unknown',
            title: remote.advisory.title ?? null,
            url: remote.advisory.url ?? null,
            vulnerableVersions: remote.advisory.vulnerableVersions ?? null,
          }
        : null,
  };
}

function remoteAgeDays(checkedAt, now) {
  if (!checkedAt) return null;
  const time = Date.parse(checkedAt);
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / 86400000));
}

function detailWithNote(detail, note) {
  return note ? `${detail} Policy note: ${note}` : detail;
}

export function remoteState(report, now = new Date(), issue = null) {
  if (!report) {
    return {
      state: 'unknown',
      checkedAt: null,
      registry: null,
      reason:
        issue ??
        'No committed registry report. Run `node scripts/freshness.mjs --remote --write config/dependency-remote.json` from a reviewed checkout.',
      ageDays: null,
      maxAgeDays: REMOTE_REPORT_MAX_AGE_DAYS,
    };
  }
  const ageDays = remoteAgeDays(report.checkedAt, now);
  if (ageDays === null) {
    return {
      state: 'unknown',
      checkedAt: report.checkedAt ?? null,
      registry: report.registry ?? null,
      reason: 'The committed registry report has no usable check time.',
      ageDays: null,
      maxAgeDays: REMOTE_REPORT_MAX_AGE_DAYS,
    };
  }
  if (ageDays > REMOTE_REPORT_MAX_AGE_DAYS) {
    return {
      state: 'stale',
      checkedAt: report.checkedAt,
      registry: report.registry ?? null,
      reason: `The registry report is ${ageDays} days old; the reviewed maximum is ${REMOTE_REPORT_MAX_AGE_DAYS}. Run the remote freshness command again.`,
      ageDays,
      maxAgeDays: REMOTE_REPORT_MAX_AGE_DAYS,
    };
  }
  return {
    state: 'available',
    checkedAt: report.checkedAt,
    registry: report.registry ?? null,
    reason: null,
    ageDays,
    maxAgeDays: REMOTE_REPORT_MAX_AGE_DAYS,
  };
}

export function buildStackStatus({
  policy,
  manifest,
  importer,
  lockfile = '',
  installed,
  nodeVersion = process.versions.node,
  pnpmVersion = pnpmFromUserAgent(),
  nodeDefault = null,
  remoteReport = null,
  remoteIssue = null,
  build,
  now = new Date(),
}) {
  const remote = remoteState(remoteReport, now, remoteIssue);
  const declaredPnpm = /^pnpm@(.+)$/.exec(manifest.packageManager ?? '')?.[1] ?? null;
  const upstreamFor = (name) => {
    const entry = remoteReport?.upstream?.[name];
    if (!entry) {
      return {
        state: 'unknown',
        latest: null,
        checkedAt: null,
        classification: 'unknown',
        reason: 'No committed registry report is available.',
      };
    }
    return {
      state: entry.state === 'available' ? 'available' : 'unknown',
      latest:
        name === 'node'
          ? entry.latestLts?.version ?? null
          : typeof entry.latest === 'string'
            ? entry.latest
            : null,
      checkedAt: typeof entry.checkedAt === 'string' ? entry.checkedAt : null,
      classification: remote.state === 'available' ? 'available' : 'unknown',
      reason: typeof entry.reason === 'string' ? entry.reason : null,
    };
  };
  const runtime = [
    {
      name: 'node',
      declared: manifest.engines?.node ?? null,
      default: nodeDefault ?? policy.runtime?.nodeDefault ?? null,
      installed: nodeVersion,
      observed: Boolean(nodeVersion),
      locked: null,
      policy: policy.runtime?.node ?? null,
      tested: Array.isArray(policy.runtime?.nodeTested) ? policy.runtime.nodeTested : [],
      status: runtimeStatus({
        declared: manifest.engines?.node ?? null,
        selectedDefault: nodeDefault ?? policy.runtime?.nodeDefault ?? null,
        installed: nodeVersion,
        supported: policy.runtime?.node,
      }),
      upstream: upstreamFor('node'),
    },
    {
      name: 'pnpm',
      declared: declaredPnpm,
      default: declaredPnpm,
      installed: pnpmVersion,
      observed: Boolean(pnpmVersion),
      locked: lockfileManagerVersion(lockfile),
      policy: policy.runtime?.pnpm ?? null,
      tested: Array.isArray(policy.runtime?.pnpmTested) ? policy.runtime.pnpmTested : [],
      status: declaredPnpm
        ? runtimeStatus({
            declared: declaredPnpm,
            selectedDefault: declaredPnpm,
            installed: pnpmVersion,
            supported: policy.runtime?.pnpm,
          })
        : 'unresolved',
      upstream: upstreamFor('pnpm'),
    },
  ].filter((row) => row.policy);
  const packages = Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  }).map(([name, declared]) => {
    const entry = policy.packages?.[name];
    const deployed = importer.get(name)?.version ?? null;
    const local = installed.get(name) ?? null;
    const supported = entry?.supported ?? null;
    const status = statusFor(deployed, supported);
    const remoteEntry = classifyRemote(
      remote.state === 'available' ? remoteReport : null,
      name,
    );
    return {
      name,
      declared,
      installed: local,
      deployed,
      latestTested: entry?.reviewed ?? null,
      supported,
      note: entry?.note ?? null,
      status,
      remote:
        remote.state === 'available'
          ? remoteEntry
          : {
              ...remoteEntry,
              state: 'unknown',
              latest: null,
              classification: 'unknown',
              reason: remote.reason,
              advisory: null,
            },
    };
  });
  const blockers = [];
  for (const row of runtime) {
    if (['drift', 'unresolved', 'unknown'].includes(row.status)) {
      blockers.push({
        kind: 'runtime',
        name: row.name,
        detail: `${row.name} ${row.installed ?? 'unknown'} is outside the reviewed policy ${row.policy ?? '(missing)'}.`,
      });
    }
  }
  for (const pkg of packages) {
    if (pkg.status === 'unknown') {
      blockers.push({
        kind: 'policy',
        name: pkg.name,
        detail: `No reviewed policy entry qualifies deployed ${pkg.deployed ?? 'unknown'}.`,
      });
      continue;
    }
    if (pkg.status === 'drift') {
      blockers.push({
        kind: 'unsupported',
        name: pkg.name,
        detail: detailWithNote(
          `Deployed ${pkg.deployed} is outside the reviewed range ${pkg.supported}.`,
          pkg.note,
        ),
      });
    }
    if (remote.state !== 'available') continue;
    if (pkg.remote.classification === 'security-urgent') {
      const advisory = pkg.remote.advisory;
      blockers.push({
        kind: 'security',
        name: pkg.name,
        detail: `Registry advisory${advisory?.id ? ` ${advisory.id}` : ''} (${advisory?.severity ?? 'unknown'} severity) affects deployed ${pkg.deployed}: ${advisory?.title ?? 'review the advisory'}.`,
        url: advisory?.url ?? null,
      });
    } else if (
      pkg.remote.classification === 'unsupported' &&
      pkg.status === 'ok'
    ) {
      blockers.push({
        kind: 'unsupported',
        name: pkg.name,
        detail: detailWithNote(
          pkg.remote.reason ?? `Deployed ${pkg.deployed} is not qualified.`,
          pkg.note,
        ),
      });
    } else if (pkg.remote.classification === 'breaking-major') {
      blockers.push({
        kind: 'breaking',
        name: pkg.name,
        detail: detailWithNote(
          pkg.remote.reason ??
            `Available ${pkg.remote.latest} is a breaking major outside the reviewed range ${pkg.supported}.`,
          pkg.note,
        ),
      });
    } else if (pkg.remote.classification === 'unknown') {
      blockers.push({
        kind: 'remote',
        name: pkg.name,
        detail: pkg.remote.reason ?? 'The registry comparison is unknown.',
      });
    }
  }
  if (remote.state !== 'available') {
    blockers.push({
      kind: 'remote',
      name: 'registry',
      detail: remote.reason,
    });
  }
  const blockerOrder = [
    'security',
    'unsupported',
    'breaking',
    'runtime',
    'policy',
    'remote',
  ];
  blockers.sort(
    (left, right) =>
      blockerOrder.indexOf(left.kind) - blockerOrder.indexOf(right.kind),
  );
  const status = blockers.some((blocker) => blocker.kind === 'security')
    ? 'security'
    : blockers.some((blocker) =>
          ['unsupported', 'breaking', 'runtime', 'policy'].includes(blocker.kind),
        )
      ? 'attention'
      : blockers.length > 0
        ? 'unknown'
        : 'ok';
  return {
    contract: 1,
    generatedAt: now.toISOString(),
    review: { date: policy.reviewed ?? null },
    deployed: {
      commit: build.commit,
      sourceCommittedAt: build.sourceCommittedAt,
      workerVersion: null,
      note: 'The exact Worker version and release receipt stay in #11; this page is generated from the deployed build inputs.',
    },
    remote,
    runtime,
    packages,
    blockers,
    status,
  };
}

export function buildStackStatusFromRepository({
  root,
  build,
  now = new Date(),
  remotePath = join(root, 'config', 'dependency-remote.json'),
}) {
  const manifest = readJson(join(root, 'package.json'), 'package.json');
  const policy = readJson(
    join(root, 'config', 'dependency-policy.json'),
    'dependency policy',
  );
  let lockfile;
  try {
    lockfile = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
  } catch (error) {
    throw new Error(`pnpm-lock.yaml could not be read: ${error.message}`);
  }
  const importer = readLockfileImporter(lockfile);
  const installed = new Map();
  for (const name of [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]) {
    try {
      const metadata = readJson(
        join(root, 'node_modules', name, 'package.json'),
        `${name} metadata`,
      );
      if (typeof metadata.version === 'string') {
        parseVersion(metadata.version);
        installed.set(name, metadata.version);
      }
    } catch {
      // A missing or malformed local install is distinct from the deployed pin.
    }
  }
  let remoteReport = null;
  let remoteIssue = null;
  try {
    const candidate = JSON.parse(readFileSync(remotePath, 'utf8'));
    if (
      candidate?.kind === 'app-composer.dependency-freshness' &&
      candidate?.contract === 1 &&
      candidate?.mode === 'remote' &&
      Array.isArray(candidate.packages)
    ) {
      remoteReport = candidate;
    } else {
      remoteIssue =
        'The committed registry report has an unsupported shape. Regenerate it with the remote freshness command.';
    }
  } catch (error) {
    remoteIssue =
      error.code === 'ENOENT'
        ? null
        : `The committed registry report could not be read: ${error.message}`;
  }
  return buildStackStatus({
    policy,
    manifest,
    importer,
    lockfile,
    installed,
    nodeDefault: defaultNodeVersion(root),
    remoteReport,
    remoteIssue,
    build,
    now,
  });
}
