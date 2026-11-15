# Rolling delivery batch — 16 November 2026

Owner instruction: run an ambitious rolling batch across App Composer and Media
Studio, implement important features, merge, deploy, verify live and close issues
whose current acceptance is satisfied. This record states the exact released
sources, the evidence gathered and the work that remains open.

## Release identities

| Surface | Source | Worker version | Live identity |
| --- | --- | --- | --- |
| App Composer | `9be55b90a153bfaa8764a68e2acfa713cd9fdea3` | `2f6daeec-da37-4472-8ff5-cec205d6e15e` | [build.json](https://composer.loftwah.com/build.json) |
| Media Studio | `4a14ca3e09071edb862b3cc0bd9ec1cc004a2cca` | `1932f786-d34b-47b3-ba43-37fa91768dec` | [build.json](https://media.loftwah.com/build.json) |

Both used the existing guarded clean-pushed-main paths. Studio applied
`0018_portable_project_imports.sql` and then `0019_review_rooms.sql`; Composer
applied its normal idempotent workspace migrations. Later docs-only commits do
not require another redeploy.

## Shipped

### 1. Measured release watchdog — Composer #624, Studio #160

One monotonic run ID covers the required check through exact live identity. A
redacted `release-timing/v1` receipt is written under ignored `.release/timing/`.
Exactly 300,000 ms is a breach; only strictly below passes. A breach creates or
updates one open `delivery-sla` issue per repository/release-path/slowest stage.
A failed GitHub write leaves a redacted pending event for the next run.

Evidence:

- Real Composer releases **92.5s** and **95.4s**, status passed; the second
  included the docs/link fixes and live verification.
- Real Studio releases **25.5s**, **26.5s** and **27.0s**, status passed; the
  last two include a remote migration.
- 16 focused fake-clock tests: 299,999 passes; 300,000 and 300,001 breach;
  dedupe; separate bottleneck; failed, aborted and successful-but-slow runs;
  mismatched live revision; missing GitHub; pending retry; recovery evidence;
  stale running receipt; forged receipt; redaction.
- Controlled real GitHub write: created issue #630, found it by fingerprint,
  commented, then closed and reconciled it. The test found and fixed a real
  1 MB `gh` output-buffer defect (`6b708fc`).
- `pnpm release:watchdog --check-stuck` reports no stale runs; pending retry is
  empty.

Still open: a genuine natural ≥300s breach → issue → fix → compliant release,
and rollout beyond Composer and Studio.

### 2. Producer, Marketer and App Operator pathways — Composer #626 (closed)

Six new role/job routes using only live destinations: the published Paper &
Light film and free local audio trim; the Media Studio share kit with Link
Check; and the Trail Notes owner workspace with public activity and release
evidence. Each states the free, paid and access boundary.

Evidence: fresh anonymous Chromium completed each journey in **two selections**
(1.5–3.3s), primary destinations all 200; 320/390/1440 no horizontal overflow;
one H1 per page; 12 keyboard focus stops with visible outline; reduced motion;
OG metadata and sitemap entries present; stale role returns 404. Journey ledger
registered in #623.

### 3. Task-first, project-aware launcher — Composer #625 (closed)

One destination registry (41 unique: 37 public, 4 invitation/owner), three
anonymous task groups, ranked aliases, collapsed advanced shortcuts, and a
read-only session-derived Recent projects endpoint.

Evidence: fresh anonymous `Create a site` in two selections (0.8–1.5s), 37
destinations and no private routes; signed-in owner at 1440/390 sees **Continue
editing Fictional Trail Notes · Published**, its published page and All
projects, and the Continue link opens the exact native editor. 320/390/768/1440
no overflow, 44×44 close target, Cmd/Ctrl+K and Escape focus behaviour verified;
28 focused tests pass. Studio keeps its own 13-destination launcher and
branding; Ctrl+K/Escape/focus return verified there too.

### 4. Portable Studio project bundles — Studio #157 (slice)

`studio-project-bundle/v1` archive plus owner CLI export/inspect/import with
dry-run, deterministic manifest, content hashes and integrity trailer. Local
restore proves exact byte/hash round trips, editable state, tamper refusal,
missing-media refusal, duplicate idempotency and opt-in cleanup.

Evidence: live owner export manifest **200**, 30 asset records, 27 unique
blobs, **158,616,199 content bytes**, 12 generations, 3 compositions, 1 song
plan, 1 publication; every asset hashed, every path content-addressed, no
credential-shaped key or value. 13 focused tests and the full 342-test suite
pass.

Still open: a real export/restore into a separate fresh D1/R2 installation,
which needs the standalone owner passphrase or a transferred owner session.

### 5. Private, version-pinned review rooms — Studio #159 (slice)

A room pins one saved image or film at its SHA-256, with hashed bearer token,
expiry, revocation and rotation. Reviewers see only the pinned version and can
leave timecoded or point-anchored feedback and an explicit approval/change
request. The creator inbox groups feedback by version, shows decisions and
compares two versions.

Evidence: real image room at SHA-256 `4a28077a…`, region feedback at 20%/80%,
persisted after reload, creator saw **Changes requested**; video room at a
5.184s clip, feedback at 0:02.0–0:04.0, timecode sought the player to 2.25s,
explicit approval persisted. Reviewer HTML contained no project ID or project
name. Creator compare showed both version labels and hashes. Revoked links and
`/media` returned **410**; open media used `private, no-store`,
`no-referrer` and `noindex`. 367/367 tests pass.

Still open: reviewer-side comparison of two room links, two anchored comments
in one walkthrough, recorded MacBook/390 journeys and a same-source revision.

### 6. Documentation hub gates — Composer #609 (slice)

Live `/docs` audit: 55/55 internal links HTTP 200, all 25 known fragments
present. Fixed Escape after ArrowDown, added a no-JS former-section index and
corrected the template-vs-completed copy note. The exact copied existing-project
template was given to a fresh ephemeral Codex session; it inspected read-only,
ran the documented test once, made no changes and stopped for authorisation.

Still open: the five-person first-visit test, a second vendor/CLI and
new-project path, native zoom and a physical screen reader.

## Closed in this batch

- Composer #626 — Producer, Marketer and App Operator pathways.
- Composer #625 — task-first, project-aware launcher.

## Remaining owner decisions / gates

- Studio #14: listen to `master-v4.mp4` and choose A save+publish, B save
  private, C keep v1, or D revise. A private side-by-side review page is
  prepared locally; no production write has been made.
- Studio #15/#11: authorised agent write, refusal and persona walkthrough.
- Studio #157: owner-run production restore with the passphrase/session.
- Studio #159: reviewer-side comparison and recorded journeys.
- #624/#160: a genuine natural breach-to-fix loop and remaining portfolio
  rollout.
- #609: human first-visit test and a second independent agent.
- #158 and #601: first slices are running on separate branches.
