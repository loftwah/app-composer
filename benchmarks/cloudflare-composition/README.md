# Cloudflare creation benchmark

**CF-COMPOSE v1: build, own and recover an app.**

This benchmark turns the Cloudflare wishlist into tasks we can repeat: does a
creator finish the work, what does it cost, where do they intervene, and what
happens when a step fails? It belongs to [Benchmarks Studio #601](https://github.com/loftwah/app-composer/issues/601);
[implementation #930](https://github.com/loftwah/app-composer/issues/930) owns this
campaign and its local foundation.

## What is ready

- [Six journey procedures](cases/scenarios.json), including prerequisites,
  positive controls, failure cases, measurements and required evidence.
- [CF-COMPOSE-01](cf-compose-01.json), a deterministic pack using the existing
  runner and Composer's actual save/reopen, moderation, restore, blueprint and
  provider-observation helpers. It uses fictional local fixtures, no model,
  credentials, network or provider spend.
- A protocol below for the first authorised browser and Cloudflare trials.

The local pack establishes only the assertions it executes. All six complete
journeys start **not-run**. The scenario JSON is a versioned procedure, not an
executor or an automatically ingested Benchmarks Studio result. This directory
does not change the deployed catalogue or add a release gate.

## The six journeys

| Journey | A successful creator outcome | Wishlist themes |
| --- | --- | --- |
| Create and return | Make a useful app, reopen its saved work, make a second change and retain owned source. | CF-01, CF-09, CF-11 |
| Preview with a colleague | Exercise an authorised preview while unrelated resources and production remain unaffected; revoke access and verify the result. | CF-01, CF-02, CF-04 |
| Recover an interrupted change | Reconcile a lost acknowledgement, stale plan or interrupted job without duplicating effects or losing retained data. | CF-01, CF-03, CF-07, CF-08, CF-09 |
| Finish media within an allowance | Complete and retain a suitable media output, resume interrupted transfer, and account for attempts, cost and any qualified fallback. | CF-08, CF-09, CF-10, CF-11, CF-12 |
| Prove the experience | Demonstrate the actual playable or audible result with state assertions, captured evidence and a separate human assessment. | CF-06, CF-09 |
| Continue as another owner | Export permitted source/data/assets, rebind destination credentials and make a useful change in an independently owned installation. | CF-07, CF-11, CF-12; optional CF-05 profile |

CF-05 covers experimental Artifacts event parity. Its optional profile has its
own applicability and result; omitting it never removes a required ownership
journey from the denominator. These are task hypotheses, not claims that a
Cloudflare product lacks a feature.

## Real-product outcome profiles — follow-on coverage (2026/11/19)

[The nine real-product profiles](cases/real-product-profiles.json) translate the
Cloudflare wishlist and its companion *what I would actually build* brief into
specific, falsifiable portfolio demonstrations. They extend **this same
CF-COMPOSE campaign**, not a second benchmark engine. The original six required
journeys, comparison basis, schemas and result denominator above remain intact.
Each profile is a separately declared, **not-run** scenario until the required
independent source/browser/provider/human evidence exists. A local helper result
cannot qualify a complete profile. No unapproved provider spend, agent access or
production operation is authorised by a benchmark definition.

| Profile | What the owner must actually demonstrate | Home |
| --- | --- | --- |
| **CF-R01** First creator | From no infrastructure knowledge to an owned, multi-resource app, return, second change, portable source and independently verified state | Composer Get Ready / Init, #425 / #590 |
| **CF-R02** Phone-first release | Phone controls a real remote agent preview/review/release while laptop is unavailable; exact code and live Worker result verified | #772 / #597 / #319 |
| **CF-R03** Parallel alternatives | Two isolated agent proposals with actual diffs, conflict/permissions tests, chosen result round-trips through ordinary Git | #717; Woodhouse #281 |
| **CF-R04** Finished original film | One owned LoftwahFM song becomes a versioned, editable, synchronised, genuinely playable video with real cost/rights and human craft assessment | Media Studio #14 / #150 / #222 |
| **CF-R05** Real game/music experience | Prove first-five-minute Phaser gameplay or navigation-and-seek audio with real pixels, sound, frame pacing, save state and device limitations | Game owners / LoftwahFM, #659 / #623 |
| **CF-R06** Governed tenants | Two separately scoped tenants, least-privilege agent actions, audited denial/revocation, honest cost and actual region evidence | #113 / #216 / #291 |
| **CF-R07** Full-app recovery | Diagnose and recover a bounded multi-resource incident; compare code, data, media, privacy and schema state rather than claim Worker rollback is full recovery | #215 / #445 / #9 |
| **CF-R08** Recursive rebuild | Rebuild App Composer as a second independently owned installation, run a new app and useful follow-up through it, test repeatable reconstruction and declared parity | #931 / #600 / #476 / #603 |
| **CF-R09** Portfolio proof/feedback | Join actual GitHub/Cloudflare/Studio identities across projects, retain private evidence and publish one approved benchmark plus one falsifiable Cloudflare improvement request | #601 / #613 / Woodhouse #18 |

The existing **CF-R04** film profile has a detailed [MUSIC-DIRECTION-01 protocol](../creative-production/music-direction-01.md): scoped directing and reference packs, an owned 30–60 second production first, selective correction, and separately measured longer assembly/planning capacity. It remains **not-run** and keeps the same profile ID, status and campaign denominator. The protocol does not run through the provider-free foundation command.

The profile file explicitly maps **all 13 MCP wishlist themes and all 18 wider
platform themes** to at least one concrete outcome. The mapping is **coverage of
questions to evaluate**, not provider availability or technical certification.
Each profile names its baseline (usually the existing supported local/ordinary
Git or app-specific workflow), prerequisites, ordered actions, positive control,
negative cases, metrics, required receipts, owners and status. Real-world features
such as Artifacts event parity, cross-account rebuild, Australian data location,
actual device availability and media GPU execution remain unverified until their
own permitted qualification; missing capabilities are blocked/not-applicable with
reasons rather than fabricated provider defects.

**Execution order:** run the existing CF-J01–CF-J03 positive/negative cases first,
then attach CF-R01 to a real beginner, CF-R02 to an approved mobile release
pilot and CF-R03 to a synthetic two-agent Git round-trip. Follow with the media,
game, tenant, recovery, recursive and observability profiles as their owning
projects become ready. Never silently drop the other six required journeys from
reporting. Run the same baseline and improved workflow with frozen inputs and
record every attempt, intervention, useful result, failure, observed/estimated
cost and measured change. At least three fresh attempts per configuration are a
preliminary comparison, not a claim of statistical significance.

**Public Benchmarks Studio:** [the existing /benchmarks hub](https://composer.loftwah.com/benchmarks)
should expose this campaign with its actual evidence status. Approved public
shareables and analytics remain owned by [#613](https://github.com/loftwah/app-composer/issues/613).
Do not create another dashboard or publish raw customer, repository or security
data. Own application implementation and repairs in the linked projects, and
track evaluation in [#601](https://github.com/loftwah/app-composer/issues/601).


## WordPress Studio and Spacefast comparison

[WPSF-01: create, refine, publish and return](wordpress-studio-spacefast.md)
compares documented Studio/Spacefast workflows with App Composer and native
EmDash. It separates static sites, editable CMS sites and dynamic applications,
and covers chosen-agent handoff, design continuity, targeted preview feedback,
editorial work, publishing, reconciliation and recovery. Migration and useful
Workers AI are separately reported optional expansions.

This is a companion protocol under [#1008](https://github.com/loftwah/app-composer/issues/1008),
with [#1009](https://github.com/loftwah/app-composer/issues/1009) owning the first
live-preview feedback consumer. All nine comparative cases are **not-run**.
It reuses existing CF-J/CF-R receipts and preserves the six required journeys
and nine profile denominators. Existing [#935](https://github.com/loftwah/app-composer/issues/935)
owns live execution and [#933](https://github.com/loftwah/app-composer/issues/933)
owns in-product discovery. There is no new runner, schema, provider bill or
automatic pass. The protocol records the separately executed local foundation
and its precise limits.

## Run the local foundation

From the repository root, use the repository's supported Node version. The
foundation needs native TypeScript stripping for the provider-observation helper
(the current Node 24/26 supported lines provide it). It needs no dependency install.

```sh
node benchmarks/runner.mjs --suites benchmarks/cloudflare-composition --suite CF-COMPOSE-01
```

To retain a fresh result without overwriting the shared benchmark baseline:

```sh
node benchmarks/runner.mjs --suites benchmarks/cloudflare-composition --write --out output/cloudflare-composition/local-run.json
```

Choose a new output filename for each retained attempt. The second command keeps
module IDs in the native result, which matters if a future reviewed result is
referenced by a suite pack. The existing single-pack command flattens results
under the pack ID; do not relabel that file as module-grouped evidence.

Inspect `totals` and each check's status. The existing runner can exit zero with
blocked checks. A successful process exit alone is not a pass. Its elapsed
milliseconds measure local helper execution, not app creation or network speed.
The pack declares no committed evidence; a new command's output is the evidence
for that attempt, and must accompany any claim about it.

## Run a complete journey

1. Select a case from `cases/scenarios.json`. Freeze the case version, starting
   state, task inputs and success assertions before the attempt. Record the
   exact app, recipe, asset and configuration revisions. Read the owning app's
   current delivery and permission requirements.
2. Prepare an explicitly authorised isolated target and owned test resources.
   Record role, project/environment aliases, allowed actions, timeout, retry and
   spending limits. Keep credentials in their established secret store. A
   scenario file grants no authority to deploy, spend, publish or access another
   account. Missing prerequisites mean blocked; do not substitute production.
3. Run the positive control and the case's ordered procedure through the actual
   interface. Observe the saved result from an independent read or reopen.
   Exercise only the listed, authorised fault cases. Keep the procedure bounded
   by the declared time, requests, cost and cleanup scope.
4. Retain expected and observed values plus evidence for every assertion.
   Record cancellation, retries, interruptions and uncertain side effects. A
   timeout does not establish whether the remote action happened. Reconcile
   before retrying a mutation.
5. Remove only the run's owned disposable resources. Verify cleanup and record
   leftovers with their next action. Do not retire the original app or delete
   retained creator work to make a portability demonstration look complete.
6. Report the task result, invariant results, measurements and evidence limits.
   File actionable findings with the existing owner; use the feedback format
   below for candidates worth discussing with Cloudflare.

Start with **create and return** in Composer, then the connected Guestbook and
Showcase boundary. Studio owns media jobs and retained artefacts; consume its
supported evidence rather than building another producer. The private Studio
outcome work in [Studio #445](https://github.com/loftwah/composer-media-studio/issues/445)
does not establish a public feed or permission to publish its records.

## Results and measurements

Keep local assertions (`pass`, `fail`, `blocked`) in the existing runner's
format. A complete journey can be `pass`, `fail`, `blocked`, `not-run` or
`inconclusive`; an optional profile may be `not-applicable` with a stated reason.
Do not insert those extra journey states into a deterministic suite result.

Report six required journeys in every campaign summary, with counts by status
and optional-profile results separately. Zero attempts means not-run. An
attempt unable to start because its prerequisite is unavailable is blocked. An
attempt without enough observations to establish its outcome is inconclusive.
Neither is a pass or a measured product failure.

An expected refusal can pass a permission assertion while the creator's task
remains blocked. Every refusal check needs a valid permitted control: a system
that refuses everything has not completed the task. A data-integrity,
authorisation or publication-boundary failure fails the affected journey and is
shown prominently; it cannot be averaged away.

| Measurement | Unit and interpretation |
| --- | --- |
| Completion | Required assertions satisfied / required assertions attempted, with blocked and missing observations visible. Report the full journey result separately. |
| Time | Monotonic elapsed milliseconds for setup, task and recovery separately; display seconds with an explicit conversion. Record start/terminal observations. Incomplete attempts are not silently discarded. |
| Human intervention | Count each required manual correction, escalation or approval; distinguish initial setup from repeat use. Human preference is a separate observation. |
| Work | Observed tool/provider requests, retries, polling, bytes transferred and duplicated side effects. Mark missing instrumentation as unknown. |
| Cost | Estimated and provider-reported amounts separately, currency and pricing basis included. Preserve missing values as null/unknown, never zero. State observation coverage and include failed attempts and retries. |
| Integrity | Expected versus actual saved state, asset hashes, lineage, permissions and destination behaviour. A successful HTTP response is insufficient. |
| Experience | Task-specific human criteria, reviewer method and device/accessibility conditions. Keep these separate from deterministic correctness. |

Choose performance and allowance thresholds before a run from the creator's
actual brief and current product policy. Do not invent universal latency or
cost targets. The repository's routine change-to-delivery target is currently
120 seconds; it does not define a media-render time limit or apply retroactively
to every benchmark journey.

An advisory budget warning and an enforced limit are different observations.
Record spend visibility lag, operations already in flight, external-provider
charges and any possible overshoot. A run with unknown charges cannot establish
that its allowance was met. Do not reuse a comparison summary that converts
null charges to zero; retain raw values and coverage until its own handling is
verified.

## Evidence and fair comparisons

Use the existing run records described in [recorded runs](../runs/README.md)
when their schema fits the trial. For this first campaign, retain raw receipts
under ignored `output/` and put a concise reviewed summary on the owning issue
or PR. Do not register a new public run by inventing required measurements.

Every retained attempt needs:

- Campaign/case version and hashes of task, fixtures and relevant artefacts;
  exact source commit and any working-tree diff. A commit alone does not
  identify uncommitted benchmark code.
- Execution layer: source inspection, deterministic fixture, local app,
  isolated Cloudflare execution, production observation or human review.
- Requested and resolved model/provider, routing, agent harness, tools, skills
  and relevant settings; runtime, browser/device, viewport and network location.
  Use not-applicable for fields irrelevant to a helper-only run.
- Environment and permission scope, cold/warm state, caches, limits, all
  attempt IDs, expected/observed values and units, evidence hashes/references,
  cost coverage, result and cleanup outcome.
- UTC timestamps for machine records. In human summaries show
  `YYYY/MM/DD HH:mm:ss Australia/Melbourne (AEDT/AEST)` and the equivalent UTC
  value. Dates in synthetic fixture code are inputs, not execution timestamps.

For a comparison, keep workload, starting state, acceptance assertions,
permissions, limits and measurement method fixed. Record every changed
dimension. A change of model, harness and implementation together compares
configurations; it cannot isolate a Cloudflare feature's effect.

Use at least three fresh attempts per configuration for a preliminary
comparison, keeping every attempt. Show raw values and median/range for that
small sample. Do not claim p95, statistical significance or general reliability
from three trials. Record Australian network measurements only when the actual
runner is in Australia. There is no universal weighted score.

## Turn a result into useful Cloudflare feedback

For each repeatable friction point, record:

1. **Observed:** exact interface/version, inputs and measured outcome, with its
   execution layer. Label inference and anything unverified.
2. **Workaround:** what Composer actually did; identify our own implementation
   gap when that explains the result.
3. **Cost:** observed extra calls, elapsed time, manual steps or constrained
   capability. Do not estimate engineering hours from code length.
4. **Ask:** the smallest change that would remove the measured workaround, plus
   the benchmark assertion that would demonstrate improvement.

Check current official docs before calling something a missing platform
capability. Classify findings as our implementation, documentation/discovery,
verified platform behaviour, environment/unverified or future wish. A failed
Composer workflow by itself cannot determine which team owns the cause.

Keep raw receipts private where required. A shareable summary excludes secrets,
account/zone IDs, private endpoints, customer records, private prompts, raw
security findings and unrelated captures. Use safe aliases and public source
references. Hashes establish integrity, not publication permission. Use real,
owned work with appropriate rights for public product demonstrations; label
synthetic automated fixtures as such. Approved public derivatives belong to
[#613](https://github.com/loftwah/app-composer/issues/613), using its existing
report/export paths.

## Follow-through

[#425](https://github.com/loftwah/app-composer/issues/425) owns independent-creator
proof, [#623](https://github.com/loftwah/app-composer/issues/623) human journeys,
[#445](https://github.com/loftwah/app-composer/issues/445) operational recovery,
[#600](https://github.com/loftwah/app-composer/issues/600) reusable blocks and
[#717](https://github.com/loftwah/app-composer/issues/717) optional Artifacts work.
Keep production fixes in their existing owners. This benchmark supplies
repeatable observations and acceptance outcomes; it adds no dashboard,
scheduler, deployment system or general release requirement.
