# AGENT-IMPROVE-01

[Decision and pilot scope](https://github.com/loftwah/app-composer/issues/1362) ·
[Frozen workload and rubric](../fixtures/agent-improve-01.json) ·
[Recorded synthetic replay](../results/agent-improve-01.json)

Run the checked-in suite without provider credentials, network access or an output file.

```sh
node benchmarks/runner.mjs --suite AGENT-IMPROVE-01
```

The result records the actual runner revision and separate fixture, baseline and
evaluator digests. Inspect the 13 required checks and their denominator. The
runner can exit zero with blocked checks, so process status alone cannot
qualify any candidate. A mismatched baseline or evaluator stops the comparison.
Every successful candidate must clear correctness, quality, safety and recovery
as well as the frozen improvement minimum and all resource ceilings.

The fixture simulates five workloads and twelve decisions, including missing
and blocked evidence, failure, no-op, regression, budget exhaustion and changed
identity. The replay exercises the decision logic. The time, token and operator
effort values in the fixture are synthetic. The runner's recorded wall time
covers local evaluation only.

A real pilot would require a selected agent and model, a private isolated
worktree, fictional data, independently scored held-out tasks, three matched
baseline and candidate repetitions, and a confirmed entitlement and spend cap.
The price, availability and actual resource use of that pilot are unknown.
Compare measured completion, human intervention, quality, recovery and spend
per verified result before proposing any change to the baseline.

Reference only: [Recursive Self-Improving Loopers upstream revision](https://github.com/eelbaz/Recursive-Self-Improving-Loopers/tree/765453d13878804c49876a656f39b57a4384dca4).
Its model-weight experiments were outside this evaluation.
