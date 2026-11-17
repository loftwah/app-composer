# Woodhouse portfolio inventory — 16 November 2026

**Snapshot reviewed 12 November 2026. Reconciled and independently requested 16 November 2026.**

This is the dated, public-safe inventory of every project record in the Woodhouse CMS snapshot, plus the independent apps behind the shipped blueprints. It records what a public request actually returned. It does not claim that a catalogue entry, a repository or a blueprint pin is a working deployment.

Machine-readable data: `docs/portfolio/woodhouse-inventory-20261116.json`. Check it with `node scripts/portfolio-inventory.mjs --check`; re-read the live sources with `--verify`.

## Method

| Source | Request | Result |
| --- | --- | --- |
| CMS project projection | `GET https://woodhouse.loftwah.com/agents/facts.json` | 200; 61,942 bytes; SHA-256 `3def2d2eca4a696428638277072234da044156be0abc36fc0af743b9ab8344de`; `operator-reviewed public snapshot`, reviewed 2026-11-12 |
| Agent index cross-check | `GET https://woodhouse.loftwah.com/llms.txt` | 200; 18,426 bytes; SHA-256 `4915cccfae7d3c7fe26c1ede977580df22e0e83f597a9d3742db6b4d5db1967d`; lists the same 12 records |
| Live entry points | `GET` each URL, redirects followed, User-Agent `AppComposer-Inventory/1.0 (+https://composer.loftwah.com)` | Status, final URL and document title recorded below |
| Dated status records | `GET` each status page | All 12 returned 200; title recorded below |
| Deployed identity | `GET /build.json`, `/healthz`, or the page's own build meta | Only app-published revisions, never inferred from a repository head |
| Public repository heads | `git ls-remote https://github.com/loftwah/<repo>.git HEAD` | Recorded below. Private repositories are marked private and no head is stored |

The CMS source is the public `agents/facts.json` projection: an operator-reviewed snapshot of the same project records, not a raw EmDash database export. The snapshot reports **12 projects** (9 active, 3 paused or retired). The public `llms.txt` index lists the same twelve dossiers and the same lifecycle counts.

**Boundaries.** No credential, cookie, private issue or pull-request body, private repository name or private commit history is recorded. A blueprint pin is a declared brief revision, not a claim about current production. An unknown stays unknown with the observation that made it unknown; no older value was copied forward.

## Projects

| Project | What it is | Lifecycle · state (reviewed) | Live entry point | Deployed source | Repository |
| --- | --- | --- | --- | --- | --- |
| Bubbles | Bubbles is an arcade bubble shooter you play in the browser or on your phone: line up a shot, match three or more and clear the board. | active · Replay-checked competition, rebuilt presentation. (reviewed 2026-10-19) | [bubbles.loftwah.com](https://bubbles.loftwah.com/) · 200 · “Bubbles” | unknown — marker only, no revision | private (not published) |
| Fighter | Fighter is a collectible squad battler you play in the browser: collect characters, build a squad, then commit moves on a shared real-time Charge Strip. | active · Fight activity and optional browser returns are live (reviewed 2026-10-16) | [fighter.loftwah.com](https://fighter.loftwah.com/) · 200 · “LOFTWAH FIGHTER · Pick Your Fight” | `81f5350e1796046046e22c450ac9f6d23bf84a5c` | private (not published) |
| SHOALSHOT | SHOALSHOT is a fishing game for phones and desktop: read the water, place your shot and land the catch. | active · Card artwork in, save repair shipped, release acceptance open. (reviewed 2026-10-19) | [shoalshot.loftwah.com](https://shoalshot.loftwah.com/) · 200 · “SHOALSHOT — Read the tide. Place the shot.” | unknown — no revision exposed | private (not published) |
| Protocol 11 | Protocol 11 is a card game for two to four players around one table, played solo or with friends. | active · The refusal answers; three films delivered. (reviewed 2026-10-19) | [protocol11.loftwah.com](https://protocol11.loftwah.com/) · 200 · “Protocol 11 — a card night for two to four seats” | unknown — health has no revision | private (not published) |
| MAX | MAX is assistive technology for a wheeled walker: a companion app, a small computer on the walker and a gateway designed to find it, hear it and stop it. | active · Software prototype · physical proof open (reviewed 2026-10-07) | [max.loftwah.com](https://max.loftwah.com/) · 200 · “MAX — Your walker, made smarter.” | unknown — health has no revision | private (not published) |
| Pirates | Pirates is a reconstruction of Master of the Secret Sea, built from the original game’s own source evidence rather than from memory. | paused · Paused (reviewed 2026-11-07) | none — request returned 522 | unknown — no public build (522) | private (not published) |
| LoftwahFM | LoftwahFM is a music catalogue, radio stations, original shows and a browser player that games can reuse. | active · A radio player with recognisable listening companions (reviewed 2026-10-25) | [fm.loftwah.com](https://fm.loftwah.com/) · 200 · “LoftwahFM \| Independent music and radio” | unknown — no revision exposed | private (not published) |
| Plans With You | Plans With You proposes a plausible calendar commitment, confirmation and deliberate cancellation so you can keep a block of time your own. | retired · Retired (reviewed 2026-11-07) | [club.loftwah.com](https://club.loftwah.com/) · 200 · “Plans With You” | unknown — no revision exposed | [club](https://github.com/loftwah/club) @ [25bd763a42](https://github.com/loftwah/club/commit/25bd763a42a591ac5d070874c34034a74bb7628e) · archived |
| Asset Hunter | Asset Hunter is a searchable catalogue of creative and technical assets that records where each one came from and what rights apply. | retired · Retired (reviewed 2026-11-07) | [assets.loftwah.com](https://assets.loftwah.com/) · 200 · “Asset Hunter — A field guide to what can be made” | `0269c6799b6f1ac8cb9a4e14345dadbd6367976d` | private (not published) |
| App Composer | App Composer helps you build and maintain a web app with a coding agent. | active · Creator Hub reference is live (reviewed 2026-11-12) | [composer.loftwah.com](https://composer.loftwah.com/) · 200 · “App Composer — build apps with your agent on Cloudflare” | `8d5d0c50390cdd64df48b3040758f6398087fb0e` — **older than main** | [app-composer](https://github.com/loftwah/app-composer) @ [f703ad3315](https://github.com/loftwah/app-composer/commit/f703ad33151bb5a5274697ff5e639fb4389e9331) |
| Foilbury | Foilbury is a free collectible-card album for original characters: browse the public cabinet, open a capsule and keep the copy, its finish and its serial. | active · Public card cabinet (reviewed 2026-11-08) | [foilbury.loftwah.com](https://foilbury.loftwah.com/) · 200 · “Foilbury — characters worth keeping” | unknown — no revision exposed | [card-collector-bot](https://github.com/loftwah/card-collector-bot) @ [37f3516800](https://github.com/loftwah/card-collector-bot/commit/37f3516800b66e809ae13e9fc998e15c9a80bc56) |
| Liferaft | Liferaft is a local desktop app for searching MBOX email archives, previewing messages and recovering attachments or selected messages. | active · Desktop release available (reviewed 2026-11-06) | [liferaft.loftwah.com](https://liferaft.loftwah.com/) · 200 · “Liferaft · Recover messages and attachments from MBOX archives” | unknown — no revision exposed | [liferaft](https://github.com/loftwah/liferaft) @ [e6a1b38ee0](https://github.com/loftwah/liferaft/commit/e6a1b38ee0ac7f2824292ec96e74775904cd3e42) |

### Woodhouse itself

| Surface | Live entry point | Deployed source | Repository | What it is |
| --- | --- | --- | --- | --- |
| Woodhouse | [woodhouse.loftwah.com/](https://woodhouse.loftwah.com/) · 200 · “WOODHOUSE — The Loftwah Software Factory” | unknown — no public build revision; account metadata is not public | [woodhouse-new](https://github.com/loftwah/woodhouse-new) @ [1552f53911](https://github.com/loftwah/woodhouse-new/commit/1552f53911e41f5856bec79129b1c99489771d3f) | The editorial front door: project dossiers, stories, analytics and the share desk. |

### State notes

- **Paused** means out of the current queue, not cancelled. **Retired** keeps the dossier, dated evidence and stable URL; retirement is a portfolio decision, not a claim that the product never worked.
- **Pirates** — paused (reviewed 2026-11-07). Paused indefinitely by owner decision; the dossier, evidence and repository remain available.
- **Plans With You** — retired (reviewed 2026-11-07). Retired 26 October 2026; the public site still explains the idea and accepts waitlist interest.
- **Asset Hunter** — retired (reviewed 2026-11-07). Retired 26 October 2026; the catalogue remains as a dated public record.

## Blueprint sources

The deployed revisions below were observed on 16 November 2026. The blueprint
pins come from the active declarations. The Media Studio pin was refreshed on
17 November after a fresh checkout and a live source check.

| App | Live entry point | Deployed revision | Blueprint pin | Pin declared in | Repository |
| --- | --- | --- | --- | --- | --- |
| Here / there | [guestbook.loftwah.com](https://guestbook.loftwah.com/) · 200 · “Loftwah's guestbook” | `a8191d3442ea95a4013d481a2a50148e1f94bde3` | `5075d7be53b43aca288d3707fd06851aca91e8c2` | composition.lock.json | [app-composer-guestbook](https://github.com/loftwah/app-composer-guestbook) @ [a8191d3442](https://github.com/loftwah/app-composer-guestbook/commit/a8191d3442ea95a4013d481a2a50148e1f94bde3) |
| Linkarooie | [showcase.loftwah.com](https://showcase.loftwah.com/) · 200 · “Loftwah” | `e6780997b96f8b9f2411abc66abbbdd590dd5940` | `f1dd27952ca8548f81fde5c5905346dae4a2b61b` | composition.lock.json | [app-composer-showcase](https://github.com/loftwah/app-composer-showcase) @ [8615346131](https://github.com/loftwah/app-composer-showcase/commit/86153461315d851744498b78efb9de0691e981f0) |
| Media Studio | [media.loftwah.com](https://media.loftwah.com/) · 200 · “Media Studio — work worth keeping” | `f2f29696d8be2424cee5f64b89bdcb0bb43de037` | `089e998f20abd3fe9993c84dcf01267327673c14` | config/media-studio-standalone.json | [composer-media-studio](https://github.com/loftwah/composer-media-studio) @ [421f41c7b1](https://github.com/loftwah/composer-media-studio/commit/421f41c7b17907462b5545178d18162aa98ea708) |

| Blueprint | State | Pinned apps | Recipe | Replay |
| --- | --- | --- | --- | --- |
| Creator Hub | Reference | Guestbook + Linkarooie | [creator-hub](blueprints.md#creator-hub) | Not replayed by an independent owner |
| Media Studio | Reference | Media Studio | [media-studio](blueprints.md#media-studio) | Not replayed by an independent owner |

A pin is a reproducible brief revision. Production moving ahead of it is not a
blueprint failure; claiming the pin was deployed would be. Both recipes carry
the exact commands and label the unverified parts.

## Verification receipts

### Live entry points

Every row in the project table was a real `GET` on 16 November 2026. Titles are the document titles that came back, not labels copied from a dossier. `pirates.loftwah.com` returned a Cloudflare **522** error page and is not counted as a live entry point; the dossier's action is the record, not a play button.

The retired sites (`club.loftwah.com`, `assets.loftwah.com`) still answer 200 and present their public pages. That is an available public record, not a reversal of the retirement.

### Dated status records

All twelve dossiers link a status record. Each was requested directly; every one returned 200.

| Project | Status record | Status | Observed title |
| --- | --- | --- | --- |
| Bubbles | [/statuses/bubbles-2026-10-19/](https://woodhouse.loftwah.com/statuses/bubbles-2026-10-19/) | 200 | “Bubbles · Replay-checked competition, rebuilt presentation. · 19 October 2026 — WOODHOUSE” |
| Fighter | [/statuses/fighter-2026-10-16/](https://woodhouse.loftwah.com/statuses/fighter-2026-10-16/) | 200 | “Fighter · Fight activity and optional browser returns are live · 16 October 2026 — WOODHOUSE” |
| SHOALSHOT | [/statuses/shoalshot-2026-10-19/](https://woodhouse.loftwah.com/statuses/shoalshot-2026-10-19/) | 200 | “SHOALSHOT · Card artwork in, save repair shipped, release acceptance open. · 19 October 2026 — WOODHOUSE” |
| Protocol 11 | [/statuses/protocol-11-2026-10-19/](https://woodhouse.loftwah.com/statuses/protocol-11-2026-10-19/) | 200 | “Protocol 11 · The refusal answers; three films delivered. · 19 October 2026 — WOODHOUSE” |
| MAX | [/statuses/max-2026-10-07/](https://woodhouse.loftwah.com/statuses/max-2026-10-07/) | 200 | “MAX · Software prototype · physical proof open · 7 October 2026 — WOODHOUSE” |
| Pirates | [/statuses/pirates-2026-11-07/](https://woodhouse.loftwah.com/statuses/pirates-2026-11-07/) | 200 | “Pirates · Paused · 7 November 2026 — WOODHOUSE” |
| LoftwahFM | [/statuses/loftwahfm-2026-10-25-portfolio-recovery-v1/](https://woodhouse.loftwah.com/statuses/loftwahfm-2026-10-25-portfolio-recovery-v1/) | 200 | “LoftwahFM · A radio player with recognisable listening companions · 25 October 2026 — WOODHOUSE” |
| Plans With You | [/statuses/social-club-2026-11-07/](https://woodhouse.loftwah.com/statuses/social-club-2026-11-07/) | 200 | “Plans With You · Retired · 7 November 2026 — WOODHOUSE” |
| Asset Hunter | [/statuses/asset-hunter-2026-11-07/](https://woodhouse.loftwah.com/statuses/asset-hunter-2026-11-07/) | 200 | “Asset Hunter · Retired · 7 November 2026 — WOODHOUSE” |
| App Composer | [/statuses/app-composer-2026-11-12-creator-hub/](https://woodhouse.loftwah.com/statuses/app-composer-2026-11-12-creator-hub/) | 200 | “App Composer · Creator Hub reference is live · 12 November 2026 — WOODHOUSE” |
| Foilbury | [/statuses/foilbury-2026-11-08/](https://woodhouse.loftwah.com/statuses/foilbury-2026-11-08/) | 200 | “Foilbury · Public card cabinet · 8 November 2026 — WOODHOUSE” |
| Liferaft | [/statuses/liferaft-2026-11-06/](https://woodhouse.loftwah.com/statuses/liferaft-2026-11-06/) | 200 | “Liferaft · Desktop release available · 6 November 2026 — WOODHOUSE” |

### Deployed source identities

| App | Endpoint | Observed revision | Observed |
| --- | --- | --- | --- |
| Here / there | [guestbook build](https://guestbook.loftwah.com/build.json) | `a8191d3442ea95a4013d481a2a50148e1f94bde3` | 2026-11-16T02:31:55.042Z |
| Linkarooie | [showcase build](https://showcase.loftwah.com/build.json) | `e6780997b96f8b9f2411abc66abbbdd590dd5940` | 2026-11-16T02:31:55.264Z |
| Media Studio | [media-studio build](https://media.loftwah.com/build.json) | `f2f29696d8be2424cee5f64b89bdcb0bb43de037` | 2026-11-16T02:31:55.791Z |
| App Composer | [/build.json](https://composer.loftwah.com/build.json) | `8d5d0c50390cdd64df48b3040758f6398087fb0e` | 2026-11-16T02:31:33.790Z |
| Fighter | live page meta `loftwah-fighter-build` | `81f5350e1796046046e22c450ac9f6d23bf84a5c` | 2026-11-16T02:31:32.104Z |
| Asset Hunter | live page meta `asset-hunter:commit` | `0269c6799b6f1ac8cb9a4e14345dadbd6367976d` | 2026-11-16T02:31:32.770Z |

**App Composer is running an older commit than its repository main.** `/build.json` and `/healthz` both reported `8d5d0c5` while `main` was `f703ad3` at the same check. This inventory records the observed production identity; it does not infer a release or a rollback.

### Public repository heads

Only public repositories are listed. A private repository is not named or resolved here.

| Owner repository | URL | HEAD at check | Licence |
| --- | --- | --- | --- |
| Plans With You | [loftwah/club](https://github.com/loftwah/club) | `25bd763a42a591ac5d070874c34034a74bb7628e` | no licence file detected · archived |
| App Composer | [loftwah/app-composer](https://github.com/loftwah/app-composer) | `f703ad33151bb5a5274697ff5e639fb4389e9331` | MIT |
| Foilbury | [loftwah/card-collector-bot](https://github.com/loftwah/card-collector-bot) | `37f3516800b66e809ae13e9fc998e15c9a80bc56` | MIT |
| Liferaft | [loftwah/liferaft](https://github.com/loftwah/liferaft) | `e6a1b38ee0ac7f2824292ec96e74775904cd3e42` | MIT |
| Here / there | [loftwah/app-composer-guestbook](https://github.com/loftwah/app-composer-guestbook) | `a8191d3442ea95a4013d481a2a50148e1f94bde3` | MIT |
| Linkarooie | [loftwah/app-composer-showcase](https://github.com/loftwah/app-composer-showcase) | `86153461315d851744498b78efb9de0691e981f0` | MIT |
| Media Studio | [loftwah/composer-media-studio](https://github.com/loftwah/composer-media-studio) | `421f41c7b17907462b5545178d18162aa98ea708` | MIT stated in README; no licence file |
| Woodhouse | [loftwah/woodhouse-new](https://github.com/loftwah/woodhouse-new) | `1552f53911e41f5856bec79129b1c99489771d3f` | MIT |

## Unknowns and why

- **Private repositories.** 8 of the 12 project records publish no repository. Their names, heads and commit history are deliberately absent; the public dossier and status record are the source.
- **No published build revision.** Bubbles ships only a static build marker; SHOALSHOT, Protocol 11, MAX, LoftwahFM, Plans With You, Liferaft, Foilbury and Woodhouse publish no revision. Their live page returning 200 proves the page, not the commit behind it.
- **Pirates has no public build.** The attempted host returned 522. The project is paused and its dossier is the public surface.
- **Production and blueprint pins differ.** Guestbook, Linkarooie and Media Studio are each running a newer revision than the Creator Hub or Media Studio blueprint pin. A pin is a reproducible brief; production is a separate, moving deployment. Neither value is rewritten here.
- **Blueprint replay is unproven.** Both shipped blueprints remain **Reference** because no independent owner has replayed them. See [the runnable recipe](blueprints.md).

## What this inventory is not

It is not a claim that every project is rebuildable, that a blueprint has been independently deployed, or that a catalogue listing equals a working app. It is the dated starting point for [#600](https://github.com/loftwah/app-composer/issues/600): every CMS project has an explicit state, a verified public entry point where one exists, and an honest unknown where one does not.
