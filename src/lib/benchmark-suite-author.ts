import { BENCHMARK_SUITE_SCHEMA, validateBenchmarkSuite } from './benchmark-suite.mjs';

export type SuiteAuthorBase = {
  id: string;
  name: string;
  directory: 'benchmarks/suites' | 'benchmarks/cloudflare-composition';
  checks: { module: string; id: string }[];
};

export function createSuiteDefinition(
  base: SuiteAuthorBase,
  picked: number[],
  fields: { id: string; name: string; description: string },
  knownIds: string[],
) {
  const id = fields.id.trim();
  if (knownIds.includes(id)) return { spec: null, issues: ['That suite ID already exists in this catalogue. Choose a new one.'] };
  if (!picked.length || new Set(picked).size !== picked.length ||
      picked.some(index => !Number.isInteger(index) || !base.checks[index])) {
    return { spec: null, issues: ['Choose at least one distinct check from the selected pack.'] };
  }

  const spec = {
    schema: BENCHMARK_SUITE_SCHEMA,
    id,
    name: fields.name.trim(),
    description: fields.description.trim(),
    kind: 'deterministic',
    providerFree: true,
    requirements: { network: false, credentials: [], spendMicro: 0 },
    checks: picked.map(index => ({ module: base.checks[index].module, id: base.checks[index].id })),
    evidence: { status: 'not-run', note: 'This definition has no recorded results. Save the output of a local run to collect evidence.' },
    limits: [
      'This pack reports the selected deterministic checks from the chosen repository checkout.',
      'Model quality, performance and production user journeys need separate evidence.',
    ],
  };
  const validation = validateBenchmarkSuite(spec);
  return { spec: validation.ok ? spec : null, issues: validation.issues.map(issue => issue.detail) };
}
