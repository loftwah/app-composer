# Batch release — 15–16 November 2026

Owner instruction: deliver the next substantial App Composer and Media Studio
batch, carry it through release and verify it in the real product. Four
implementation lanes ran in parallel in isolated worktrees, each with one writer
per surface; integration, release and live verification were done by the release
owner. This record states what is proven, where, and what remains.

## Release identities

| Surface | Source | Worker version | Live |
| --- | --- | --- | --- |
| App Composer | `2afd53b861aaf5ea6332a4212b11634315f08825` | see `/build.json` | [build.json](https://composer.loftwah.com/build.json) |
| Media Studio | `e8b3778cd5d800378f42985afda80820fcb7ef57` | `1a7a58a3-a91c-4665-91d0-d3df12467e77` | [build.json](https://media.loftwah.com/build.json) |

Both releases used the existing guarded clean-pushed-main paths. Composer
applied migration `0029_media_workspace_authority.sql` as a release stage
before upload. Studio needed no migration.

The Composer tree merged four branches: `codex/batch-runtime-1115`,
`codex/batch-docs-1115`, `codex/batch-design-1115`, plus the release owner's own
follow-up fixes. Studio merged `codex/studio-batch-148-14-15`.

## App Composer — #599 workspace-scoped media authority

- Authority is derived server-side from the current workspace and the
  `media-studio` / `studio-installation` grants; the agent route admits only an
  owner-issued, hashed, expiring workspace grant. `enable`, `disable`,
  `refresh`, `adopt`, `grant-agent` and `revoke-agent` are refused on the agent
  path.
- Authority is rechecked at status, reconcile, import and again immediately
  before dispatch. A revocation turns a recorded intent into `refused` with
  `REVOKED` and makes no provider call.
- Migration `0029` is additive and idempotent. **No automatic workspace
  backfill:** every pre-existing job is copied once into owner custody
  (`custody:owner`), because no legacy row carries provable workspace
  ownership. Nothing was renamed, dropped or rewritten.
- Two-workspace acceptance (fictional fixtures) covers distinct connections and
  credentials, `LEGACY_SCOPE_TAKEN`, identical-text cross-workspace refusal,
  revoked grant/agent grant/expiry, concurrent dispatch, replayed results,
  one-file import with recorded SHA-256, custody and audited adoption.

**Live, after release** (`/_emdash/admin/plugins/composer-media`, owner session):

- Header names the workspace: `APP COMPOSER · OPTIONAL CAPABILITY · DEAN`.
- **Project jobs** is empty; a separate **Owner custody** section holds the real
  13 November 21:53 job from the pre-scoping deployment, with its prompt excerpt,
  model, state and imported-copy state. It is not mixed into the workspace list.
- The panel reports `Off · oyster-media.loftwah.workers.dev · deployment
  credential` before enabling — it previously claimed no host was configured even
  though the deployment credential could serve this workspace. That wording is
  fixed in the same release.
- The owner then enabled the capability against the existing deployment
  credential (one workspace, `deployment-legacy` scope). Catalogue check
  16 November 12:32 AM, 13 models. Toggling off and on updates in place.
- Anonymous and bogus-token `POST /api/media-agent` return 401/403
  (`That agent token is not admitted`); an admin action on the agent path is
  refused before any effect.

**Remaining:** the custody job stays in owner custody until the owner adopts it
(explicit, audited, no provider call). Provider charges remain unreported.

## App Composer — #609 documentation gaps

- Copy now decides `copied` / `manual` / `empty`, guards a missing Clipboard API,
  catches denial, opens and selects the full prompt, changes the button to
  "Copied" and clears it after 6 s (success) or 12 s (failure). Each control has
  a distinct accessible name, a `role="status"` announcement, and a labelled
  prompt region.
- New `#operate` section adds browsing-vs-writes, exact commands, maintained
  paths and six named recoveries, indexed by search.
- **Live** (`/docs`): the seven controls now read
  `Copy prompt template: I'm new to AI agents`, `… I have an idea for an app or
  site`, and so on. Clicking one changes the label to "Copied" and announces
  *"Copied. Paste it into your chosen agent, then answer or replace the bracketed
  details."* 390 px has no horizontal overflow; dark theme checked.
- **Fresh-agent replay (release owner):** the canonical copied text for
  "I already have a project" was given, verbatim and alone, to a fresh agent in a
  fictional project. It inspected read-only, ran the documented `node --test`
  (2/2), separated supported / bounded-local / unverified / planned / unsupported
  claims, reported what it could not verify, changed nothing (byte-identical tree
  hash before and after) and stopped for authorisation. The fixture was removed
  after the run.

**Remaining:** the five-person human acceptance and the independent cold visitor
are still people, not code.

## App Composer — retired-model claims and #495

- `/media-studio` no longer offers SDXL Lightning as a current route. The
  capability table, evidence row and tutorial now name Studio Print, Studio
  Film, Studio Draft · FLUX.2 Klein 9B and Studio Quick, with the retirement
  dated 15 November 2026 and saved jobs keeping their exact SDXL attribution. The
  14 November article snapshot carries a dated correction block; history stays.
- The tutorial's stale "revision 2 sound defaults" and an unverified 16-second
  clip limit were corrected against `mediaStudioRevision = 3` and the documented
  ≤10.5 s limit.
- #495 was re-checked against its five visitor observations: the first viewport
  holds the product name, "Build an app you own.", one primary action, two
  secondary routes and the Get Ready explanation, with the workshop well below.
  Only the artwork credit copy changed.

## App Composer — #621/#622 appearance skins

- A portable skin contract now compiles the admin layer and a public preview
  from the same parts. A second original skin, **Contact sheet**, joins Workshop
  press. The public `/appearance` page is a second consumer using the same
  compiler, with its own device storage and no publish path.
- Brand Studio compares the published version with the saved draft through a
  split view whose only control is a native range input.
- #622 records all five named sources with pinned commits, licence files,
  mechanism, fit, accessibility/performance cost and an adopt/adapt/defer
  decision. The one adopted mechanism (a compare slider, MIT) is reimplemented,
  not copied, and wired to real saved versions.
- **Live lifecycle on the owner's admin:** saved draft version 6 with Contact
  sheet (published stayed 5) → published version 7 → the served
  `/_emdash/composer-admin-brand.css?version=7` grew from 857 to 1,576 bytes and
  carried `--composer-skin-*` tokens → restore review cancelled (published stayed
  7) → restore confirmed → version 8, served CSS back to 857 bytes with no skin
  tokens. The published appearance is back to the owner's original.
- The public `/appearance` page had a production-only CSP violation from an
  inline `--split` style; it now sets the property through CSSOM, and the page
  loads with no CSP error at 390 px and 1440 px.

**Remaining:** physical vibration strength, iOS Safari, screen-reader speech and
owner visual acceptance are not claimed.

## Both apps — #590 step 1, shared Apps interaction

- Composer `/`: `.app-launcher` opens on Enter and ⌘K, closes on Escape, returns
  focus, 38 destinations.
- Studio `/` previously toggled `aria-expanded` with `aria-controls` pointing at
  a missing `#app-navigation`, so the trigger did nothing. The Studio now renders
  the dialog beside the trigger with Studio-local destinations only (`#/`,
  `/gallery`, `/compare`, `/portfolio`, `/help`) and the corrected
  `/docs/how-it-works#standalone-get-ready` path. Live: opens with 14
  destinations, Escape closes, focus returns to the trigger.

## Media Studio — #15 Studio Director (production)

The Director turns one creator request into a typed scene-direction proposal on
saved song scenes. It reads only that project's saved plan text, timing and asset
titles, makes one bounded Workers AI text request
(`@cf/meta/llama-3.1-8b-instruct-fast`), and returns before/after directions with
a review digest. It cannot change takes, timing, references or captions, generate
media, publish or spend.

**Live on the owner's LoftwahFM project, plan revision 4 → 5:**

1. Ticked Scene 2, asked *"Only scene 2: keep the same shot and take, but hold the
   wide a beat longer before the beam turns, then let the figure enter later. Do
   not change anything else."*
2. The model proposed one change. The review showed the exact before/after
   direction and stated that timing, selected takes and captions were unchanged.
3. Applied to draft, then saved: **revision 5**. Status announced "Scene plan
   saved."
4. Reload and the project API both return revision 5 with only Scene 2's
   direction changed. All six `selectedTakeId` values are identical to revision 4.
5. A fresh `studio.read` MCP grant read the same plan and returned **revision 5**
   with the same Scene 2 text and the same six takes. The connection was revoked
   immediately afterwards ("No active connections"), and the token then returned
   401.

## Media Studio — #148 workbench and #151/#150 qualification

- Browser evidence harness in `tests/browser/` records 113 workbench checks
  (six long scenes at eight viewports, 200%/400% reflow, save/reopen, real 409
  conflict with draft retention and focus return, reduced motion, Firefox and
  WebKit), 21 launcher checks and 21 Director checks.
- `#151` publishes a primary-source licence/runner matrix for Hunyuan3D-2,
  TRELLIS, LTX-2.5, LivePortrait, RIFE and MusicGen. Every execution verdict is
  BLOCKED or PILOT-not-run because no GPU runner is authorised.
- `#150` publishes the eight-project motion-stack review. No library is
  installed and no motion scene/editor/export exists yet.

## Media Studio — #14 new film, saved in the production studio

- Saved from the Director's **plan revision 5** through the Studio's own local
  renderer, on the owner's LoftwahFM project. No provider call, no generation
  charge.
- Storyboard `cmp_song_plan_f767c7cfc49143f8b54aadf02b376595_5`, six shots,
  33.0 s, mixed bed from the real After Hours master.
- Saved asset `asset_78f2ecb3c9d547a8a08ff6efc639b279` — **5,490,517 bytes,
  640×360, 33,041 ms, SHA-256 `fb5d5bc07ff5c2b6bfbe9a096f0527082179ff06ee43d260427cbb4e5c2eb5d4`**,
  `video/mp4`, range requests supported.
- **Independent decode of the saved bytes in the browser**: 48 kHz stereo,
  33.04 s, RMS −21.5 dB, peak −5.0 dB, 99.89% non-zero samples — audio present,
  non-silent, unclipped.
- Played in the live viewer unmuted at 0.6: `readyState 4`, duration 33.04 s,
  playback advanced to 2.44 s.
- The earlier independent decode of the captioned master (`master-v4.mp4`,
  SHA-256 `0aadb31b…`, 33.78 s, mean −19.0 dB) and the 16.8 s caption-burned
  render remain as separate caption proof. This new film carries no burned
  captions because the After Hours plan has no saved cues; inventing lyric text
  over an original song would misrepresent it.
- Scene 4 of the plan still uses `asset_ad1a6388…`, the take that replaced
  `asset_cbb55ec2…` at revision 4; both takes remain saved.

**Remaining:** nobody has listened to the film. By-ear acceptance is MP's.

## Checks run

| Command | Result |
| --- | --- |
| Composer `pnpm check` (inside `pnpm deploy`) | 0 errors, 0 warnings, full suite pass |
| Composer focused media suite | 26/26 |
| Composer docs/appearance/media suites | 42/42 |
| Studio `pnpm check` before deploy | 329/329 |
| Studio browser harness | 113 workbench, 21 launcher, 21 Director |
| Studio film harness | 26/26 |
| Composer freshness | 27 dependencies ok, 0 drift |
| ffprobe / ffmpeg on `master-v4.mp4` | h264 640×360 + aac 44.1k stereo, 33.78 s, mean −19.0 dB |

## Remaining gates

1. MP's by-ear sign-off on the new film (it is now saved in the production
   studio).
2. Adopt (or deliberately retain) the pre-workspace 13 November media job that
   sits in owner custody.
3. A GPU runner, if any #151 candidate should ever move past qualification.
4. Independent newcomer, five-person docs acceptance, cold visitor and social
   posting all need people or separate authority.
5. Physical iOS Safari, vibration and screen-reader speech are unverified.
