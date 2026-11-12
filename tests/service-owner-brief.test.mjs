import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildRoleBrief } from '../src/lib/role-packs.ts';

const fixture = JSON.parse(readFileSync(new URL('../examples/role-packs/fictional-trail-notes.json', import.meta.url)));

function candidate(status, purpose = 'feature') {
  const input = structuredClone(fixture);
  input.release.status = 'candidate';
  input.signals.slo.status = status;
  input.drift = [];
  input.gates.forEach((gate) => { gate.status = 'pass'; });
  input.evidence.push({
    id: 'ev-policy',
    kind: 'release-policy',
    source: 'fictional-policy://trail-notes/reliability',
    environment: input.environment.id,
    observedAt: input.asOf,
    summary: 'Scoped reliability and security repairs may be recommended after all mandatory checks pass.',
  });
  input.change.serviceReview = {
    revision: 1,
    purpose,
    service: input.service.id,
    journey: 'Visitors read approved postcards',
    risk: 'high',
    evidence: 'ev-03',
    policy: { evidence: 'ev-policy', permits: ['reliability-repair', 'security-fix'] },
  };
  return input;
}

const brief = (input) => buildRoleBrief('service-owner', input);

test('Service Owner distinguishes measured SLO states from unknown evidence', () => {
  for (const [status, decision] of [['met', 'proceed'], ['breached', 'hold'], ['at-risk', 'hold'], ['unknown', 'escalate']]) {
    const result = brief(candidate(status));
    assert.equal(result.meta.decision, decision, status);
    assert.match(result.markdown, new RegExp('Health:.*' + status));
  }

  const missing = candidate('met');
  delete missing.signals.slo;
  assert.match(brief(missing).markdown, /Health:.*unknown.*No SLO observation/);

  const stale = candidate('met');
  stale.signals.slo.capturedAt = '2026-10-21T00:00:00Z';
  stale.evidence.find((item) => item.kind === 'slo').observedAt = stale.signals.slo.capturedAt;
  assert.equal(brief(stale).meta.decision, 'escalate');
  assert.match(brief(stale).markdown, /Health:.*unknown.*older than 24 hours/);

  const wrongEnvironment = candidate('met');
  wrongEnvironment.evidence.find((item) => item.kind === 'slo').environment = 'another-environment';
  assert.equal(brief(wrongEnvironment).meta.decision, 'escalate');
  assert.match(brief(wrongEnvironment).markdown, /Health:.*unknown.*selected environment/);
});

test('Service Owner recommends an evidenced repair under policy while health stays breached', () => {
  for (const purpose of ['reliability-repair', 'security-fix']) {
    const result = brief(candidate('breached', purpose));
    assert.equal(result.meta.decision, 'proceed');
    assert.equal(result.meta.blocked, false);
    assert.match(result.markdown, /Health:.*breached/);
    assert.match(result.markdown, /under cited policy ev-policy/);
  }

  const noPolicy = candidate('breached', 'security-fix');
  delete noPolicy.change.serviceReview.policy;
  assert.equal(brief(noPolicy).meta.decision, 'escalate');
  assert.match(brief(noPolicy).markdown, /cite the applicable release policy/);

  const wrongPolicy = candidate('breached', 'reliability-repair');
  wrongPolicy.change.serviceReview.policy.evidence = 'ev-03';
  assert.equal(brief(wrongPolicy).meta.decision, 'escalate');

  const wrongService = candidate('breached', 'security-fix');
  wrongService.change.serviceReview.service = 'other-service';
  assert.equal(brief(wrongService).meta.decision, 'escalate');

  const staleJourney = candidate('met');
  delete staleJourney.change.serviceReview;
  staleJourney.evidence.find((item) => item.kind === 'journey').observedAt = '2026-10-21T00:00:00Z';
  assert.equal(brief(staleJourney).meta.decision, 'escalate');
  assert.match(brief(staleJourney).markdown, /Cite fresh journey evidence/);

  const missingGateEvidence = candidate('breached', 'security-fix');
  delete missingGateEvidence.gates[0].evidence;
  assert.equal(brief(missingGateEvidence).meta.decision, 'escalate');
  assert.match(brief(missingGateEvidence).markdown, /Cite fresh evidence for gate G1/);

  const denied = candidate('breached', 'security-fix');
  denied.change.serviceReview.policy.permits = ['reliability-repair'];
  assert.equal(brief(denied).meta.decision, 'hold');

  const missingHealthyGate = candidate('met');
  delete missingHealthyGate.gates[0].evidence;
  assert.equal(brief(missingHealthyGate).meta.decision, 'escalate');
  assert.match(brief(missingHealthyGate).markdown, /Cite fresh evidence for gate G1/);

  const lowRisk = candidate('at-risk');
  lowRisk.change.serviceReview.risk = 'low';
  assert.equal(brief(lowRisk).meta.decision, 'escalate');
});

test('Service Owner advice preserves gates, isolation and release holds', () => {
  assert.equal(brief(fixture).meta.decision, 'hold');
  assert.match(brief(fixture).markdown, /G3, G5 are not passing/);
  for (const status of ['fail', 'not-run']) {
    const input = candidate('breached', 'security-fix');
    input.gates[0].status = status;
    assert.equal(brief(input).meta.decision, 'hold');
  }

  const blocked = candidate('met');
  blocked.release.status = 'blocked';
  assert.equal(brief(blocked).meta.decision, 'hold');

  const ownerHold = candidate('breached', 'reliability-repair');
  ownerHold.change.serviceReview.ownerHold = true;
  assert.equal(brief(ownerHold).meta.decision, 'hold');

  const isolation = candidate('breached', 'security-fix');
  isolation.environment.isolatedResources = false;
  assert.equal(brief(isolation).meta.decision, 'hold');

  const invalid = candidate('met');
  invalid.change.serviceReview.revision = 2;
  assert.throws(() => brief(invalid), { code: 'bundle-incomplete' });
});
