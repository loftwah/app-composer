import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const old = load("../public/campaign/who-keeps-the-map/clef-counterfactual-order-v1.json");
const fresh = load("../public/campaign/who-keeps-the-map/feedback-judgement-cases-v1.json");
const regressions = old.results.map(({ id, facts, expected }) => ({
  id, facts, expected, next: nextStep(expected), label: "synthetic",
}));
const policies = {
  current: "Review each case. Accept a supported claim or action, reject a contradicted one, and abstain if there is insufficient evidence.",
  revised: "For each case, identify the exact claim or action and its scope. The owner's explicit words govern any selected option. Keep the supported part of partial acceptance. Refuse mismatched revisions, environments or provenance. Missing proof means verify, and activity is not an adoption outcome. Accept only the part backed by the stated evidence. Reject a contradiction, otherwise abstain when proof is missing.",
};
const model = "@cf/cloudflare/clef-flash";
const listUsdPerToken = 0.038 / 1_000_000;
const verdicts = ["accept", "reject", "abstain"];
const actions = ["continue", "rework", "verify"];

function nextStep(verdict) {
  return ({ accept: "continue", reject: "rework", abstain: "verify" })[verdict];
}

export function deterministic(facts) {
  const directRejection = /\b(?:drop this direction|won't work|unacceptable|rejected?|aren’t exciting|none of these|only chose it|does not match|was outside the run|there is no observed repeat use)\b/i;
  const proofGap = /\b(?:no callback|no actual tablet|does not identify|no return figures|no answer|no evidence|no measurement|no observed|unknown|no receipt)\b/i;
  const affirmative = /\b(?:exactly the headline I want|explicitly says: Keep|byte-identical|matched the checked data|returning to this workflow|successfully used the roster|loads offline after restart)\b/i;
  if (proofGap.test(facts)) return "abstain";
  if (directRejection.test(facts)) return "reject";
  if (affirmative.test(facts)) return "accept";
  return "abstain";
}

export function score(cases, answers) {
  const results = cases.map(({ id, expected, next }) => {
    const verdict = answers[id]?.verdict ?? null;
    const action = answers[id]?.next ?? null;
    return { id, expected, verdict, nextExpected: next, next: action };
  });
  return {
    cases: results.length,
    exact: results.filter((row) => row.expected === row.verdict).length,
    falseAccepts: results.filter((row) => row.verdict === "accept" && row.expected !== "accept").length,
    falseRejects: results.filter((row) => row.verdict === "reject" && row.expected !== "reject").length,
    abstentions: results.filter((row) => row.verdict === "abstain").length,
    covered: results.filter(({ verdict }) => verdict === "accept" || verdict === "reject").length,
    complete: results.filter(({ verdict, next }) => verdict && next).length,
    nextActionExact: results.filter((row) => row.next === row.nextExpected).length,
    results,
  };
}

export function orderAgreement(first, second) {
  const a = new Map(first.results.map((row) => [row.id, row]));
  return second.results.filter(({ id, verdict, next }) =>
    verdict !== null && next !== null && a.get(id)?.verdict === verdict && a.get(id)?.next === next).length;
}

const criteria = (options) => Object.fromEntries(options.map((value) => [value, value]));
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function hosted(cases, policy, reverse, { account, email, key }) {
  const select = (items) => reverse ? items.toReversed() : items;
  const questions = Object.fromEntries(select(cases).flatMap(({ id }) => [
    [id + ".judgement", { type: "choice", instructions: "For case " + id + ", is the exact claim or action supported?",
      criteria: criteria(select(verdicts)) }],
    [id + ".action", { type: "choice", instructions: "For case " + id + ", should the team continue, rework after a contradiction, or verify missing evidence?",
      criteria: criteria(select(actions)) }],
  ]));
  const state = policy + "\n\n" + JSON.stringify(select(cases).map(({ id, facts }) => ({ id, facts })));
  const payload = { model: "clef-flash", state, questions };
  const start = performance.now();
  const reply = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Email": email, "X-Auth-Key": key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  const body = await reply.json();
  if (!reply.ok || !body.success || !body.result?.answers)
    throw new Error(`Clef returned HTTP ${reply.status}, error codes ${body.errors?.map(({ code }) => code).join(",")}.`);
  const answers = body.result.answers;
  const pick = (id) => answers[id]?.chosen ?? answers[id]?.choice ?? null;
  const data = Object.fromEntries(cases.map(({ id }) => [id, {
    verdict: verdicts.includes(pick(id + ".judgement")) ? pick(id + ".judgement") : null,
    next: actions.includes(pick(id + ".action")) ? pick(id + ".action") : null,
  }]));
  const tokens = body.result.usage?.input_tokens ?? null;
  return { ...score(cases, data), elapsedMs: Math.round(performance.now() - start),
    tokens, estimatedListCostUsd: tokens === null ? null : tokens * listUsdPerToken,
    inputSha256: digest(payload), inputQuestionCount: Object.keys(questions).length };
}

async function main() {
  const destination = process.argv[2];
  if (!destination) throw new Error("Supply the destination JSON path.");
  const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_EMAIL: email, CLOUDFLARE_API_KEY: key } = process.env;
  if (!account || !email || !key) throw new Error("Use the existing Workers AI account session.");
  const segments = { regression: regressions, holdout: fresh };
  const result = {
    schema: "composer.feedback-judgement-comparison/1",
    observedAt: new Date().toISOString(), model, policies,
    historicalLabelCount: 0,
    holdoutLabels: { synthetic: fresh.filter(({ label }) => label === "synthetic").length,
      researcher: fresh.filter(({ label }) => label === "researcher").length },
    limitations: "Hand-authored text cases. Action agreement is a prioritisation proxy. No actual owner correction, task completion, ranking by mission utility or adoption was observed. Billed cost is unknown.",
    holdoutSha256: digest(fresh),
    runs: {},
  };
  for (const [segment, cases] of Object.entries(segments)) {
    const local = performance.now();
    const baseline = score(cases, Object.fromEntries(cases.map(({ id, facts }) => {
      const verdict = deterministic(facts);
      return [id, { verdict, next: nextStep(verdict) }];
    })));
    result.runs[segment] = { deterministic: { ...baseline, inputTokens: 0,
      elapsedMs: performance.now() - local, estimatedListCostUsd: 0, orderAgreement: baseline.complete } };
    for (const [name, policy] of Object.entries(policies)) {
      const [first, reversed] = await Promise.all([false, true].map((reverse) =>
        hosted(cases, policy, reverse, { account, email, key })));
      result.runs[segment][name] = { first, reversed, orderAgreement: orderAgreement(first, reversed) };
      writeFileSync(destination, JSON.stringify(result, null, 2) + "\n");
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
