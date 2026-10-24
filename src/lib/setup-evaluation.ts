/** Sanitised, observed fresh-agent records. Export tests never enter this ledger. */
export const setupEvaluationSchema = 'app-composer.setup-evaluation/1';
export const evaluationPaths = ['new', 'existing', 'prepared', 'resume', 'follow-up', 'failure'] as const;
export const evaluationOutcomes = ['completed', 'completed-after-rescue', 'blocked', 'failed'] as const;
export interface SetupEvaluationRun {
  id: string;
  guideVersion: string;
  guideHash: string;
  path: typeof evaluationPaths[number];
  fixture: string;
  sourceCommit: string;
  agent: string;
  model: string;
  environment: string;
  tools: string[];
  provisionedAccess: string[];
  startedAt: string;
  finishedAt: string;
  outcome: typeof evaluationOutcomes[number];
  simulated: boolean;
  checks: { command: string; outcome: string }[];
  interventions: string[];
  evidence: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function text(value: unknown, max = 600): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
function list(value: unknown, max = 30): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((entry) => text(entry));
}
function utcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) return false;
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return false;
  return new Date(stamp).toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z'));
}
function evidenceReference(value: unknown): value is string {
  if (!text(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search &&
      /^\/loftwah\/[a-z0-9-]+\/(issues\/\d+|pull\/\d+(\/files)?|blob\/[a-zA-Z0-9._/-]+)$/.test(url.pathname);
  } catch { return false; }
}

export function validateSetupEvaluation(value: unknown): SetupEvaluationRun[] {
  if (!record(value) || value.schema !== setupEvaluationSchema || !Array.isArray(value.runs) || value.runs.length > 1000 || Object.keys(value).some((key) => !['schema', 'runs'].includes(key))) throw new Error('Expected a bounded versioned setup-evaluation ledger.');
  const ids = new Set<string>();
  const allowed = ['id', 'guideVersion', 'guideHash', 'path', 'fixture', 'sourceCommit', 'agent', 'model', 'environment', 'tools', 'provisionedAccess', 'startedAt', 'finishedAt', 'outcome', 'simulated', 'checks', 'interventions', 'evidence'];
  return value.runs.map((run: unknown) => {
    if (!record(run) || Object.keys(run).some((key) => !allowed.includes(key)) || allowed.some((key) => !Object.hasOwn(run, key))) throw new Error('Run fields are missing or unsupported.');
    if (!text(run.id, 80) || !/^[a-z0-9][a-z0-9-]+$/.test(run.id) || ids.has(run.id)) throw new Error('Run identifiers must be unique safe labels.');
    ids.add(run.id);
    for (const key of ['guideVersion', 'fixture', 'agent', 'model', 'environment']) if (!text(run[key])) throw new Error(`Missing bounded ${key}.`);
    if (typeof run.guideHash !== 'string' || !/^[a-f0-9]{64}$/.test(run.guideHash)) throw new Error('Record the SHA-256 of the actual UI export.');
    if (typeof run.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(run.sourceCommit)) throw new Error('Record the full fixture source commit.');
    if (!(evaluationPaths as readonly unknown[]).includes(run.path) || !(evaluationOutcomes as readonly unknown[]).includes(run.outcome)) throw new Error('Unsupported evaluation path or outcome.');
    if (typeof run.simulated !== 'boolean' || !list(run.tools) || !list(run.provisionedAccess) || !list(run.interventions)) throw new Error('Record tools, provisioned access, interventions and simulation scope.');
    const timestamps = [run.startedAt, run.finishedAt];
    if (timestamps.some((stamp) => !utcTimestamp(stamp))) throw new Error('Use valid explicit UTC timestamps.');
    if (Date.parse(run.finishedAt as string) < Date.parse(run.startedAt as string)) throw new Error('Run finish precedes its start.');
    if (!Array.isArray(run.checks) || run.checks.length === 0 || run.checks.length > 40 || run.checks.some((check) => !record(check) || Object.keys(check).some((key) => !['command', 'outcome'].includes(key)) || !text(check.command) || !text(check.outcome))) throw new Error('Independent checks and observed outcomes are required.');
    if (!evidenceReference(run.evidence)) throw new Error('Use a stable public source or issue evidence reference without query values.');
    if (run.outcome === 'completed' && run.interventions.length > 0) throw new Error('Disclose rescue separately from first-attempt completion.');
    if (run.outcome === 'completed-after-rescue' && run.interventions.length === 0) throw new Error('Record the intervention that rescued this attempt.');
    return run as unknown as SetupEvaluationRun;
  });
}

export function summariseSetupEvaluations(runs: SetupEvaluationRun[], guideVersion: string) {
  return evaluationPaths.map((path) => {
    const matching = runs.filter((run) => run.guideVersion === guideVersion && run.path === path);
    const ordered = [...matching].sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
    return {
      path,
      attempts: matching.length,
      completed: matching.filter((run) => run.outcome === 'completed' && !run.simulated).length,
      rescued: matching.filter((run) => run.outcome === 'completed-after-rescue' && !run.simulated).length,
      blocked: matching.filter((run) => run.outcome === 'blocked').length,
      failed: matching.filter((run) => run.outcome === 'failed').length,
      simulated: matching.filter((run) => run.simulated).length,
      latest: ordered.at(-1) ?? null,
    };
  });
}
