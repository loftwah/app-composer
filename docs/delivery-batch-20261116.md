# Delivery batch — 16 November 2026

Owner direction: deliver useful product outcomes through implementation, review,
integration, deployment and a live check. This queue starts from the 16 November
receipt: Composer `2afd53b` and Studio `e8b3778` are verified live; later docs-only
commits do not require redeployment. Live `/build.json` was re-read at kickoff.

## Release owners

- Composer integrator: clean pushed `main` in `app-composer-release`, `pnpm deploy`.
- Studio integrator: clean pushed `main`, `pnpm deploy`, exact `revision` read-back.
- One writer per surface. Workers return commits/PRs; the parent integrates and
  performs the guarded deploy and live verification.

## Initial 30 outcomes

| # | Repo | Issue | Expected usable outcome | Worktree / dependency | Acceptance proof |
|---|---|---|---|---|---|
| 1 | Composer | #624 | `release-timing/v1` receipts, monotonic clock, ≥300,000 ms breach, deduplicated GitHub issue | `codex/delivery-watchdog-1116` | Fake-clock 299999/300000/300001 tests; real release receipt; controlled issue write |
| 2 | Studio | #160 | Same watchdog wired into the Studio release boundary | `codex/delivery-watchdog-1116` (shared module) | Boundary tests; real Studio deploy timing; pending/retry path |
| 3 | Studio | #159 | Private version-pinned review, timecoded feedback, compare, expiry/revocation | `codex/review-room-1116` | Real saved version, owner + reviewer flow, revoked link refusal |
| 4 | Studio | #157 | Portable project export including media bytes; restore into isolated install | `codex/portable-restore-1116` | Byte/hash match and editable state after restore |
| 5 | Studio | #14 | Finished film review and save decision on `master-v4.mp4` | Existing `output/studio-148-15-14-20261115/film14` | Full receipt, decode, exact-version playback, owner save decision packet |
| 6 | Studio | #15 | Authorised Director write, refusal and persona states | Studio main evidence | Live conversation → revision → MCP read-back + refusal |
| 7 | Studio | #11 | Authenticated MCP edit/write and revocation walkthrough | Studio main evidence | Tool call mutates only claimed project; revoked token refused |
| 8 | Studio | #148 | Remaining sibling-pane interactions and recorded journey | Studio workbench | Keyboard/focus, conflict recovery, phone/desktop recording |
| 9 | Studio | #2 | Studio creation/tools/change proof through Composer | Composer + Studio evidence | One coherent owner journey with live links |
| 10 | Composer | #625 | Task-first launcher with recent-project return path | `codex/task-launcher-1116` | ≤2 selections to three real jobs; reload-safe context |
| 11 | Composer | #626 | Producer, Marketer and Operator pathways | Launcher + docs hub | Real journeys using current surfaces |
| 12 | Composer | #623 | Newcomer and owner journey ledger | Live browser session | Observed task completion and defects fixed |
| 13 | Composer | #609 | Docs hub remaining independent-consumer and a11y gates | `main` docs | Search/copy/no-JS/keyboard/phone evidence |
| 14 | Composer | #425 | Get Ready → Init → export → owned deploy → return | Existing flagship lane | End-to-end proof with exact source |
| 15 | Composer | #600 | Blueprint/portable block return path | #425 evidence | Rebuild from exported pack and compare |
| 16 | Composer | #598 | Enquiry → draft → approval → send → receipt | Guestbook #42 grant | Authorised send receipt or truthful dispatch blocker |
| 17 | Composer | #597 | Portable job handoff with browser/desktop automation | #598 path | One real copied job and receipt |
| 18 | Composer | #615 | Work-pack knowledge workflow | #597 path | Real professional workflow artefact |
| 19 | Composer | #621 | Released skin in a second real consumer | Existing skin release | Live save/publish/restore on both |
| 20 | Composer | #622 | Trusted component intake and split comparison | #621 evidence | Live comparison and accessible controls |
| 21 | Composer | #617 | UI SDK behaviour in a real Studio workflow | Studio + Composer | Portable block reused with safe agent control |
| 22 | Composer | #613 | Share/leaderboard/discovery proof from existing records | Share records | Public-safe live proof; no private data |
| 23 | Composer | #601 | Reproducible benchmark packs and matched runs | #624 receipts | Versioned pack ingest and compare |
| 24 | Studio | #157 | Read-only storage lineage and duplicate dry run (with #158) | `codex/portable-restore-1116` | Duplicate report, opt-in cleanup, originals preserved |
| 25 | Studio | #150 | Editable motion sequence used in the film | Existing film lane | Saved sequence → export → decoded output |
| 26 | Studio | #151 | Independent adapter qualification | Separate | Only observed licences/runners counted |
| 27 | Composer | #459/#490 | Story/tutorial corrections preserved; reproducible prompts | Docs lane | Every claim links to current proof |
| 28 | Composer | #420 | Public-safe Discord showcase for each coherent release | Integrator | Dry run, one send, read-back/reconcile |
| 29 | Composer | #11 | Release evidence index updated | Integrator | Exact source, version, checks, live links |
| 30 | Both | — | Close issues whose whole current acceptance passes | Integrator | Receipt comment + issue state |

## Queue rules

- Pick the highest-value ready item; do not wait for a human decision that only
  affects a different item.
- Reuse evidence only where source, revision and scope genuinely match.
- A merged change is not shipped. A live claim needs the released source and an
  affected-flow check.
- Record real blockers (credentials, owner approval, unavailable hardware) in the
  owning issue and keep other lanes moving.
