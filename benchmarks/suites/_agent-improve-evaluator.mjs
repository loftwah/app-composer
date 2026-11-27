export function evaluateScenario(scenario, task, plan, baselineDigest) {
  const { baseline, candidate } = scenario;
  const metrics = Object.entries(plan.budget);
  const required = plan.requiredChecks;
  const result = (decision, reason, delta = null) => ({
    decision,
    reason,
    delta,
    baselinePassed: required.filter(key => baseline.evidence[key] === 'pass').length,
    candidatePassed: required.filter(key => candidate.evidence[key] === 'pass').length,
    required: required.length,
  });

  if (scenario.evaluator !== plan.evaluator) return result('stopped', 'Evaluator identity changed.');
  if (scenario.baselineDigest !== baselineDigest) return result('stopped', 'Baseline configuration is stale.');
  if (metrics.some(([key]) => [baseline, candidate].some(attempt =>
    !Number.isSafeInteger(attempt[key]) || attempt[key] < 0))) {
    return result('investigate', 'A required resource value is missing or invalid.');
  }
  if (metrics.some(([key, ceiling]) => [baseline, candidate].some(attempt => attempt[key] > ceiling))) {
    return result('stopped', 'The simulated attempt exceeded a predeclared resource ceiling.');
  }
  if (required.some(key => baseline.evidence[key] !== 'pass')) {
    return result('investigate', 'The baseline lacks a complete passing denominator.');
  }
  if (required.some(key => candidate.evidence[key] === 'fail')) {
    return result('reject', 'At least one required quality, safety, correctness or recovery check failed.');
  }
  if (required.some(key => candidate.evidence[key] !== 'pass')) {
    return result('investigate', 'Candidate evidence is blocked, incomplete or unverified.');
  }

  const delta = baseline[task.metric] - candidate[task.metric];
  if (delta < 0 || metrics.some(([key]) => key !== task.metric && candidate[key] > baseline[key])) {
    return result('reject', 'A measured dimension regressed in the synthetic fixture.', delta);
  }
  if (delta < task.minimum) return result('retain', 'The change is below the predeclared minimum.', delta);
  return result('accepted-in-simulation', 'The fixture clears every required check and the improvement minimum.', delta);
}
