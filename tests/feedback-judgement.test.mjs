import test from "node:test";
import assert from "node:assert/strict";
import { orderAgreement, score } from "../scripts/evaluate-feedback-judgement.mjs";

test("judgement evaluator counts false accepts, missing cases and reordered answers", () => {
  const cases = [
    { id: "reject", expected: "reject", next: "rework" },
    { id: "verify", expected: "abstain", next: "verify" },
    { id: "accept", expected: "accept", next: "continue" },
    { id: "unanswered", expected: "reject", next: "rework" },
  ];
  const answers = {
    reject: { verdict: "accept", next: "continue" },
    verify: { verdict: "abstain", next: "verify" },
    accept: { verdict: "accept", next: "continue" },
  };
  const first = score(cases, answers);
  const agreement = score(cases.toReversed(), answers);
  assert.equal(first.cases, 4);
  assert.equal(first.complete, 3);
  assert.equal(first.falseAccepts, 1);
  assert.equal(first.abstentions, 1);
  assert.equal(first.exact, 2);
  assert.equal(first.nextActionExact, 2);
  assert.equal(orderAgreement(first, agreement), 3);
  const changed = score(cases, { ...answers, accept: { verdict: "accept", next: "verify" } });
  assert.equal(orderAgreement(first, changed), 2);
});
