# Public sweep, link integrity and mini-app audits — 8 November 2026

Issues: [#7](https://github.com/loftwah/app-composer/issues/7),
[#321](https://github.com/loftwah/app-composer/issues/321). Read-only audits plus
one real CSP defect fixed on a public page.

## Production identity

- Composer source `fbb0760c736d6286462fdd8512db2d3d25a26678` (`fbb0760`).
- Worker version `64627453-eb84-421c-ae3c-e346ad7ff7b9`.
- Released through `pnpm deploy` from clean pushed `main`.
- Earlier in the same sweep: `a9741ef` / `67c1b8a4` fixed the broken Security
  role link.

## What changed

- **Launch Kit inline style.** The Night Signal detail image used
  `style="max-width:600px;width:100%;height:auto"`, which the CSP blocked and
  which printed an application console error on `/launch-kit` at both widths.
  The image now uses a scoped `.kit-detail-card` rule. The policy was not
  weakened: no `unsafe-inline` or new hash. The computed constraint is 600px and
  the page has no CSP error.
- **Security role link.** The role pack pointed at `/security`, which has no
  page. It now links to the maintained repository `SECURITY.md`.
- **Public copy.** `/plugin-trust` now says automatic watch is off by default
  and enabled only by the owner, rather than a fixed “off” that would become
  false after enablement.

## Full public sweep

All 70 sitemap pages were opened at 1440 × 1000 and 390 × 1000:

| Check | Result |
| --- | --- |
| HTTP status | 200 on every page |
| Document width | equals the viewport; zero horizontal overflow |
| `h1` | exactly one on every page |
| Heading order | no skipped levels on any page |
| Images | no image without an `alt` attribute |
| Console | zero application errors; only the known Cloudflare Insights beacon is blocked by CSP |

The earlier full sweep found exactly one application error (`/launch-kit`), now
fixed and rechecked.

## Link crawl

215 unique same-origin links were collected from the 70 pages and fetched. One
404 existed: `/security` from `/roles/security`. It is fixed. The other apparent
failure was an HTML-escaped `&amp;` in an analytics link; decoding it returned
200, so it was an audit artefact, not a page defect.

## Mini-app audits

`pnpm audit --audit-level low` ran against fresh copies of all nine first-party
repositories at their current pins: Paperwork, Launch Kit, LDraw, Link Check,
Guestbook, Linkarooie, Hello, Carry / forward and the starter. Every one
reported **no known vulnerabilities**. No package or lockfile changed in this
step.

## Remaining gates

- Physical devices, screen-reader speech, native share-sheet success and
  external social unfurls remain separate.
- This sweep checks structure and console state, not visual taste or every
  interaction. A new diagram or artwork still needs a human clarity/approval
  review.
- The public pages do not exercise the private admin; the Plugin Trust owner
  control remains the pending owner action from the watch batch.
