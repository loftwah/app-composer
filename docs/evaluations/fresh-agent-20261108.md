# Portable setup baseline with fresh agents — 8 November 2026

2026/11/08 in Australia/Melbourne; the seven sessions ran from
2026-11-07T22:28Z to 2026-11-07T22:52Z (09:28–09:52 AEDT). Source at run time
`main` `3819c953ce1b7844137c742d70c8f371e075f2d9`; the batch released as
`220a7438545644506ffe6f545604f03a4e0a1f4f` / Worker
`09b67f2d-bca4-4397-ad3f-a871b2f19599`, after production had been
`bcc8eca78c84cd5f2d7b6afad39150d81d51d89a` / Worker
`9b384c29-dd33-4172-8c9c-2cb79d7ca175`. Guide `app-composer.project-setup/1`.
Issues: [#292](https://github.com/loftwah/app-composer/issues/292) owns the
setup guide and this baseline, [#315](https://github.com/loftwah/app-composer/issues/315)
the role-pack contract, [#19](https://github.com/loftwah/app-composer/issues/19)
ongoing maintenance, [#11](https://github.com/loftwah/app-composer/issues/11)
release receipts.

This records seven independent agent sessions against the **actual Markdown
exported by `/setup`**: three new projects, three existing projects and one
repeat on a workspace an earlier session had already completed. Every assertion
ran outside the agent, in the harness's own process, after the agent exited. The
recurring owner, command, cadence, budget and regression rule are in
[`docs/setup-canary.md`](../setup-canary.md).

The 25 October lab recorded one new-project and one existing-project session.
That was enough to prove the export worked once; it was not the three-per-path
baseline #292 asks for. This batch supplies that baseline and adds the
prepared-project path.

## What each session received

Every case received one prompt built from committed inputs:

1. the case's short session wrapper, which says the owner pasted one exported
   guide and nothing else;
2. the **actual Markdown exported by the public `/setup` form**, captured by
   `scripts/setup-export.mjs` from a local render of this source;
3. for the existing-project cases only, the actual `/roles/v1/programmer.md`
   download.

The capture was re-run on 8 November against `main` `3819c95`. Both guide files
and both role-pack files came back byte-identical to the 25 October capture, and
the composed prompt is byte-identical too (`sha256:af578a67…`). The only
difference between this batch and the earlier one is the agent CLI version and
the date, so the two are directly comparable.

| Case | Mode | Export | SHA-256 | Bytes |
| --- | --- | --- | --- | --- |
| `new-project` | New project | `labs/fresh-agent/guides/new-project.md` | `c958f9b381ceda2132825029a3d6b44452352278ef9bf52229d437963fb95398` | 6,412 |
| `existing-change` | Existing project | `labs/fresh-agent/guides/existing-change.md` | `58a4c95656a0cca5d7a8073072e20f36696498758ae8ad9a6b40ede3c7dc2950` | 6,162 |
| `existing-change` | Role pack | `labs/fresh-agent/guides/existing-change-pack.md` | `0066058c64c1723679c8b1d9aab226b5bcc21e49d17468abf908072f19c45694` | 9,205 |

Fixtures are fictional and versioned. `prepare` copies a fixture into an owned
temporary root and makes one local commit, so every run records its own fixture
commit. The existing-project fixture has seven owner tests, an owner marker, an
owner configuration file and an unrelated dirty draft; the new-project fixture is
an empty owner folder with one marker.

## Method and independence

- One agent process per run, in its own owned root under the OS temporary
  directory. The harness refuses to write outside that root or the repository's
  ignored `output/`.
- The agent receives the prompt only. It does not receive the assertion list,
  this repository or the harness.
- Assertions run after the agent exits: byte hashes for owner files, the
  project's own test command, a real localhost HTTP probe, JSON shape checks
  derived from the role-pack source, and absence checks for unrequested provider
  or package surfaces.
- The transcript is scanned for this repository, the lab and the harness. Any hit
  marks the run `contaminated`, which outranks a pass.
- No Composer account, owner session, provider credential, deployment, package
  install, account creation or purchase was available to any case. The host's
  browser tooling was available; which tool a session used is recorded below.

## Results

Every assertion below ran in the harness process after the agent exited. Full observed details, hashes and prompts are in [`labs/fresh-agent/results-20261108.json`](../../labs/fresh-agent/results-20261108.json).

### Runs

| Run | Path | Guide SHA-256 | Assertions | Duration | Isolation | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| `new-project-1` | New project | `c958f9b381ce…` | 7/7 | 315s | clean | passed |
| `new-project-2` | New project | `c958f9b381ce…` | 7/7 | 252s | clean | passed |
| `new-project-3` | New project | `c958f9b381ce…` | 7/7 | 139s | clean | passed |
| `existing-change-1` | Existing project | `58a4c95656a0…` | 10/10 | 120s | clean | passed |
| `existing-change-2` | Existing project | `58a4c95656a0…` | 10/10 | 86s | clean | passed |
| `existing-change-3` | Existing project | `58a4c95656a0…` | 10/10 | 107s | clean | passed |
| `prepared-1` | Prepared project | `c958f9b381ce…` | 7/7 | 135s | clean | passed |

### New project and repeat assertions

| Assertion | `new-project-1` | `new-project-2` | `new-project-3` | `prepared-1` |
| --- | --- | --- | --- | --- |
| file-exists site/app.py | pass | pass | pass | pass |
| sha256 owner-note.txt | pass | pass | pass | pass |
| file-exists RUN-REPORT.md | pass | pass | pass | pass |
| dir-count-min site | pass | pass | pass | pass |
| command PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s site -q | pass | pass | pass | pass |
| http | pass | pass | pass | pass |
| absent-any | pass | pass | pass | pass |

### Existing project assertions

| Assertion | `existing-change-1` | `existing-change-2` | `existing-change-3` |
| --- | --- | --- | --- |
| file-exists role-output.json | pass | pass | pass |
| role-fields role-output.json | pass | pass | pass |
| sha256 owner-note.txt | pass | pass | pass |
| sha256 site.json | pass | pass | pass |
| sha256 notes.json | pass | pass | pass |
| sha256 scratch/owner-draft.txt | pass | pass | pass |
| text app.py | pass | pass | pass |
| command PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -q | pass | pass | pass |
| http | pass | pass | pass |
| file-exists RUN-REPORT.md | pass | pass | pass |

Totals: 7 sessions, **58 of 58 assertions**, 19.2 minutes of agent time, 7/7 isolation-clean, 0 sessions with a human action.


## What the sessions actually did

**`new-project-1` — 5m15s, 13 tests.** Created `site/` with a standard-library
server, a 13-test suite, a README and a `.gitignore`; notes persisted in
`site/notes.json`. It ran the suite, drove a browser journey, restarted the
server to prove persistence and compared `owner-note.txt` before and after. One
exploratory `curl -L -X POST` forced POST on the redirect target and returned
404; the session diagnosed the misuse and confirmed the 303 with its browser
check and a method-aware request.

**`new-project-2` — 4m12s, 24 tests.** In-memory notes rather than files, 24
tests, a README and a `.gitignore`. It updated the fixture README because the
file still said nothing had been built, and fixed a favicon 404 found during its
own browser check. No dependency, provider file or account was created. Its
`.playwright-mcp/` browser artefacts stayed inside its own workspace and were
removed with the root.

**`new-project-3` — 2m19s, 12 tests.** In-memory notes, 12 tests, and the host's
real Chrome through the browse tool for the page journey; it closed its tab and
deleted its session afterwards. One owner-note hash command ran from the wrong
directory and failed; it verified the same bytes with `git hash-object` against
HEAD instead.

**`existing-change-1` — 2m00s, 8 tests.** Baseline 7/7, `/about` returned 404
twice before the change, 8/8 after, and the new test also failed against a
pre-patch copy. `site.json`, `notes.json`, `owner-note.txt` and the dirty
`scratch/owner-draft.txt` were byte-identical afterwards. `role-output.json`
filled all eight Programmer fields; `PR` and `Reviewer` stayed honest instead of
inventing a remote or a person.

**`existing-change-2` — 1m26s, 8 tests.** Same shape. Its pre-patch
reproduction script failed with `ModuleNotFoundError` until `PYTHONPATH` was set;
it corrected its own invocation, repeated the 404 check, preserved the owner
files and removed its `/tmp` scripts.

**`existing-change-3` — 1m47s, 8 tests.** Baseline 7/7, 404 twice, 8/8; it used
`git archive` for the pre-patch copy, preserved the owner files and the
untracked pack, and had no failed verification command.

**`prepared-1` — 2m15s, 24 tests.** Started from `new-project-2`'s completed
workspace with the same guide and prompt. It read the project, noticed that the
guide's "site is absent" statement was stale, and verified the existing app
instead of overwriting it: 24 tests passed, the live routes behaved, the browser
journey worked, and `PORT` handling was checked. Only `RUN-REPORT.md` changed
(the old report named a different workspace); `app.py`, `test_app.py`,
`site/README.md` and `owner-note.txt` kept their bytes. One command used GNU
`timeout`, which macOS lacks; the session dropped that wrapper and repeated the
check.

## Failures, interventions and human actions

No human action, harness rescue or contamination occurred: `humanActions` is
empty and `isolation.clean` is true for every counted session. No documented
prerequisite failed, so no run is classified after-rescue. Four sessions
corrected their own commands during verification: the exploratory curl in
`new-project-1`, the wrong-directory hash in `new-project-3`, the missing
`PYTHONPATH` in `existing-change-2`, and the GNU `timeout` wrapper in
`prepared-1`. A self-corrected typo or exploratory request is disclosed here but
is not a rescue; a rescue means the setup could not proceed without a different
environment, tool or human step.

One further session is **discarded, not counted**. The first prepared attempt
copied the run root but kept a manifest whose `workspace` still pointed at
`new-project-1`, so the harness ran both the agent and the assertions in the
original workspace instead of the copy. The session was itself a reasonable
repeat (it recognised the completed app, tightened `/health` to return exactly
`ok`, updated two test assertions and passed 7/7), but its stated before/after
comparison observed the wrong directory. Its sanitised receipt is
[`prepared-1-mistargeted-receipt.json`](../evidence/setup-292-20261108/prepared-1-mistargeted-receipt.json);
the ignored transcript hashes to `ce650b4d…`. The manifest rule is now in the
canary document.

## Cleanup and contamination

All seven counted sessions wrote inside their owned temporary roots. Two also
touched the shared temporary base and cleaned up after themselves:
`new-project-1` created and removed `final-unittest.log`, and
`existing-change-2` created and removed `/tmp/repro_about.py` and
`/tmp/fieldnotes.out`. `new-project-2` left `/tmp/notes-app-browser.pid`, which
this batch removed after confirming the recorded process was gone. No Composer
account, owner session, provider credential, deployment, package install or
purchase was used.

After the ledgers and this document were written, the seven roots and the
discarded attempt's files were removed. No agent process, container, HTTP server
or browser tab from this batch remains; the browse session created by
`new-project-3` was deleted. No transcript referenced this repository, its lab
or the harness, so no run is contaminated.

## The recurring process

[`docs/setup-canary.md`](../setup-canary.md) names the owner (the Composer
delivery agent), the exact commands, a weekly alternating check, a monthly full
rotation, the per-session budget and the failure/backoff rule. This batch is the
first full rotation: three new, three existing, one prepared. Next due:
`existing-change` on 2026-11-09, `new-project` on 2026-11-16, full rotation on
2026-12-01.

One dated batch is a baseline, not a reliability trend. No reliability-over-time
claim is made until at least three subsequent dated rotations exist for this
guide version.

## Public surface check

The live page was checked at 1440 and 390 and by keyboard, independently of the
agent runs. 36 of 36 checks passed against
`https://composer.loftwah.com/setup` on Chromium 156:

- the initial preview, `/setup/template.md` and a fresh download are the same
  bytes; copy matches the preview after filling the form and after a manual edit;
- blank fields become explicit inspection instructions, not broken placeholders;
- copy rejection and a missing clipboard API both select the whole guide, focus
  it and announce the manual fallback;
- keyboard order reaches the mode choice, all fields, the action buttons and the
  preview with a visible 3px focus ring; the phone layout has no horizontal
  overflow and a full-width copy action;
- the page says preparing and copying works on a phone while execution needs a
  desktop or remote environment.

No defect was found, so no runtime source changed for this check. The batch's
only runtime change is the run ledger that feeds **Tested setups**; it released
as `220a743` / Worker `09b67f2d-bca4-4397-ad3f-a871b2f19599`, `/build.json`
matches, and the same 36 checks passed after the release with the new counts
visible. Raw result:
[`docs/evidence/setup-292-20261108/setup-ui-check-live.json`](../evidence/setup-292-20261108/setup-ui-check-live.json);
screenshots: [desktop](../evidence/setup-292-20261108/setup-desktop-1440.png),
[phone](../evidence/setup-292-20261108/setup-phone-390.png).

## What this proves, and what it does not

**Proven:** the exported guide, unchanged since 25 October, produced three
working standard-library applications and three bounded changes in an existing
project with no human help, and a repeat session reconciled the guide with a
project that already existed. Owner files stayed byte-identical in every
existing-project run. Every assertion is recorded with its observed detail in
[`labs/fresh-agent/results-20261108.json`](../../labs/fresh-agent/results-20261108.json).

**Not proven:** cross-client or cross-model behaviour (every run used OpenCode
CLI 2.2.6 and `opencode-go/deepseek-v4.1-flash` on one host); provider
onboarding, sign-in, DNS or deployment (deliberately excluded and never
attempted); the maintained Composer Hello path (not exercised — it needs an
authorised Cloudflare account); longitudinal reliability, cost, or a second dated
rotation; physical-device, screen-reader or non-Chromium acceptance; and any
behaviour of the Cloudflare Access-protected admin. External-project coverage
outside this fictional fixture is recorded separately in
[`existing-projects-20261025.md`](existing-projects-20261025.md) and
[`real-project-adoption-20261025.md`](real-project-adoption-20261025.md); those
are different sessions and are not counted here.

## Reproduce it

```sh
pnpm dev
node scripts/setup-export.mjs --origin http://127.0.0.1:4321
node scripts/eval-fresh-agent.mjs check
export OPENCODE_CLI="$HOME/Library/Application Support/ai.opencode.desktop/cli/2.2.6-arm64/opencode-cli"
BASE="${TMPDIR:-/tmp}/composer-setup-canary/20261108"; mkdir -p "$BASE/receipts"
node scripts/eval-fresh-agent.mjs run --case new-project --root "$BASE/new" \
  --agent opencode --bin "$OPENCODE_CLI" --timeout 900
node scripts/eval-fresh-agent.mjs run --case existing-change --root "$BASE/existing" \
  --agent opencode --bin "$OPENCODE_CLI" --timeout 900
node scripts/eval-fresh-agent.mjs summarise --receipts "$BASE/receipts"
```

The repeat case copies the completed workspace, and the copied manifest's
`workspace` field is rewritten to the copy, then the same case runs again with
`--note "repeat on a prepared project"`. The harness refuses to write outside
the OS temporary directory or ignored `output/`, starts one process per run and
never retries silently.
