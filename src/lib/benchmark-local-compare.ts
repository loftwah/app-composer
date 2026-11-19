import type { parseLocalBenchmarkResult } from './benchmark-local-result';

type LocalResult = ReturnType<typeof parseLocalBenchmarkResult>;
type LocalSuite = LocalResult['suites'][number];
type LocalCheck = LocalSuite['checks'][number];

function index<T extends { id: string }>(items: T[]) {
  const byId = new Map(items.map(item => [item.id, item]));
  return byId.size === items.length ? byId : null;
}

/** Compare check statuses only when both files describe the same distinct checks. */
export function compareLocalBenchmarkChecks(baseline: LocalResult, current: LocalResult) {
  const baselineSuites = index(baseline.suites);
  const currentSuites = index(current.suites);
  if (baseline.packId !== current.packId || !baselineSuites || !currentSuites ||
      baselineSuites.size !== currentSuites.size) return null;

  const changes: Array<{ suite: string; check: string; before: LocalCheck['status']; after: LocalCheck['status'] }> = [];
  for (const suite of current.suites) {
    const previousSuite = baselineSuites.get(suite.id);
    if (previousSuite?.name !== suite.name) return null;
    const baselineChecks = index(previousSuite.checks);
    const currentChecks = index(suite.checks);
    if (!baselineChecks || !currentChecks || baselineChecks.size !== currentChecks.size) return null;

    for (const check of suite.checks) {
      const previousCheck = baselineChecks.get(check.id);
      if (previousCheck?.name !== check.name) return null;
      if (previousCheck.status !== check.status) {
        changes.push({ suite: suite.name, check: check.name, before: previousCheck.status, after: check.status });
      }
    }
  }
  return changes;
}
