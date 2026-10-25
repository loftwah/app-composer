# Public analytics and frozen reports

Reviewed 25 October 2026. The public analytics destination is `/activity`, with one app record per supported app at `/activity/<app>`. It uses the existing bounded counters; it does not add visitor identification, a vendor or a private-record feed.

## One scope

`lib/usage/portfolio.mjs` now accepts an optional `surface` (`all`, `standalone`, `composed`) and applies it to the daily series, app totals and Guestbook receipt coverage. `lib/usage/index.mjs` remains the separate app/surface summary used by the comparison. The page passes the same window and surface to both.

The `period`, `surface`, `apps` and `metrics` values are returned together. `apps[].signals` carries the app-owned daily event series (`app_open`, `item_open`, `inspection_completed`), while `apps[].postcards` carries the receipt measure with its own first-observed coverage. A selected surface cannot be silently dropped from one view.

The signal picker changes only the chart. The scope form changes the summary, findings, chart, comparison and report links. The chart and comparison state their route scope explicitly.

## Supported routes and measures

Composed counts can only be recorded by the apps Composer mounts inside its own site: Here / there and Linkarooie. `lib/usage/index.mjs` exports `composedApps` and `connectedOn`, and the Worker builds its mounted-route match from that same list so the public claim cannot drift from the recording route.

An app with no composed route is named as unavailable in the app comparison rather than shown as a measured zero, and its app record explains the limitation and links to the standalone scope. `/reports/new` and `POST /api/reports` refuse a composed story for such an app instead of freezing a false zero. Both public summaries carry an additive `connected` boolean per app, so a JSON consumer can make the same distinction.

An app record offers only the measures that app declares. A URL naming an unsupported measure says so at the chart instead of silently substituting a different series. Findings carry their measure, period and route into the evidence link, so a postcard finding opens the postcard series rather than defaulting to app opens.

## Findings

`src/lib/activity-view.ts` builds a small number of findings from the supported measures:

- most opened app in the selected scope;
- Guestbook postcards that reached review, with contribution-page opens kept as a separate context;
- completed Link Check inspections;
- standalone/composed distribution when the full scope is selected;
- the busiest recorded UTC day.

Findings never claim unique people, growth, causation or conversion. A small count is a real first observation, not a milestone invented by the interface. Missing history stays unavailable, a retained zero stays zero, and a capped total stays a lower bound.

## Frozen reports

`/reports/new` is a server-rendered preview. It requires a supported app, signal, 7/30-day UTC window and surface, reads the same public aggregate, and shows the exact story before storing anything.

`POST /api/reports` recomputes the public aggregate instead of trusting the form values, builds `composer.public-report/1`, and stores one allowlisted snapshot in `composer_reports` (`migrations/0010_public_reports.sql`). The snapshot id is a SHA-256 prefix of the evidence body, so the same scope and values share one stable address; a changed value or period creates a new one. The table has no workspace, visitor, enquiry or stack reference. It is not a private owner export.

`/reports/<id>` shows the frozen headline, value, unit, period, surface, daily values, coverage, limitations, source revision and creation time. It links into the current app record and Init, and offers the three images. The report is independent of the 35-day counter retention because its values are stored.

`/reports/<id>/landscape.png`, `square.png` and `portrait.png` are deterministic reflows of the same snapshot. They use the approved Composer mark and the relevant app's existing optical mark, with the canonical orange roles. The cards are generated locally by the existing Resvg WASM path; no external image or analytics service is contacted.

The preview and endpoint accept only public aggregate scopes. An owner-derived public report would need a separate explicit allowlist and publication step; the current public report is not built from private outcomes, enquiry text, workspace records or visitor identity.

## Check this slice

```sh
node --test tests/public-analytics.test.mjs tests/activity-view.test.mjs tests/portfolio-analytics.test.mjs tests/usage.test.mjs
pnpm check
pnpm build
```

Inspect the overview and one app record at 390px and 1440px in both themes. Check the native GET forms, keyboard focus, missing/zero/partial states, long labels, and a freshly created report. Open each downloaded PNG at its declared dimensions and inspect the report landing page's OG metadata. Source/build/local interaction does not establish production, external unfurl or physical-device acceptance.
