# Media Studio — scoped entry, edits, mix and brand self-use

Observed 2026/11/14, Australia/Melbourne (AEDT, UTC+11). These are public-safe
checks and screenshots from the deployed Composer and Media Studio. The durable
release index remains [#11](https://github.com/loftwah/app-composer/issues/11).

## Live identities

| Item | Value |
| --- | --- |
| Composer source | `7910308ea8f98655dbeb1f88a7536c6dc0db3419` |
| Composer Worker | `ad4bef19-e03c-4ee8-901f-b26617ad68cb` (first scoped deploy); final source verified at `7910308` |
| Studio source | `4511cfe1ba54d27f88458f23521629fb3f6c855b` |
| Studio Worker | `28839448-a713-4c3d-8898-9aba590005c3` |
| Article | https://composer.loftwah.com/media-studio |
| Tutorial | https://composer.loftwah.com/media-studio/tutorial |
| Entry | https://composer.loftwah.com/media-studio/studio |
| True 9:16 cut | https://media.loftwah.com/p/5KqkS8ZEC-mj_yjm |
| Brand 9:16 motion | https://media.loftwah.com/p/X9b5nsfqX03CVJMf |
| Brand share card | https://media.loftwah.com/p/B_HA5PV6YMmHDA7N |

## Access checks

| Case | Result |
| --- | --- |
| Guest, `/media-studio/studio` | 200 public page with Read / Build / Sign in; no private data |
| Guest, Studio `/api/state` | 401 `unauthorized` |
| Guest, invalid bridge token | 401 login page |
| Signed-in owner entry | Redirects to Studio with bridge session `actor=dean`, `workspace=dean`, actions `read/edit/generate/publish/admin` |
| Handoff replay within two minutes | 409; `bridge_handoffs` jti is single-use |
| Project-scoped session, wrong project GET/PATCH | 403 `forbidden` |
| Project-scoped session, selected project PATCH | 200; Composer grant re-check at dispatch succeeded |
| Ungranted non-owner | Code-tested: `studioAccess` returns no actions until a grant exists |
| Read-only / generate grants | Code-tested: only the granted action is exposed; removing generate makes the privileged check reject |
| Revoked grant after a session exists | Code-tested: `verifyComposerGrant` rejects when the current action is absent |
| Switched actor | Code-tested: actor/workspace mismatch rejects |
| Pre-scope standalone owner session | Still accepted as owner; no false denied state |

Live non-owner sessions were not created because there is no second admitted
Composer account in this environment. That is a gap in live coverage, not a
claim that the code path is untested.

## Creative and media checks

- Masked fill: `gen_281511ef440f4c8097053429ecb674d6` saved `asset_e40f63f418504942b35c838027c7595e` at 1024×1024, `parentAssetId=asset_fe6c37246f3d4b2a884598e1d9e0fa1d`, US$0.05.
- Cutout: `gen_d18b180a410e445bbce1896fb92794dd` saved a 1024×1024 PNG; US$0.002.
- Upscale: `gen_93d736ae9d274ba1a9992264a90882fc` saved a 2048×2048 PNG; US$0.02.
- Effect: `gen_457ce7e092eb462c80499ae8e97d2f43` saved a 5.04 s, 44.1 kHz stereo MP3; US$0.008.
- Browser mix: the “Paper & Light — three-track mix proof” storyboard mixed Studio Score + Studio Voice + Studio Effect to `asset_aec3b8759f6146c8be6fc33e75ac0887`, 16.792 s, 44.1 kHz stereo, 2,962,156 bytes, and saved the composition with `mixed bed · 3 source tracks`.
- The 9:16 cut `asset_387d3faf5d684729b2e52a12b94de8e8` is 720×1280, SAR 1:1, DAR 9:16, 17.791667 s video, AAC 44.1 kHz stereo, SHA-256 `58f2c4b4d206045d655a5b590c85fe835b9f0b73a9ce06155a67a44cbe5ef1e1`.
- Range: `GET /p/5KqkS8ZEC-mj_yjm/media` with `Range: bytes=0-1023` returns 206, `content-range: bytes 0-1023/2739864`.
- Withdrawal: after `DELETE /api/publications/pub_744bf698e23f4feeb91a6f751d20e1a7`, the page, media, download, poster and `/s/` alias all return 404.
- The public article’s 1200×630 share card and the 720×1280 motion are live at the URLs above.
- The article loaded at 320, 390, 768, 1280, 1440, 1728 and 2560 px with no horizontal overflow. The `.figure.narrow` column matched the prose column at 1280–2560; the before/after pair rendered 1280×720 and 1280×704 at their true ratios.
- Both themes resolved their real tokens (`#afb3bb`/`#464a52` in dark, `#5c616a`/`#b9bec5` in light); reduced motion removed the article animation.
- The Studio Create tab at 390 and 1440 px had no horizontal overflow, exposed the three edit buttons, and loaded a 819×1024 mask canvas from a 1080×1350 source.

## Screenshots

- `studio-mask.png` — Masked fill selected, source still loaded, white-on-black mask canvas, reference picker.
- `studio-mixer-desktop.png` — the three-track mix proof with the mixed bed saved, trim/gain/fades and the 9:16 asset in the library.
- `studio-mixer-phone.png` — the same mixer at 390 px, no horizontal overflow.

## Costs

The Studio ledger recorded US$1.3017 in Paper & Light and US$0.363 in the brand
project, US$1.6647 total. A further US$0.50 qualified the 720p Wan slate outside
the Studio budget; rejected qualification attempts added about US$1.08. None of
these figures is invoice-confirmed. Fixed hosting and R2 storage remain separate.

## Open gates

- New fal `ffmpeg-api/compose` jobs return 403 at the result route, so the
  in-product assembly and 9:16 controls cannot produce a new master. The 9:16
  derivative was finished deterministically with local ffmpeg from the same
  saved takes, sound and slate.
- No by-ear listening review of the complete films or the mix.
- No fresh-instance build replay or complete build/use/software-change film in
  this run.
- No physical-device matrix.
- Per-project grant rows are not in People & access; the handoff and studio
  session enforce the selected project, and workspace/installation grants are
  separate.
