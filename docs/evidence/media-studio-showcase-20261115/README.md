# Media Studio public showcase and vertical teaser

15 November 2026, Australia/Melbourne. Composer live source
`aaf8d5815c9e57d995dcf30150959ac0c48bd75a`, Worker `afd2d8f4-17b0-418d-b3de-4b265c3d05a8`.
Studio live source `a4f0e97c07c45cfd46291086d92b597b62f72468`, Worker
`4d1ce237-13b0-4db8-b1da-dfde97ec42c0`.

Three pieces were asked for. Two are delivered and verified here; the third (the full
build walkthrough with chapter markers) is not, and this record says so.

## Delivered

| Piece | File | Frame | Duration | Where |
| --- | --- | --- | --- | --- |
| Public showcase | `media-studio-showcase.mp4` | 1920 × 1080 | 82.0 s | [/media-studio](https://composer.loftwah.com/media-studio) |
| Vertical teaser | `media-studio-teaser.mp4` | 1080 × 1920 | 30.0 s | same page, linked under the showcase |

Both are served from the R2-backed film route (`/media-studio/watch/*`), which returns a
real `206`, `Accept-Ranges: bytes` and a `Content-Range`. The first attempt put the
12 MB file in `public/`, where a range request returned the whole body; the release moved
the films to owned storage. Captions ship as burned-in lower thirds plus WebVTT, SRT and a
plain-text transcript for each piece.

Editable source, pinned dependencies, render commands and the provenance manifest live in
`/Users/deanlofts/gits/media-studio-showcase-video` (Remotion 4.0.506, `@remotion/media`,
`@remotion/fonts`; `npm run render:showcase`, `npm run render:teaser`).

## What the footage actually is

- `ready` and `init` are screen recordings of the live Composer pages on 15 November 2026,
  including the real "Use this starting point" click and the real saved Media Studio draft.
- The studio beat is a recording of the live project library opened from App Composer,
  showing the six generated takes, the source song and the imported references.
- The storyboard card is a live capture of the saved composition
  `cmp_song_plan_f767c7cfc49143f8b54aadf02b376595_3` (`6 shots · 33.0s · mixed bed`).
- The specification and handoff panels are typeset from the exact text of the live draft;
  the surrounding product motion is the recording. They are labelled as excerpts.
- The closing result is the published, signed-out work page
  [/p/EVaGOC_peleSRSHQ](https://media.loftwah.com/p/EVaGOC_peleSRSHQ) with its real credit.
- The music bed is the audio of the studio's own published walkthrough film, normalised to
  −16 LUFS. It is not the After Hours song.

The private After Hours film contributes no audio and no frames to either public piece.

## Checks run

- `ffprobe`: 1920 × 1080 30 fps H.264 + AAC 48 kHz stereo, 82.000 s; 1080 × 1920, 30.000 s.
- EBU R128: −16.0 LUFS (showcase), −16.4 LUFS (teaser).
- Live player: duration 82, `videoWidth` 1920, seek to 40 s reached `readyState` 4 with no
  media error, caption track in `showing` mode.
- Range request on the live film: `206`, `Content-Range: bytes 0-1023/12059165`.
- Legibility: frames inspected at 1728 px and at 390 px for the showcase and teaser.
- `pnpm deploy` ran the full 687-check suite, the build, the live source gate, the sharing
  and privacy gates and the anonymous administration boundary. Release elapsed 86.4 s.

## Limits

- The full build walkthrough with chapter markers, a working transcript and an independent
  beginner reproduction is **not** delivered. An 82-second showcase is not a lesson.
- The films were inspected at two widths, not across a browser or physical-device matrix.
- No by-ear listening review was performed on the private film mix; the public pieces were
  level-checked instrumentally only.
- The film route responds `Cache-Control: no-store` in production for both the new films and
  the two existing guides, so a repeat play refetches rather than reusing an immutable
  cache. Pre-existing behaviour, recorded here rather than changed in this release.
- The Studio in-browser renderer re-emitted the pre-replacement take after the storyboard
  moved to revision 4. The film master was therefore assembled deterministically from the
  same saved takes and mixed bed; see the Studio receipt.

## Source map

| Element | Source |
| --- | --- |
| Display type | Space Grotesk (OFL-1.1) via `@fontsource/space-grotesk` 5.2.6 |
| Mark | `public/brand/composer-icon-20261022b.svg`, unmodified |
| Palette | Composer DESIGN.md: paper `#faf9f7`, ink `#17181b`, ember `#fc5b05` |
| Product footage | Live Composer and Studio recordings, 15 November 2026 |
| Published result | `media.loftwah.com/p/EVaGOC_peleSRSHQ`, credit shown on screen |
| Music | Studio walkthrough bed, normalised, already published |
