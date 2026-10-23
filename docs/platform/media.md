# Recorded local platform excerpts

The separate [native media workflow](native-media.md) prepares the 75-second and
six-minute edits from one passed, cleanup-confirmed native run with capture-time
asset hashes. It is source preparation only until a canonical run and reviewed
edit are selected and the encoded files pass playback/pixel review. The excerpt
receipts below are not eligible substitutes for that native input.

Reviewed 23 October 2026. These videos show actual browser pages from the public guide and the [local two-team specimen](demo.md). They are captioned local excerpts of verified results and evidence inspection; they do not show a person completing native administration or enterprise admission.

## Outputs

These are useful local excerpts, not the completed #221 media deliverables. #221 requires a 60–90 second overview and a 5–8 minute technical walkthrough of the complete journey. Native-production request/review/update footage and the actual #215 incident/responder foundation remain necessary. The shorter excerpts are not padded or presented as that complete workflow.

Local checkout links (ignored artifacts, not public publication): [overview excerpt](../../output/platform/media/overview.mp4) and [technical excerpt](../../output/platform/media/technical-walkthrough.mp4).

The capture writes only final media and bounded evidence under ignored `output/platform/media/`:

- `overview.mp4`: approximately 38 seconds, local excerpt introducing the supported scope, Atlas's published stack and recovered app, unaffected Beacon and the actual teaching-policy control.
- `technical-walkthrough.mp4`: approximately 74 seconds, local excerpt with eight embedded chapters covering source/scope, publication, app/media, team isolation, the read-only run receipt, unsupported targets, durable-operation reconciliation and qualification limits.
- Matching `overview.vtt` and `technical-walkthrough.vtt`: readable caption text and timings. Captions are also burned into both MP4s. There is no narrated audio.
- Six overview screenshots, two evidence screenshots and three captioned keyframes per video.
- `local-runtime.json`: the exact fictional run receipt, including authored module hashes, checks and operation/export identities.
- `receipt.json`: actual browser/FFmpeg versions, source identities, hashes, byte counts, dimensions, durations, frame rates, chapters, browser errors and cleanup results. `ffprobe` validates the exported streams and chapter metadata.

Keep the JSON receipts with the videos. A screenshot or caption alone does not establish the operation sequence, runtime identity or production acceptance.

## Source and scope

The initial guide artifact on local workerd port 4390 reports `8aa00447ae4c35e373bdfc525ed858e31be32922` through `/healthz`. The independently executed local specimen uses Composer `841ea96b1f29f6abd5d357bd8351cc4fa2a7034b` and exact Guestbook `376129c8b48d29d26e982777084aa241966569c7`. These are separate source identities, named separately in the captions and receipt. The guide artifact was built before the concurrent change was integrated; it is not evidence of source parity with the specimen or a later production release.

The specimen creates both applications, performs Atlas updates, loses an acknowledgement after committed activation, reconciles the durable receipt, denies an out-of-policy update and verifies an approved-media export **before** browser recording starts. The footage then visits those actual resulting pages and inspects that same run's evidence. No dashboard, successful operation or interaction is fabricated. The read-only receipt page explicitly identifies itself as evidence rather than product UI.

Guestbook's actual Worker fetch handler runs on Node 22 with separate SQLite databases and an owned filesystem object-store adapter. It is not workerd or managed Workers execution. The composed app uses unchanged StackView React SSR inside a labelled local wrapper. Trusted synthetic actors simulate admission; Cloudflare Access, enterprise SSO and native EmDash session lifecycle are not exercised by these videos. The policy explorer is explicitly a teaching example. Kubernetes, vendor delivery, complete recovery and production are not claimed.

The actual public guide and Guestbook interfaces supply the approved identities visible in the recording. Caption strips reuse the existing Space font, canonical Composer orange and neutral surfaces. No new logo, generated product screenshot, title-card illustration or purchased media is introduced. Browser navigation and selected controls run at normal speed; there is no accelerated activity presented as ordinary interaction.

## Reproduce without installation

Use an existing Playwright module, installed Chrome and FFmpeg. The source checkout and module path are trusted host choices; neither is an imported recipe or browser argument. Start the separately qualified local guide on port 4390 before capturing.

```sh
COMPOSER_DEMO_GUESTBOOK=/absolute/existing/app-composer-guestbook \
PLAYWRIGHT_MODULE=/absolute/existing/playwright/index.mjs \
node --experimental-transform-types labs/platform/capture-walkthrough.mjs
```

Optional `FFMPEG_PATH` and `FFPROBE_PATH` select existing binaries. Defaults are the host's `/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/ffprobe`. No installer or provider credentials are used. The browser context blocks non-loopback HTTP destinations, including links or telemetry that might leave the owned specimen.

One owned `composer-platform-media-*` root contains browser profiles, original browser recordings, caption frames, encoder staging and the nested demo root. `finally` closes the browser, lets the demo close its listener/databases, restores the temporary-directory environment and removes only this root. The successful receipt verifies both demo and capture cleanup. A failed run saves bounded diagnostic metadata; partial footage never counts as a completed technical walkthrough.

The existing FFmpeg build lacks subtitle/drawtext filters. The capture therefore renders caption strips through the browser using the existing local font, encodes a caption track and composites it over the actual browser video. MP4 uses H.264/yuv420p with fast-start metadata; exported dimensions are 1600 × 900. Each final keyframe is extracted from the encoded MP4, so it verifies the delivered pixels rather than only the browser source.

Keep #221 open for its required complete overview and technical duration, native-production journey and real incident foundation. Before any public publication, review the exact final encoded files, preserve their source/receipt links and distinguish this local specimen from subsequent native-production footage. A later production recapture needs its own source/runtime receipt and must not silently reuse these local identities.

## Observed export verification

The completed capture produced a 38.28-second overview excerpt (941,662 bytes) and a 74.28-second technical excerpt (1,762,912 bytes). Both are H.264, 1600 × 900, 25 fps, with six/eight embedded chapters respectively. Zero browser exceptions and zero console errors were observed. Encoded overview, app and read-only-receipt keyframes were visually inspected; captions remain readable and identify the actual scope. Both nested-demo and capture-owned temporary cleanup checks passed.

| Local excerpt | SHA-256 |
| --- | --- |
| `overview.mp4` | `2e574cbc41559d8a140009e9b8a747fca6b62c38969c2218485c1414051a7693` |
| `technical-walkthrough.mp4` | `0974c6c8e88222397d190f8e22356f8051a752c5593169882e6dad77da1e1fed` |

The associated `local-runtime.json` hash is `e098c4b66a810894c10096b451c39b3dc234d876b49b7e2748bbd40dd0adcb71`. These identities describe local excerpts only; they do not close #221.
