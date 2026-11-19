import { z } from 'zod';

const MAX_CHECKS = 1000;
const id = z.string().min(1).max(200);
const name = z.string().min(1).max(300);
const check = z.object({
  id,
  name,
  status: z.enum(['pass', 'fail', 'blocked']),
  detail: z.string().max(8000),
});
const nativeResult = z.object({
  source: z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/),
  generatedAt: z.iso.datetime(),
  suites: z.array(z.object({
    id,
    name,
    checks: z.array(check).min(1).max(MAX_CHECKS),
  })).min(1).max(100),
  pack: z.object({ id }).optional(),
});

/** Inspect the native runner's data without trusting file totals or running a suite. */
export function parseLocalBenchmarkResult(data: unknown) {
  const { source, generatedAt, suites, pack } = nativeResult.parse(data);
  const totals = { checks: 0, pass: 0, fail: 0, blocked: 0 };
  for (const suite of suites) {
    totals.checks += suite.checks.length;
    for (const check of suite.checks) totals[check.status] += 1;
  }
  if (totals.checks > MAX_CHECKS) throw new RangeError('Too many benchmark checks');
  return { source, generatedAt, packId: pack?.id, suites, totals };
}
