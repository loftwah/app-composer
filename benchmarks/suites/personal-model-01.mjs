import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { check } from './_checks.mjs';
import { evaluateScenario } from './_agent-improve-evaluator.mjs';

const fixtureBytes = readFileSync(new URL('../fixtures/personal-model-01.json', import.meta.url));
const plan = JSON.parse(fixtureBytes);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const laneIds = ['prompt', 'retrieval', 'text-finetune', 'scratch-training', 'voice-reference', 'voice-finetune', 'voice-conversion'];

// A pure rehearsal of admission arithmetic. This does not submit, reserve,
// cancel, settle or enforce a provider's bill. All examples are fictional.
function mockBudgetDecision(example) {
  if (example.unknownEffects.length || example.quote.effectState !== 'new')
    return 'reconcile';
  const amounts = [
    ...example.settled.map(item => item.amountAudCents),
    ...example.reservations.map(item => item.worstCaseAudCents),
    example.quote.worstCaseAudCents,
  ];
  if (example.quote.currency !== 'AUD' || example.quote.fxAndFeesIncluded !== true ||
      amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0))
    return 'quote-required';
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total)) return 'quote-required';
  return total < plan.budget.strictCeilingAudCents ? 'admit-in-simulation' : 'stop';
}

// Deliberately narrow mock: group IDs must keep related episodes together.
// This is not a semantic contamination detector or a complete corpus audit.
function groupedSplitsClean(rows) {
  const seen = new Map();
  return rows.every(row => {
    const previous = seen.get(row.group);
    seen.set(row.group, row.split);
    return previous === undefined || previous === row.split;
  });
}
const positiveLabelsSupported = rows => rows.every(row => !row.positive || row.outcome === 'accepted');

export const id = 'personal-model-01';
export const name = 'Personal model and voice experiment mock';

export function run() {
  const checks = [
    check('mock-boundary', 'Seven lanes remain unrun with no provider side effects', () => {
      assert.equal(plan.mode, 'synthetic-mock');
      assert.deepEqual(plan.lanes.map(lane => lane.id), laneIds);
      assert.deepEqual(plan.scope, { network: false, providerCalls: 0, modelDownloads: 0, trainingJobs: 0, productionChanges: 0 });
      assert.equal(plan.actualIncrementalSpendAud, 0);
      assert.equal(plan.providerBillingEnforcement, false);
      for (const lane of plan.lanes) {
        assert.equal(lane.status, 'not-run');
        assert.ok(Object.values(lane.measured).every(value => value === null));
      }
      return 'Fixture SHA-256 ' + sha256(fixtureBytes) + '. Seven plans, no measured model scores, inference or training.';
    }),
    check('prompt-variables', 'Prompt and retrieval variables are recorded separately', () => {
      assert.notEqual(plan.prompts.A.system, plan.prompts.B.system);
      assert.equal(plan.prompts.B.system, plan.prompts.C.system);
      assert.equal(plan.prompts.B.variable, 'system-prompt');
      assert.equal(plan.prompts.C.variable, 'retrieval-context');
      assert.match(plan.prompts.C.retrievalContext, /^SYNTHETIC EXAMPLE ONLY:/);
      return 'A/B change the system prompt; B/C preserve the system prompt and change retrieval. No prompt comparison has run.';
    }),
    check('shared-budget', 'All experiment lanes share one strict AUD ceiling', () => {
      assert.equal(plan.budget.currency, 'AUD');
      assert.equal(plan.budget.strictCeilingAudCents, 25000);
      const allocated = plan.budget.allocations.reduce((sum, item) => sum + item.audCents, 0);
      assert.equal(allocated, 24000);
      assert.equal(plan.budget.plannedAudCents, allocated);
      assert.ok(allocated < plan.budget.strictCeilingAudCents);
      return 'A$240 planned including overhead and contingency; A$250 is a strict shared ceiling, not a per-run allowance.';
    }),
    check('budget-admit', 'A fully quoted bounded proposal can pass the mock', () => {
      assert.equal(mockBudgetDecision(plan.budgetExamples.bounded), 'admit-in-simulation');
      return 'Fictional A$40 settled + A$60 reserved + A$55 all-inclusive quote = A$155.';
    }),
    check('budget-strict-cap', 'An exact A$250 proposal is refused', () => {
      assert.equal(mockBudgetDecision(plan.budgetExamples.exactCap), 'stop');
      assert.equal(mockBudgetDecision(plan.budgetExamples.underCap), 'admit-in-simulation');
      return 'A$250.00 is refused; A$249.99 satisfies the arithmetic only. This does not authorise or enforce billing.';
    }),
    check('active-reservations', 'Active worst-case reservations count before another job', () => {
      assert.equal(mockBudgetDecision(plan.budgetExamples.activeReservations), 'stop');
      return 'Fictional A$80 settled + A$80 active + A$100 proposed = A$260: stop.';
    }),
    check('uncertain-effects', 'Unknown remote effects prevent a duplicate submission', () => {
      assert.equal(mockBudgetDecision(plan.budgetExamples.uncertainRetry), 'reconcile');
      return 'Reconcile the existing operation before resubmission; its reservation remains counted.';
    }),
    check('retry-charges', 'Retry accounting retains failed charged attempts', () => {
      assert.equal(plan.budgetExamples.chargedRetry.settled[0].status, 'failed-but-charged');
      assert.equal(mockBudgetDecision(plan.budgetExamples.chargedRetry), 'stop');
      return 'A$30 failed-but-charged plus a proposed A$220 retry reaches the strict ceiling and is refused.';
    }),
    check('storage-after-stop', 'Stopping compute does not erase retained storage cost', () => {
      assert.equal(plan.budgetExamples.stoppedCompute.computeState, 'stopped');
      assert.equal(plan.budgetExamples.stoppedCompute.reservations[0].kind, 'storage');
      assert.equal(mockBudgetDecision(plan.budgetExamples.stoppedCompute), 'stop');
      return 'Fictional A$230 settled + A$3 retained storage + A$19 proposed = A$252: stop.';
    }),
    check('incomplete-quote', 'Missing price, FX or fees cannot pass as free', () => {
      assert.equal(mockBudgetDecision(plan.budgetExamples.incompleteQuote), 'quote-required');
      return 'An unknown or unconverted quote requires a bounded all-inclusive AUD quote; no fabricated zero cost.';
    }),
    check('dataset-group-split', 'A known related-episode split leak is rejected', () => {
      assert.equal(groupedSplitsClean(plan.datasetExamples.clean), true);
      assert.equal(groupedSplitsClean(plan.datasetExamples.leaked), false);
      return 'The same synthetic episode cannot appear in both training and held-out sets. Semantic leakage remains separately unverified.';
    }),
    check('positive-outcome-label', 'Unknown and rejected outcomes are not positive targets', () => {
      assert.equal(positiveLabelsSupported(plan.datasetExamples.clean), true);
      assert.equal(positiveLabelsSupported(plan.datasetExamples.unknownPositive), false);
      assert.equal(positiveLabelsSupported(plan.datasetExamples.rejectedPositive), false);
      return 'Only an explicitly accepted outcome qualifies in this synthetic label check; acceptance provenance is not fabricated.';
    }),
    check('voice-prerequisite', 'Missing own-voice recordings remain visible', () => {
      for (const lane of plan.lanes.filter(item => item.id.startsWith('voice'))) {
        assert.equal(lane.prerequisites.recordings, 'missing');
        assert.equal(lane.status, 'not-run');
        assert.equal(lane.measured.quality, null);
      }
      return 'Voice reference, adaptation and conversion are separate unrun lanes. No tone fixture or transcript is called a voice clone.';
    }),
  ];
  const sample = plan.evaluatorMock;
  const baselineDigest = sha256(JSON.stringify(sample.plan.baselineConfiguration));
  for (const scenario of sample.scenarios) {
    checks.push(check(scenario.id, scenario.id.replaceAll('-', ' '), () => {
      const result = evaluateScenario(scenario, sample.task, sample.plan, baselineDigest);
      assert.equal(result.decision, scenario.expected);
      return 'SYNTHETIC: ' + result.decision + '. ' + result.reason + ' No measured model improvement.';
    }));
  }
  return checks;
}
