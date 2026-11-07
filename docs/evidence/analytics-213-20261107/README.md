# Analytics showcase and owner reporting — 7 November 2026

Scoped [#213](https://github.com/loftwah/app-composer/issues/213) live acceptance.
The public analytics destination, a shareable report and the private owner
outcomes workspace were exercised on production in the real Access-protected
owner session.

Production: Composer `bbe9e2246a853b37904ae22a55350f3d2ad3cf43` / Worker
`4c2683dd-9916-4864-aa2d-09e3c35cd164`.

## Public analytics

`https://composer.loftwah.com/activity` returned `200` with recorded findings for
1–7 November UTC:

- 507 recorded app home opens across all connected versions; 50 recorded app
  actions, described as contribution opens and finished inspections.
- 143 recorded Linkarooie home opens and 17 finished Link Check inspections.
- 0 postcards accepted during the period; the page distinguishes the period from
  the current review queue.
- The scope selector changes the findings, chart, app comparison and share links;
  the page explicitly says counts are recorded requests, not people, sessions or
  conversions. Unavailable history is a gap, not a zero.
- Each finding has **Inspect the evidence**, **Share this story** and a direct
  link to the real app.

## Shared report

`https://composer.loftwah.com/reports/r971f5140bbe0c84c8147a64b` returned `200`
with the story “2 recorded app-instance Open actions”. It serves:

- `landscape.png` — 1200 × 630
- `square.png` — 1080 × 1080
- `portrait.png` — 1080 × 1920

The page metadata and OG/Twitter image use the landscape card with an
accessible alt description. The report page and the images are public; the
owner's private outcomes remain separate.

## Private owner outcomes

`/_emdash/admin/plugins/composer-stacks/outcomes` returned `200` inside the real
owner session:

- The workspace is marked **private to this workspace**; the scope is all
  workspace stacks/instances, 1–7 Nov UTC.
- **1 Nov–7 Nov UTC** and **Export displayed scope** are visible before the
  detail.
- Unsupported action/usage observations are shown as **Unavailable**, not zero,
  and the page states that no retained observation exists in this scope.
- The page preserves the public/private and standalone/composed meanings.

## Checks

- Public activity, public report page and owner outcomes page all returned `200`.
- The report's landscape, square and portrait files are valid PNGs at the
  declared dimensions.
- 1440 × 1000 captures are committed; earlier phone/desktop and both-theme
  evidence for the same surfaces remains in the repo.
- No private owner state is exposed by the public activity or report pages.

## Residual scope

The controlled measured creator workflow remains local as recorded in #11; this
does not change the live reporting paths. Physical-device/screen-reader
acceptance remains a general accessibility gate.

## Evidence files

- `activity-1440.jpg`, `report-1440.jpg`, `owner-outcomes-1440.jpg`
- `report-landscape.png`, `report-square.png`, `report-portrait.png`
