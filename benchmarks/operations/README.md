# Continuous operations evaluation

**PERF-HILL-01 and AGENT-HORIZON-01 are protocol definitions. AGENT-IMPROVE-01 has a local synthetic replay.**

Recorded 2026/11/23 Australia/Melbourne (AEDT, UTC+11) / 2026/11/23 UTC.

Two of the protocols below were inspired by [Rhys Sullivan's long-horizon observability-agent prompt](https://x.com/RhysSullivan/status/2107211178837733444) and the [Rat Stack hill-climb adaptation](https://ratstack.sh/prompts). T3 Code's [Orchestrator V2](https://github.com/pingdotgg/t3code/blob/main/docs/orchestration-v2/orchestrator-mcp-server.md) demonstrates an optional reference implementation of recurring tasks and delegation, not a Composer dependency.

| Evaluation | Question | Owning issue | Protocol |
| --- | --- | --- | --- |
| AGENT-IMPROVE-01 | Can a frozen evaluator distinguish useful candidates from regressions or missing evidence? | [#1362](https://github.com/loftwah/app-composer/issues/1362) | [agent-improve-01.md](agent-improve-01.md) |
| PERF-HILL-01 | Can an agent find and **prove** a useful, safe performance improvement? | [#1120](https://github.com/loftwah/app-composer/issues/1120) | [perf-hill-01.md](perf-hill-01.md) |
| AGENT-HORIZON-01 | Can the maintenance loop operate repeatedly without hallucinated progress, runaway costs or unsafe actions? | [#1121](https://github.com/loftwah/app-composer/issues/1121) | [agent-horizon-01.md](agent-horizon-01.md) |

## Existing components: do not fork

- [#601](https://github.com/loftwah/app-composer/issues/601) owns the evaluation/result contract, [#935](https://github.com/loftwah/app-composer/issues/935) qualified execution, [#933](https://github.com/loftwah/app-composer/issues/933) discovery/history and [#613](https://github.com/loftwah/app-composer/issues/613) optional approved public proof.
- [#987 OBS-01](https://github.com/loftwah/app-composer/issues/987) already contains an **offline** known-answer incident fixture and the independent live readback/diagnosis milestone; reuse its telemetry evidence rather than creating a second collector.
- [#289](https://github.com/loftwah/app-composer/issues/289) owns scheduled/event workflows, [#311](https://github.com/loftwah/app-composer/issues/311) selected-agent proposals and approvals, [#597](https://github.com/loftwah/app-composer/issues/597) portable handoff and [#215](https://github.com/loftwah/app-composer/issues/215) response authority.
- The existing `benchmark-suite/v1` JSON packs are **offline deterministic check references only**, not a remote task runner. These protocols **must not** be misrepresented as provider-free recorded results or forced into that schema before matching checks exist.

## Evidence standard

Source/fixture hashes, deployment/app/environment identity, observability query and sampling/retention metadata, permitted actions, test/preview context, comparable before/after with denominators, exact PR/release state, actual cost/time, missing coverage, rejected attempts and independently assessed user behaviour. Separate measured observations, agent inference, human preference and provider claims. Not-run/blocked/inconclusive are valid outcomes.

**A verified result is something that happened**, not an issue, plan, prompt, configured integration, screenshot, opened PR or simulated production claim.

Use existing subscription entitlements and free deterministic tests first; any new paid usage, public deployment, persistent schedule or expanded privilege needs its own approved scope.

## Primary references

- [Cloudflare Observability Query Builder/REST](https://developers.cloudflare.com/workers/observability/query-builder/)
- [Cloudflare Observability API](https://developers.cloudflare.com/api/resources/workers/subresources/observability/)
- [Workers for Platforms request/error/CPU aggregates](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/observability/)
- [Cloudflare Cron Triggers (UTC)](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Workflow limits and WfP caveat](https://developers.cloudflare.com/workflows/reference/limits/)
- [App Composer release and risk policy](https://github.com/loftwah/app-composer/blob/main/AGENTS.md)
