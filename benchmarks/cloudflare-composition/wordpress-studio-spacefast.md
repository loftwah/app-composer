# WordPress Studio and Spacefast comparison

**Protocol version: WPSF-01 v1. Status: defined; all nine competitive cases not-run.**

This is a companion protocol for the existing [CF-COMPOSE campaign](README.md).
It reuses the original CF-J01/02/03/05/06 journeys and CF-R01/02/07/09 profile
evidence where relevant. It does not append a tenth CF-R profile, alter their
denominators, register an executable JSON suite or publish benchmark results.
The existing [Benchmarks Studio](https://composer.loftwah.com/benchmarks)
links the campaign; dedicated in-product case discovery is tracked by
[#933](https://github.com/loftwah/app-composer/issues/933).

## Outcome and mission

Match the useful **describe → create → inspect → point-and-refine → publish → return-and-improve** experience demonstrated by WordPress Studio and Spacefast in App Composer + native EmDash. Make Cloudflare Workers easier to adopt, then make useful Workers AI capabilities easy to add and retain.

This document defines **WPSF-01**, the comparison protocol and feature crosswalk owned by [#1008](https://github.com/loftwah/app-composer/issues/1008). Existing implementation issues retain delivery ownership; [#601](https://github.com/loftwah/app-composer/issues/601) owns benchmark records, [#933](https://github.com/loftwah/app-composer/issues/933) the in-product benchmark experience, and [#935](https://github.com/loftwah/app-composer/issues/935) actual execution. Extend CF-COMPOSE; keep its original six required journeys and nine real-product profiles and their denominators intact. No second benchmark engine, CMS, theme engine, deployment platform or universal agent runtime.

**Evidence status:** primary-source research and current-source/backlog inspection completed; no competitive product trial, speed/cost advantage, customer-adoption result or feature-parity claim has been established. Main inspected: `b3b18a55e9730a85b62aa868509dcb09634d8fca`. EmDash and its Cloudflare integration are both pinned at 1.5.0. PR [#934](https://github.com/loftwah/app-composer/issues/934) is merged; the existing records still mark full journeys/profiles not-run. Brand Studio already implements saved drafts, real phone/desktop screen preview, publish/history/restore and import/export; reuse it.

Reviewed 2026/11/20 Australia/Melbourne (AEDT, UTC+11) / 2026/11/20 UTC.

## Verified reference capabilities

| Reference capability | Equivalent outcome here | Delivery owner |
| --- | --- | --- |
| External agent plugins/MCP; separately, provider connections inside Studio | Existing chosen agent/account can discover, change, inspect and hand off an owned project; truthful support and billing | [#311](https://github.com/loftwah/app-composer/issues/311) / [#597](https://github.com/loftwah/app-composer/issues/597) / [#442](https://github.com/loftwah/app-composer/issues/442) |
| Guided looks/layouts, persistent DESIGN.md and design drift inspection | Reusable project taste/design decisions; generate a compatible Astro theme/content model or appropriate EmDash extension, then preserve decisions on the next change | [#446](https://github.com/loftwah/app-composer/issues/446) / [#21](https://github.com/loftwah/app-composer/issues/21) / [#285](https://github.com/loftwah/app-composer/issues/285) / [#353](https://github.com/loftwah/app-composer/issues/353) / [#369](https://github.com/loftwah/app-composer/issues/369) |
| Select element/region, attach reference, batch feedback, receive updated preview | First working live-preview consumer of [#601](https://github.com/loftwah/app-composer/issues/601)'s existing review contract and [#311](https://github.com/loftwah/app-composer/issues/311) proposals | [#1009 live-preview feedback](https://github.com/loftwah/app-composer/issues/1009) |
| Block validation and screenshot self-review | Stack-appropriate schema/content checks plus real rendered interaction, mobile/desktop evidence and separate human craft judgement | [#601](https://github.com/loftwah/app-composer/issues/601) / [#623](https://github.com/loftwah/app-composer/issues/623) / [#597](https://github.com/loftwah/app-composer/issues/597) |
| WordPress editor/admin, local preview, push/pull | Native EmDash editorial/admin workflow and explicit source/content/environment reconciliation | [#198](https://github.com/loftwah/app-composer/issues/198) / [#679](https://github.com/loftwah/app-composer/issues/679) / [#310](https://github.com/loftwah/app-composer/issues/310) |
| Static Studio export to Spacefast | Static Astro/Git content starter on Cloudflare with capability eligibility and no inert promised forms | [#971](https://github.com/loftwah/app-composer/issues/971) / [#972](https://github.com/loftwah/app-composer/issues/972) / [#319](https://github.com/loftwah/app-composer/issues/319) |
| Spacefast dynamic apps, data/functions/jobs/storage | Independently owned Cloudflare Workers + app-owned D1/R2 and required services | [#219](https://github.com/loftwah/app-composer/issues/219) / [#476](https://github.com/loftwah/app-composer/issues/476) / [#319](https://github.com/loftwah/app-composer/issues/319) |
| Immutable ready versions, promotion and rollback; async operation receipts | Understandable preview/publish/second-change/recovery with exact source/version, reconciled retries and distinct code/data recovery | [#8](https://github.com/loftwah/app-composer/issues/8) / [#9](https://github.com/loftwah/app-composer/issues/9) / [#319](https://github.com/loftwah/app-composer/issues/319) / [#310](https://github.com/loftwah/app-composer/issues/310) / [#445](https://github.com/loftwah/app-composer/issues/445) |
| Migration and source/schema portability | Existing WordPress→EmDash preservation/loss report and independently editable result | [#165](https://github.com/loftwah/app-composer/issues/165) / [#166](https://github.com/loftwah/app-composer/issues/166) / [#167](https://github.com/loftwah/app-composer/issues/167) / [#168](https://github.com/loftwah/app-composer/issues/168) |
| Useful native Cloudflare AI addition | Existing cited search/answers recipe and value/adoption evidence; build-agent usage separate | [#991](https://github.com/loftwah/app-composer/issues/991) / [#936](https://github.com/loftwah/app-composer/issues/936) / [#220](https://github.com/loftwah/app-composer/issues/220) / [#116](https://github.com/loftwah/app-composer/issues/116) |

EmDash owns content, editorial permissions/revisions and native CMS/admin extensions. App Composer owns intent, composition, chosen-agent handoffs and the coherent creation/operation journey. Cloudflare owns runtime/services. Media Studio remains the creative-asset owner. Implement native equivalents rather than PHP/theme/plugin emulation or new parallel admin.

## Compare three distinct product tracks

1. **Static site:** Studio-generated static export → Spacefast versus the existing Astro/Git content → Cloudflare recipe. Use equivalent navigation, media, metadata, links and publishing assertions. WordPress-backed forms/comments do not survive static export. If a feature needs a backend, show that requirement and cost or move the case to the dynamic track.
2. **Editable CMS:** WordPress Studio + an eligible full WordPress host versus App Composer + native EmDash on Workers. Include a nontechnical editor, drafts, media, metadata, permissions, publish and restore. Report the actual WordPress host/plan; static Spacefast is not its substitute.
3. **Dynamic application:** Spacefast's separately documented Zero/Functions/data workflow versus an owned Workers application with the services the same brief requires. Compare only functionally equivalent supported tasks. Unsupported functionality is recorded per case.

Spacefast documents importing an EmDash seed/schema into Zero and separate content migration. This is a schema translation path, not proof of identical EmDash runtime/admin/plugin support, and not a reason to assume exclusive EmDash differentiation.

## Named cases and acceptance

| Case | Frozen task and observable completion |
| --- | --- |
| **WPSF-C01 · Bring an agent and return** | Connect one supported existing agent; discover the target and available actions; create a bounded change, inspect it, disconnect/reconnect and resume using a second supported client. Show the actual account/entitlement; no assumed subscription-to-API portability. |
| **WPSF-C02 · Design and extend** | Use the same brief, rights-cleared references and content. Choose a look/layout, retain accepted and rejected decisions, generate a useful structured-content field/form or extension, and make a later change without losing taste or owner edits. Verify actual native editor/extension behaviour; arbitrary native code is not a sandboxed install. |
| **WPSF-C03 · Point and fix** | Seed five named desktop/phone defects. Select an element or screenshot region, attach exact raw feedback/reference, submit a batch, fix and inspect the updated preview. Test navigation/revision/viewport drift, unsupported selectors and permission denial. All five intended repairs and unchanged control regions are checked; human preference remains separate. |
| **WPSF-C04 · Editor can operate it** | Create draft, edit a structured field, add media/alt text, preview, publish, revise and restore. Confirm editor role limits, inaccessible private drafts, saved/reopened state and a working phone/keyboard journey. |
| **WPSF-C05 · Preview to live** | Run separately in each eligible track: start with explicit target, publish, verify exact served release plus every declared interaction, return and make a second change. Capture initial setup vs repeat publish and manual steps. A screenshot or successful upload cannot certify a working form/backend. |
| **WPSF-C06 · Reconcile edits** | Change code locally and content in native admin; then update again. Preview the diff/conflict, preserve unrelated newer content/media/configuration and prove which system owns each value. Test lost acknowledgement and retry without duplicate effects. Do not prescribe whole-database push/pull. |
| **WPSF-C07 · Recover and own** | Introduce one bounded regression, inspect real diagnostics, restore code, and independently compare schema/content/media and permissions. Prove source export and an ordinary follow-up edit. State exactly what code rollback does not restore. |
| **WPSF-C08 · Migration (optional, distinct cohort)** | Reuse [#166](https://github.com/loftwah/app-composer/issues/166)/#167 fixtures and preserve or explicitly dispose of content, URLs, redirects, media and required plugin behaviour. Source-off verification and retained rollback follow the existing migration contract; greenfield success is not migration success. |
| **WPSF-C09 · Useful Workers AI (optional expansion)** | Add [#991](https://github.com/loftwah/app-composer/issues/991)'s cited search/answers to the owned site. Demonstrate correct source links, unanswerable handling, saved/reused value and genuine later use. Compare deterministic baseline where appropriate; report native inference separately from external Gateway, cache and build-agent calls. |

The initial execution slice is **C01 + C03 + C05**, including an honest blocked result for a missing implementation/account. Then C02/C04/C06/C07 as their owners become executable. Migration and AI remain separately reported optional expansion; they must not inflate static/CMS parity scores.

## Measurement and evidence contract

- [ ] Pin fixture/brief/reference hashes, source and deployed revision, product/CLI version, provider/model, agent/harness/tools/skills, browser/device/viewport, account/entitlement, region and allowed assistance. Recheck current technical documentation and actual exposed capabilities before each trial.
- [ ] Distinguish **vendor documented / source inspected / locally observed / provider or browser observed / production verified / human assessed**. A definition or issue is not a result.
- [ ] Record every attempt and status: pass, fail, blocked, not-run, inconclusive; not-applicable only for a genuinely optional ineligible case with reason. Show expected/observed outcome and the owning repair issue.
- [ ] Freeze success conditions before the run. Keep brief, assets, required behaviour, grants and instrumentation matched. Run the same model/settings where supported; otherwise label an end-to-end configuration comparison and disclose changed variables.
- [ ] Start with three paired repeats of each selected executable task. Show individual results, counts, median/range, setup time, active task time, waiting time, manual interventions, retries, recovery and actual known/unknown charges. No p95, statistical-significance, reliability or universal winner claim from that sample.
- [ ] Report quality/interaction/accessibility and human design judgement separately. Content loss, cross-tenant access, stale-target writes or missing required functionality fail the relevant task and cannot be averaged away.
- [ ] Treat native Workers AI inference, externally hosted inference through AI Gateway, cache hits, deterministic/no-model work and external build-agent consumption as separate attributed events. Gateway routing alone does not establish native Workers AI demand.
- [ ] Public evidence uses real owned work with rights/privacy approval. Private raw captures stay private. Preserve exact sources, screen/recording provenance and cleanup result; no invented bills, regions, customer cohorts or approval.
- [ ] In [#933](https://github.com/loftwah/app-composer/issues/933), a person can find the comparison, open its evidence, resume/re-run and compare versions using current contracts. [#613](https://github.com/loftwah/app-composer/issues/613) receives only authorised proof from real completed runs.

## Milestones and dependencies

**M0 — source baseline:** source-backed capability/ownership matrix and repeatable protocol committed to the existing CF-COMPOSE directory; not-run state retained.  
**M1 — core loop:** BYO agent → useful preview → targeted change → declared static/dynamic publish → second change, with C01/C03/C05 paired trial evidence.  
**M2 — real ownership:** native editorial/extension workflow, reconciliation and recovery meet C02/C04/C06/C07.  
**M3 — mission proof:** optional migration and useful Workers AI feature show correct behaviour and retained value; approved evidence becomes a working “make this yours” path.

Research, fixtures and bounded owning implementations can proceed in parallel. One writer integrates shared preview/proposal/authentication code. [#935](https://github.com/loftwah/app-composer/issues/935) owns executions; no new paid commitments, independent scheduler or portfolio-wide release gate. The campaign issue stays open until the selected core-loop comparisons have actual records and every material matching gap is delivered or explicitly assigned/deferred with evidence. Do not close it merely for the protocol.

## Primary sources

- [Studio BYO agents announcement](https://wordpress.com/blog/2026/11/18/wordpress-studio-agents/)
- [Studio Code: design and annotation](https://wordpress.studio/docs/studio-code/)
- [Studio provider connections versus external-agent plugins](https://wordpress.studio/docs/providers/)
- [Studio workspace and visual checks](https://wordpress.com/blog/2026/11/04/wordpress-studio-workspace/)
- [Studio publishing and static limitations](https://wordpress.studio/docs/sync/)
- [Spacefast dynamic runtime](https://spacefast.com/docs/zero-runtime/)
- [Spacefast versions and rollback](https://spacefast.com/docs/versions/)
- [Spacefast MCP operation receipts](https://spacefast.com/docs/agents/mcp-server/)
- [Spacefast scoped permissions](https://spacefast.com/docs/agents/permissions/)
- [Spacefast CLI, including EmDash schema import](https://spacefast.com/docs/cli/reference/)
- [EmDash native MCP](https://docs.emdashcms.com/reference/mcp-server/)
- [EmDash WordPress plugin migration](https://docs.emdashcms.com/migration/porting-plugins/)
- [EmDash WordPress content migration](https://docs.emdashcms.com/migration/from-wordpress/)

## Local baseline actually executed

At **2026/11/20 13:35:09 Australia/Melbourne (AEDT, UTC+11) /
2026/11/20 02:35:09 UTC**, the unmodified existing local foundation was run
against source `b3b18a55e9730a85b62aa868509dcb09634d8fca`.

| Command | Actual observation |
| --- | --- |
| `node benchmarks/runner.mjs --suites benchmarks/cloudflare-composition --suite CF-COMPOSE-01` | 15 pass, 0 fail, 0 blocked; process exit 0 |
| `node --test tests/cloudflare-outcome-profiles.test.mjs` | 2 pass, 0 fail; process exit 0 |

Runtime: Node v24.22.3, Linux x64. The 25 commit-pinned source/data files and
import closure were verified against their Git blob hashes before and after
execution. This was a sparse verified source snapshot, so the runner's raw
`source` remained `"unknown"`; the independent commit/hash provenance above
is separate and was not written over that field. Task-owned disposable source
was removed and verified absent. No dependencies were installed, and the tests
used no model, provider, browser or live credentials.

The 15 assertions exercise local JSON save/reopen, tamper refusal, moderation
preservation through restore, blueprint round trips and fictional provider
observations. They establish none of the competitive-case outcomes. Local
helper execution time is not site-creation or deployment latency. The original
six full journeys, nine profiles and all nine WPSF cases remain not-run.
No shared committed benchmark baseline was overwritten.

## Fixture and run preparation

The execution owner freezes a small, rights-cleared site before comparing it:
three public pages, twelve published articles, two private drafts, five media
assets with alt text, navigation, one structured field, stable canonical URLs
and one meaningful follow-up design change. This describes a fixture to prepare,
not an already-generated asset pack. Reuse the existing WordPress lab rather
than make another importer. Public demonstrations use suitable real owned work.

The static variant has no server-dependent interaction. The CMS and dynamic
variants add a working contact submission, persisted record and the native
editor/role cases. Freeze expected text, URLs, media hashes and behaviour outside
the agents' task context. For C03 define five specific defects and unchanged
control regions before the trial. In the AI expansion reuse [#991](https://github.com/loftwah/app-composer/issues/991)'s independently
labelled corpus and questions rather than inventing a smaller passing sample.

Before implementation, read current source and open PRs for each owning issue.
A documented competitor capability, an existing open ticket and a local helper
each provide different evidence; none alone establishes a complete product
experience. Use the selected client's officially supported connection method.

## Per-attempt record

Use the existing [run records](../runs/README.md) where their schema fits.
Otherwise keep bounded raw receipts in the established private evidence path
and a reviewed summary in [#935](https://github.com/loftwah/app-composer/issues/935)/#1008; do not invent measurements to register a
public result. The minimal human-readable record is:

| Field | Required value |
| --- | --- |
| Identity | WPSF-01 protocol version, C01–C09 case, static/CMS/dynamic track, baseline/candidate, unique attempt ID |
| Inputs | Brief/fixture/reference hashes, immutable source, configuration and deployed revision |
| Configuration | Product/CLI, model/provider/agent/tools/skills, account entitlement, permission scope, actual browser/device/viewport/network location |
| Outcome | Expected versus observed assertions, task status, evidence layer, missing observations and owning repair issue |
| Measurements | Setup, active and elapsed time; manual interventions; retries; known charges with currency/basis; unknown charges as null with reason |
| Judgement | Reviewer and method for design/usability; human, agent-simulated and deterministic findings kept separate |
| AI expansion | Native inference/model and provider route, external Gateway inference, cache/no-model work, output accepted/reused and genuine later use |
| Evidence | Private-safe links/hashes for exact screenshots, traces, source/release and independently observed state |
| Finish | UTC start/end, local display equivalent, cleanup owner/outcome, remaining resources and next action |

A reused CF-J/CF-R receipt is referenced by identity, not counted as a new
independent trial. Missing inference usage is unknown; inference routed through
Gateway is counted once under its actual provider. Compare accepted useful work
per cost as well as total use. Do not generate gratuitous inference to raise
token counts.

## Case status at protocol publication

| Case | Status | Comparative runs |
| --- | --- | --- |
| WPSF-C01 | not-run | 0 |
| WPSF-C02 | not-run | 0 |
| WPSF-C03 | not-run | 0 |
| WPSF-C04 | not-run | 0 |
| WPSF-C05 | not-run | 0 |
| WPSF-C06 | not-run | 0 |
| WPSF-C07 | not-run | 0 |
| WPSF-C08 (optional) | not-run | 0 |
| WPSF-C09 (optional) | not-run | 0 |

No comparative speed, cost, reliability, UX superiority or feature-parity result
has been measured in this publication. Product implementation and authorised
live trials remain with the linked delivery owners.
