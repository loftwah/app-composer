import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { evaluateScenario } from './_agent-improve-evaluator.mjs';
import { check } from './_checks.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = readFileSync(new URL('../fixtures/agent-improve-01.json', import.meta.url));
const plan = JSON.parse(fixture);
const baselineDigest = sha256(JSON.stringify(plan.baselineConfiguration));
const evaluatorDigest = sha256(readFileSync(new URL('./_agent-improve-evaluator.mjs', import.meta.url)));
const manifestDigest = sha256(fixture);

export const id = 'agent-improve-01';
export const name = 'Agent improvement decisions from synthetic evidence';

export function run() {
  const identity = check('frozen-plan', 'Frozen baseline, workload and evaluator', () => {
    assert.equal(evaluatorDigest, plan.evaluatorSha256, 'independent evaluator bytes match the locked revision');
    assert.match(plan.baselineSource, /^[0-9a-f]{40}$/);
    assert.equal(new Set(plan.tasks.map(task => task.id)).size, 5);
    assert.equal(plan.budget.incrementalMicroUsd, 0);
    return `Fixture SHA-256 ${manifestDigest}; baseline SHA-256 ${baselineDigest}; evaluator SHA-256 ${evaluatorDigest}. Synthetic replay, zero provider calls.`;
  });
  return [identity, ...plan.scenarios.map(scenario => check(scenario.id, scenario.id.replaceAll('-', ' '), () => {
    assert.equal(evaluatorDigest, plan.evaluatorSha256, 'evaluate only with the locked evaluator');
    const task = plan.tasks.find(entry => entry.id === scenario.task);
    assert.ok(task, 'the scenario has a frozen task');
    const result = evaluateScenario(scenario, task, plan, baselineDigest);
    assert.equal(result.decision, scenario.expected);
    return `${result.decision}. ${result.reason} Required checks passed: baseline ${result.baselinePassed}/${result.required}, candidate ${result.candidatePassed}/${result.required}.`;
  }))];
}
