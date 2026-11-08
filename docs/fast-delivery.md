# Five-minute routine delivery

Reviewed 8 November 2026. This is the operating contract for routine changes.
The owner's target is **3 minutes, with 5 minutes as the normal maximum**, from
the first relevant code change to verified production. It is not five minutes
each for tests, review, merge, build and deploy. The whole interval is one
budget.

The prompt is published for copying at
[`/prompts#delivery`](https://composer.loftwah.com/prompts#delivery). This page
keeps the reasoning and the stage budget behind it.

## Why the 8 November batch took 55 minutes

The batch was not one routine change. It contained a new 1,100-line upstream
adapter, a new shared attention source with a contract change, a new interactive
public surface, two guarded deploys, three evidence files, screenshots and five
issue receipts. Those are separate slices with separate windows. No single stage
was unjustifiably slow; the work was misclassified as one deliverable.

The fix is not to rush the gates. It is to classify before starting and put
one independently releasable change in each window.

## Classification

Spend at most 45 seconds on preflight and decide which lane the work belongs to.

| Routine lane (5-minute target) | Not routine (separate window) |
| --- | --- |
| No migration or schema change | Migration, schema or contract change |
| No new dependency or provider | New module, dependency, provider, auth or spend |
| At most two files or one existing page/route | Multi-page UI, new surface or shared state change |
| Uses existing checks and the existing release path | Needs a new test harness, scheduler or external system |
| One observable result and one live check | Several dependent results or an owner-session gate |

A "small" change that needs a new module is still a large change. A one-line
copy fix on an existing page is routine even if the page is important.

## Stage budget

Measured on 8 November 2026: the focused check takes about 39s and one guarded
release about 139s, so the checks-plus-release flow is 2m58s. The remaining
budget is the change itself and the affected live inspection.

| Stage | Target | What belongs here |
| --- | --- | --- |
| Preflight | 0:00–0:30 | Clean pushed main, production source/Worker, the one file/route, the focused check, the live check |
| Implement | 0:30–1:45 | Smallest coherent edit; no adjacent refactor, no speculative tests |
| Focused check | 1:45–2:25 | One existing check command for the affected behaviour; fix one real failure, no scope expansion (~40s measured) |
| Commit and push | 2:25–2:35 | One commit for one slice |
| Guarded release | 2:35–4:55 | One `pnpm deploy` (or the project's equivalent), which owns the full check/build/live gates (~140s measured) |
| Live check and stop | 4:55–5:00 | The affected real behaviour that the release gate did not already check; stop and report at 5:00 |

The release gate prints each stage and the total elapsed time, and names the
slowest stage when it exceeds 300s. Do not run the full suite or build
separately before the guarded release. Do not do a second deploy for a copy
tweak. Do not run a browser matrix for a backend change. For UI, one phone width
and one desktop width; both themes only when the change touches them.

If a slice needs more than about 75 seconds of implementation, it is not
routine in this window even when the file count is small. Classify it and give
it its own window instead of stretching the release's checks.

## Overrun rule

At five minutes, stop adding scope and finish the current stage. Report:

- actual elapsed start-to-verified-production;
- the stage that consumed the time;
- the concrete cause (not "testing" or "review");
- the next executable action.

A real security, privacy, data-integrity, migration or release gate always wins
over the clock. If a mandatory gate makes routine delivery consistently exceed
five minutes, treat the gate's cost as a performance defect: measure the stages
and simplify, cache or scope the gate without deleting assertions that protect
real risk. Record that as a delivery task, not as a reason to keep a draft
backlog.

## What stays outside the lane

No scheduler, GitHub Actions, hosted CI, payment, provider credential, mini-app
repository, exact source pin or paid resource is added to hit the target. No
coherent change is split into tiny commits or pull requests to game the metric.
Docs, evidence and issue receipts are written after the release in one compact
record; they do not block or expand it.

## The prompt

The copy-ready version is the `delivery` module in
[`src/lib/prompt-library.ts`](../src/lib/prompt-library.ts), rendered at
`/prompts#delivery`. Its required behaviour is covered by
`tests/fast-delivery-prompt.test.mjs` so a later edit cannot quietly remove the
classification, focused-check, guarded-release or overrun rules.
