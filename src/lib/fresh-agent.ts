/** Bounded fresh-agent evaluation helpers.
 *
 * A run is only evidence if the session could not read this repository, its
 * evaluation fixtures or the assertion list. The isolation check is what makes
 * that claim falsifiable: an agent that saw the harness cannot be reported as a
 * clean fresh-agent pass, whatever its assertions say.
 */
export interface IsolationReport {
  clean: boolean;
  hits: Record<string, number>;
}

export type FreshAgentOutcome = 'passed' | 'refused-as-expected' | 'failed' | 'contaminated';

/** Count references to evaluation-only material in a session transcript. */
export function isolationReport(log: string, markers: readonly string[]): IsolationReport {
  const hits: Record<string, number> = {};
  for (const marker of markers) {
    if (!marker) continue;
    const count = log.split(marker).length - 1;
    if (count > 0) hits[marker] = count;
  }
  return { clean: Object.keys(hits).length === 0, hits };
}

/** Contamination outranks every other outcome: it cannot be reported as a pass. */
export function classifyFreshAgentRun(input: { passed: boolean; expectsDecision: boolean; isolation: IsolationReport }): FreshAgentOutcome {
  if (!input.isolation.clean) return 'contaminated';
  if (!input.passed) return 'failed';
  return input.expectsDecision ? 'refused-as-expected' : 'passed';
}

export interface FreshAgentReceiptSummary {
  case: string;
  task: string;
  outcome: FreshAgentOutcome;
  passed: number;
  total: number;
  durationMs: number;
  agent: string;
  model: string;
  isolation: IsolationReport;
}

export interface FreshAgentReceiptLike {
  case: string;
  task: string;
  outcome: FreshAgentOutcome;
  passed: number;
  total: number;
  durationMs: number;
  agent: string;
  model: string;
  isolation?: IsolationReport;
}

/** Reduce raw receipts to the bounded facts that belong in the repository. */
export function summariseFreshAgentReceipts(receipts: readonly FreshAgentReceiptLike[]): FreshAgentReceiptSummary[] {
  return receipts
    .map((receipt) => ({
      case: receipt.case,
      task: receipt.task,
      outcome: receipt.outcome,
      passed: receipt.passed,
      total: receipt.total,
      durationMs: receipt.durationMs,
      agent: receipt.agent,
      model: receipt.model,
      isolation: receipt.isolation ?? { clean: false, hits: { unknown: 1 } },
    }))
    .sort((a, b) => a.case.localeCompare(b.case));
}

/** An evaluation case that cannot be reproduced from the repository is not a case. */
export function validateFreshAgentCase(value: unknown): string[] {
  const problems: string[] = [];
  if (!value || typeof value !== 'object') return ['case must be an object'];
  const entry = value as Record<string, unknown>;
  for (const key of ['id', 'task', 'title', 'fixture', 'prompt']) {
    if (typeof entry[key] !== 'string' || (entry[key] as string).trim().length < 1) problems.push(`missing ${key}`);
  }
  if (typeof entry.id === 'string' && !/^[a-z0-9-]+$/.test(entry.id)) problems.push('unsafe id');
  if (!Array.isArray(entry.assertions) || entry.assertions.length === 0) problems.push('no assertions');
  for (const assertion of Array.isArray(entry.assertions) ? entry.assertions : []) {
    if (!assertion || typeof assertion !== 'object' || typeof (assertion as { type?: unknown }).type !== 'string') { problems.push('assertion without a type'); continue; }
    for (const key of ['path', 'pattern']) {
      const path = (assertion as Record<string, unknown>)[key];
      if (typeof path === 'string' && (path.startsWith('/') || path.split('/').includes('..'))) problems.push(`unsafe ${key} ${path}`);
    }
  }
  if ('export' in entry && (typeof entry.export !== 'object' || entry.export === null)) problems.push('unsupported export block');
  return problems;
}
