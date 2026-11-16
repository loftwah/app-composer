# Delivery train — 16 November 2026 (evening)

This record covers one coherent pass across App Composer, Media Studio and the
independent Linkarooie app. It keeps shipped evidence, slice progress and the
remaining owner gates separate.

## Baseline

- Composer main was `b1f2500` (evidence-only ahead of live `f6aa705`).
- Media Studio main and live were `eb127cf`.
- Linkarooie standalone live was `e6780997`.
- 145 open Composer issues and 20 open Studio issues at the start.

## Releases

| Surface | Source | Worker version | Result |
| --- | --- | --- | --- |
| Composer | `c5a08ca76e6dfaa427a65747343918f07a85b84f` | `ff76b432-a471-4689-9b62-57c955d2b12a` | guarded release passed in 118.5 s |
| Media Studio | `0c3a69ee2ee5dbcac5e56416b0cac13c7bff6111` | `ebb00220-2d3e-4d5a-ae53-45777bcd0f49` | release passed in 26.8 s |
| Linkarooie (standalone) | `7d7287357a4780a41dbf368f69ccfd6904c9a374` | `a52769d4-21f2-46b7-bd4d-2b36e333e688` | `build.json` and sharing probe verified |

Composer also passed through `a81c21b` and `106fa3a` before the final
candidate; each was a separate guarded release. The final live identity is
`c5a08ca`.

## 1. Studio image workbench

Live: https://media.loftwah.com/tools/images

Shipped in the signed-out browser-local workbench:

- 8-colour alpha-aware palette with coverage, HEX/RGB/HSL and copy actions.
- Pointer and keyboard eyedropper on the encoded result.
- Verified target-size export for JPEG/WebP with a bounded deterministic
  quality search; PNG refuses the byte target honestly.
- Exact alpha-bounds trim and smooth/nearest resampling.

Live checks on the sample image:

- Palette: 8 colours, 79.7 % of visible sampled pixels, 1400 × 900 working copy.
- Target 50 KiB: **met**, 47 KiB at q84.
- Target 20 KiB: **not met**, 23 KiB at q35, 2.5 KiB over; the page said so.
- Eyedropper: `#d0d6cb` at pixel 560, 451.
- 390 px: `scrollWidth === innerWidth === 390`.

The workbench tests passed 528/528 in the worker's worktree and again in the
merged Studio source. The full suite ran before the release.

## 2. Linkarooie analytics and public proof

Live: https://showcase.loftwah.com/

The standalone app now records opt-in aggregate counts in its own D1:

- `usage_daily` stores only UTC day, allowlisted kind, bounded public key and a
  capped count. No IP, user agent, referrer, cookie, session, visitor id, raw
  URL or query string is stored.
- Owner API `GET /api/usage?window=30` returns complete UTC days plus a private
  “today so far” partial day. Public proof exposes two totals only.
- The public block was enabled for a controlled check, then withdrawn:
  `/api/usage/public` returned 404 and the HTML contained no
  `data-usage-block`. Recording stayed enabled.
- Verification counts on 16 November: 11 profile opens, 2 link actions, 1 share
  action. These are test visits and are labelled as such here.

The existing Composer analytics page still shows the broader record:
https://composer.loftwah.com/activity/showcase?days=30&surface=all&metric=app_opens
reported **762 recorded opens** for 30 complete UTC days at the time of review.
That is a request count, not people.

The Composer composition pin still points at the older Linkarooie source, so the
composed route does not yet carry this block. The standalone app is ahead, as it
was before this pass.

## 3. Command centre

The native admin page now reads:

- open pull requests, their review decision and combined check state, separately
  from issues;
- a second live release identity from each repository's public `build.json`;
- Projects V2 availability, without inventing a board when the credential or
  scope is absent.

Live probe of the production adapter at the released source:

- `loftwah/app-composer`: live `c5a08ca`, default branch `c5a08ca`, match;
  0 open PRs; Projects V2 unavailable with the reason.
- `loftwah/composer-media-studio`: live `0c3a69e`, default branch `0c3a69e`,
  match; 0 open PRs.
- The live identity is read through the same Worker's public `workers.dev`
  hostname because a Worker cannot reliably fetch its own custom hostname. The
  canonical URL is still shown, and the read address is disclosed.

A read defect was found and fixed during live use: the first release showed the
live source as unknown because the adapter fetched the custom domain from inside
the Worker. The public hostname read fixed it.

## 4. Benchmark observations are append-only

Live: https://composer.loftwah.com/benchmarks/media?run=animate-a-still-v1-d20cbf5

A real defect was reproduced before the fix: a blind vote for take A at
11:08 UTC was silently overwritten at 11:55 UTC by a second vote under the same
self-declared `visitor` label. The evidence JSON kept only the later row.

The fix rebuilds the vote table with a server submission id and a random
per-browser reviewer token. Every submission inserts a new row; reasons and
chips persist; exports expose a token hash, never the raw token. The legacy row
was preserved with its original choice and timestamps. The earlier A vote is
lost and is not reconstructed.

Post-fix live proof: 3 submissions are retained on the same pair, including a
new reasoned observation with `B: holds the still` and `B: smoother motion`.
Before voting, the HTML contained no model or provider identity.

## 5. Model comparison judgement

Job: animate the supplied still as a slow push-in, holding the palette, grain and
marks, with no new objects or scene change.

| | Take A | Take B |
| --- | --- | --- |
| Output | 1344 × 768, 5.184 s | 1920 × 1080, 5.042 s |
| Bytes | 2,658,207 | 14,658,571 |
| Audio | AAC track present | silent |
| Saved-job latency | 17.1 s | 141.2 s |
| Studio estimate | US$0.24 | US$0.35 |
| Observed checks | fails both job checks | holds both |

Frame analysis: first frame versus source still mean RGB difference A 5.26,
B 2.21; first versus last frame A 84.23, B 10.64. Take A morphs into an invented
lamp-and-paper scene. **Take B is better for this job**; A is faster and cheaper
but fails the brief. This is one saved job per model and not a ranking.

## 6. Complete creator path

1. Added the milestone **Complete creator path replayed** in the Linkarooie
   manager, saved it as a draft, published it, hid it and published it again.
   The public page showed it only in the published states.
2. Shared the profile: native sharing was unavailable in the controlled browser,
   the copy fallback reported `Link copied.`, and the canonical/OG metadata
   described the published profile.
3. Read the analytics page and the owner API totals.
4. Took an owned 1536 × 1024 JPEG (222 KiB, SHA-256 `27671d97…`) through a 16:9
   centre crop and a 1200 × 675 WebP export (86 KiB, result SHA-256 `cf5e94ee…`),
   imported it as `asset_7dd805d42a40439b9b6fb0926425f54f` in the controlled
   **Agent proof** project, and reused it in the project's **Compare stills**
   operation.
5. Published that result as an unlisted page
   https://media.loftwah.com/p/zkwptZV2TQMMl_Dk and added it to the gallery
   (17 works). Withdrawal was attempted after the owner session expired and did
   not complete; the page remains listed and the exact owner action is below.
6. Compared the two Studio takes and recorded the judgement above.

The step-by-step replay is in
[the complete creator path runbook](../../runbooks/complete-creator-path.md).

## 7. Bluesky publishing adapter

The bounded send path is deployed with migration `0035_bluesky_deliveries`:

- app-password session creation and refresh;
- deterministic record key, bounded text/link/image checks, blob upload and
  `createRecord`;
- atomic claim, terminal receipts, cancellation, `unknown` reconciliation by
  reading the record, and native permalink capture;
- encrypted native app-password setting; no credential was provided and **no
  post was sent**.

The existing Fictional Trail Notes draft remains a fixture. The owner's latest
direction selects a real project showcase instead; the exact proposed post and
approval still need the owner in the share calendar.

## Limits and owner gates

- **Cloudflare Access session expired** during the pass. Re-authentication is
  required before the owner can reopen the Composer admin, Linkarooie owner
  studio or the Studio owner session.
- Studio publication withdrawal was not completed after the session expired.
  The controlled page remains listed at `/p/zkwptZV2TQMMl_Dk`.
- The Bluesky send requires the owner to create an app password and store it in
  the encrypted `Bluesky app password` setting; the exact public handle must
  match `SHARE_BLUESKY_HANDLE`.
- The Linkarooie composition pin is older than the standalone app; the composed
  analytics block is not live.
- The benchmark pair has one job per model, no repeated trials, different output
  resolutions, one audio track and a recorded prompt/still conflict. It is an
  observation, not a ranking.
- Physical-device, real-human newcomer and independent-owner proof remain open
  in their owning issues.
