# Edit one qualified native run into the two films

This is a prepared source workflow for a 75-second overview and six-minute
technical film. No canonical native input or film is bundled with it. A passed
native receipt, matching capture-time assets, a reviewed edit and actual encoded
pixel/playback inspection remain required. Film duration does not complete #221:
the incident foundation, full restore and retirement remain outside this journey.
The maintained captions describe a pre-incident run. A receipt containing the
optional availability exercise is refused; that exercise needs its own accurately
scoped edit and cannot inherit captions saying no fault was injected.

The existing `capture-walkthrough.mjs` keeps its earlier local-excerpt mode. Its
explicit `--native-receipt` mode edits the actual native run; it never launches a
replacement demo, changes a source pin or calls a provider. Both modes use the
same browser-generated caption-strip compositor, existing Space font and existing
ffmpeg/ffprobe binaries. No remote Remotion module, new toolchain, installer,
voice or audio asset is involved.

## Select the canonical run

The host selects an absolute native receipt path and its independently approved
SHA-256. A JSON `passed` field by itself is not authentication or authority.
Keep the receipt and original assets together in their existing directory.
Validation requires:

- `composer.platform-native/1`, `qualification: passed`, complete four-actor
  capture, no failure/deadline marker, and confirmed browser/root/pointer cleanup.
- Clean selected Composer, Guestbook and Linkarooie source SHAs matching copied
  runtime and video identities. The actual Guestbook v2 source must be qualified
  without a pin override. The media renderer's source stays separate.
- Native session and virtual-passkey boundaries, two completed distinct team
  services, role-10 operator denials, actual synthetic member authoring with
  public contribution admission closed, private/approved/hidden/reapproved media,
  content-preserving update, unchanged Team B and refusal before allocation.
- Four continuous WebM captures with capture-time hashes, durations and actors.
  The renderer later probes the real codec and duration before encoding.
- `journey.captureAssets` entries `{path, sha256, actor, capturedAt}` derived from
  actual returned screenshot bytes, plus the compatible `screenshots` filename
  list. Names must be unique, local and unlinked. Capture times must belong to
  that run. Legacy filename-only screenshots cannot become final media inputs.
- Optional `journey.captureInspectionHoldMs` records deliberate visible
  inspection time after each real screenshot, within 0–5000 finite milliseconds.
  Older receipts default to zero. Every caption and media receipt discloses the
  recorded seconds per snapshot separately from an edited still's hold duration;
  recorded inspection is not represented as another performed action.

Neither source checks nor imported receipts establish production SSO, provider
permission, public-edge verification or a fresh-person admission claim. The
receipt and original recordings stay private. The final media receipt exports
only selected sources, team/request/stack/resource IDs, hashes and scope; it does
not copy browser storage, credentials or private session state.

## Write the reviewed edit

Use schema `composer.platform-native-edit/1`, the exact `nativeReceiptSHA256`, and
two arrays in `films`: `overview` and `technical-walkthrough`. Each segment is:

```json
{
  "chapter": "content",
  "caption": "content-private",
  "kind": "clip",
  "asset": "ACTUAL-app-user-CAPTURE.webm",
  "start": 100,
  "duration": 12
}
```

The filename and offset above are placeholders, not a selected successful frame.
Inspect the actual recordings before choosing intervals. A genuine still instead
uses `kind: still`, a capture-time PNG filename and `duration`, without `start`.
An optional still-only `crop: {x, y, width, height}` must remain inside that PNG;
the resolved edit retains the crop. Video cropping, playback acceleration and
automatic padding are unsupported. Durations use whole 30fps output frames.

Both films cover the following chapters once, in order:

| Chapter      | What its actual capture establishes                              | Technical caption IDs                                                                                       |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `authority`  | Current Get Ready/session/workspace and protected policy route   | `authority-session`, `authority-source`, `authority-capability`, `authority-observation`, `authority-scope` |
| `teams`      | Distinct team requests and deliberate role-10 delegation         | `teams-invitation`, `teams-member`, `teams-mode`, `teams-delegation`, `teams-complete`                      |
| `content`    | Exact grants, real canvas, pending privacy, moderation and media | `content-grants`, `content-canvas`, `content-private`, `content-moderator`, `content-revocation`            |
| `update`     | Same Team A identities/content and unchanged Team B control      | `update-plan`, `update-identity`, `update-content`, `update-control`, `update-public`                       |
| `boundaries` | Actual denials; explanation of the tested recovery contract      | `boundaries-scope`, `boundaries-policy`, `boundaries-operation`, `boundaries-test`, `boundaries-privacy`    |
| `limits`     | Exact local qualification, edit provenance and remaining gates   | `limits-runtime`, `limits-source`, `limits-edit`, `limits-gates`, `limits-review`                           |

The short captions `authority`, `delegation`, `canvas`, `moderation`, `update`,
`denials`, `recovery` and `limits` support the overview. Caption text lives in
`native-media-plan.mjs`; edit files select these maintained explanations rather
than introducing arbitrary success claims. The recovery explanations explicitly
say no outage or incident was injected in this native run. A freeze hold may
explain a tested boundary over its genuine capture; label and time it as a hold.
Do not stretch unrelated footage or hold a missing flow to reach a target.

An overview can use a deliberately selected eight-second source cut and 4.5-second
still in each chapter: 75 seconds. A technical film can use five useful
12-second caption segments in each chapter: 360 seconds. Those are editing
budgets, not generated selections. Use the actual controls/results, enough
normal-speed footage and readable, distinct explanations to earn the duration.
The validator accepts 60–90 seconds and 300–480 seconds, respectively, with real
footage and genuine stills in each film. It refuses repeated/overlapping video
intervals within a film. The same source may legitimately be selected separately
for the overview and technical film; both remain tied to the same native run.
Each technical chapter needs at least three distinct maintained technical
explanations. The technical film must include at least one minute of normal-speed
footage across all four actor recordings. These mechanical bounds do not replace
the editorial review of each actual control, result and explanation.

## Validate without rendering

This checks the receipt, every capture hash and the complete edit. It runs no
browser, ffprobe, ffmpeg, application or provider and writes no render root.

```sh
node labs/platform/capture-walkthrough.mjs \
  --native-receipt /ABS/canonical-native/receipt.json \
  --expect-native-sha256 APPROVED_64_HEX_SHA256 \
  --native-edit /ABS/reviewed-native-edit.json \
  --validate-only
```

Do not use a failed, preliminary, dirty-source or unbound run. Source validation
of this workflow does not relax the canonical-input gate.

## Render only after host admission and canonical selection

Use the normal shared-host queue and inherited completion acknowledgement. Only
after admission run the explicit render command:

```sh
PLAYWRIGHT_MODULE=/ABS/existing/playwright/index.mjs \
node labs/platform/capture-walkthrough.mjs \
  --native-receipt /ABS/canonical-native/receipt.json \
  --expect-native-sha256 APPROVED_64_HEX_SHA256 \
  --native-edit /ABS/reviewed-native-edit.json \
  --output /ABS/this-worktree/output/platform/native-final-UNIQUE \
  --render --admitted
```

`--admitted` does not acquire capacity; the renderer also requires the existing
supervisor's inherited reservation generation/completion environment. Run from a
clean committed media checkout. `PLAYWRIGHT_MODULE` selects existing Playwright and Chrome. Optional
`FFMPEG_PATH` and `FFPROBE_PATH` select existing binaries; their defaults remain
`/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/ffprobe`. The caption context
blocks network requests and loads only the existing embedded local font. The
encoder receives verified copies under one owned temporary root. Its original
native captures stay untouched.

The output must be a new, unlinked directory under this worktree's ignored
`output/`. Existing output is refused. Signal/failure cleanup closes the browser,
stops the active bounded local command, restores TMPDIR and removes the owned
root. The resulting success or failure receipt verifies removal before the
supervisor may acknowledge host cleanup. Partial outputs remain unqualified.

## Deliver and inspect the encoded result

Each film outputs H.264/yuv420p MP4 with fast-start metadata, no audio, 1600×1200
pixels and six embedded chapters. The 1600×900 stage fits the complete native
frame above a separate caption strip, preserving controls instead of covering
them. A full-page still may use a declared crop for readable controls. The exact
local demo/virtual-passkey scope, complete native source SHAs, canonical receipt
hash and both teams' IDs remain in every caption and transcript. Captions never
replace native source identity with renderer or production release identity.

The package contains:

- `overview.mp4` and `technical-walkthrough.mp4`.
- Matching `.vtt`, `.transcript.md`, `.chapters.json` and `-poster.jpg` files.
- Six chapter keyframes per film, extracted from the encoded MP4, with timestamps
  and hashes for final visual review.
- `native-edit.json` (original reviewed recipe) and `edit-manifest.json` (resolved
  cuts, source timestamps, still holds/crops, actors and capture hashes).
- `render-instructions.md` and a bounded `receipt.json` with renderer/native
  identities, tool versions, dimensions, durations, chapter checks, artifact
  hashes, scope and owned-root cleanup. Failure writes `failure-receipt.json`.
  Receipt checksum sidecars bind the final JSON after cleanup.

ffprobe checks actual encoded streams and duration. That does not establish
pixel quality or useful teaching. Review final playback, chapter transitions,
caption overflow/legibility, exact source labels and posters. Compare chosen
intervals with continuous source clips and the edit manifest. Keep media
publication, production release identity and broader #221/#215 acceptance
separate; none is inferred from a playable six-minute file.
