/**
 * Browser-local parser for a benchmark result exported by benchmarks/runner.mjs.
 * Pure data: it never executes the file, writes storage or contacts a server.
 * A malformed result throws so the caller can keep the last valid report.
 */

export interface LocalBenchmarkCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'blocked';
  detail: string;
}

export interface LocalBenchmarkSuite {
  id: string;
  name: string;
  checks: LocalBenchmarkCheck[];
}

export interface LocalBenchmarkTotals {
  checks: number;
  pass: number;
  fail: number;
  blocked: number;
}

export interface LocalBenchmarkResult {
  source: string;
  generatedAt: string;
  packId: string | null;
  suites: LocalBenchmarkSuite[];
  totals: LocalBenchmarkTotals;
}

const STATUSES = new Set(['pass', 'fail', 'blocked']);

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validate and normalise a parsed result file. Totals are recomputed from the
 * actual checks rather than trusted from the file, so the counts are true.
 * @throws {TypeError} when the data is not a well-formed benchmark result.
 */
export function parseLocalBenchmarkResult(data: unknown): LocalBenchmarkResult {
  if (!isRecord(data)) throw new TypeError('the file is not a benchmark result object');

  const rawSuites = data.suites;
  if (!Array.isArray(rawSuites) || rawSuites.length === 0)
    throw new TypeError('the result has no suites');

  const suites: LocalBenchmarkSuite[] = rawSuites.map((raw, index) => {
    if (!isRecord(raw)) throw new TypeError(`suite ${index + 1} is not an object`);
    const id = text(raw.id);
    if (!id) throw new TypeError(`suite ${index + 1} has no id`);

    const rawChecks = raw.checks;
    if (!Array.isArray(rawChecks) || rawChecks.length === 0)
      throw new TypeError(`suite “${id}” has no checks`);

    const checks: LocalBenchmarkCheck[] = rawChecks.map((rawCheck, checkIndex) => {
      if (!isRecord(rawCheck))
        throw new TypeError(`check ${checkIndex + 1} in suite “${id}” is not an object`);
      const checkId = text(rawCheck.id);
      if (!checkId) throw new TypeError(`check ${checkIndex + 1} in suite “${id}” has no id`);
      const status = text(rawCheck.status);
      if (!STATUSES.has(status))
        throw new TypeError(`check “${checkId}” has an unsupported status`);
      return {
        id: checkId,
        name: text(rawCheck.name, checkId),
        status: status as LocalBenchmarkCheck['status'],
        detail: text(rawCheck.detail),
      };
    });

    return { id, name: text(raw.name, id), checks };
  });

  const totals: LocalBenchmarkTotals = { checks: 0, pass: 0, fail: 0, blocked: 0 };
  for (const suite of suites) {
    for (const check of suite.checks) {
      totals.checks += 1;
      totals[check.status] += 1;
    }
  }

  const packId = isRecord(data.pack) ? text(data.pack.id) : '';

  return {
    source: text(data.source, 'unknown') || 'unknown',
    generatedAt: text(data.generatedAt, 'unknown') || 'unknown',
    packId: packId || null,
    suites,
    totals,
  };
}
