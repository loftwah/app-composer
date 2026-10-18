# Public activity and process diagrams

The public `/activity` page presents the existing counters. It does not add private creator analytics, visitor identification or conversion measures.

`lib/usage/portfolio.mjs` owns daily UTC signals and coverage. `lib/usage/index.mjs` owns the separate 7/30-day app and surface totals. The page calls those same existing summary functions; the public API, collection rules, query definitions, retention and security are unchanged. The daily series includes all connected versions because that contract has no per-surface series. The separate app comparison applies the standalone/composed selector. Never silently apply that selector to the daily chart.

`src/lib/activity-view.ts` projects the returned daily series into the requested window. Missing days stay null, including days before the first retained postcard receipt. Retained days without events remain zero. Today, collection's first UTC day and the postcard signal's first partial day are identified separately. The view does not estimate missed events or earlier history. Optional recording, caps and unmarked demonstration/bot traffic prevent exact growth, visitor or adoption claims.

`ActivityHistory.astro` supplies the plotted geometry, definitions and complete HTML tables. `src/browser/activity.ts` only enhances metric selection and day inspection. Native GET forms and tables remain the no-script path. A failed summary renders unavailable rather than zero, and independent summary failures do not discard the other view. SVG geometry uses attributes and inherited tokens; there are no inline-style mutations or remote chart dependencies.

## Reproduce the diagrams

The existing local D2 0.9.0 toolchain renders the maintained sources:

```sh
node scripts/render-journeys.mjs composer composition activity
```

`public/diagrams/journey-sources.json` selects the dated source stems. `JourneyDiagram.astro` uses that same map and generated dimensions. Each diagram has a separate phone layout and both product themes, plus a native text equivalent. Old source/SVG URLs remain intact. New published pixels need a new versioned stem; do not overwrite a previously published dated asset.

The three transit drawings bundle the existing licensed local Space Grotesk face. D2 requires a `.ttf` suffix, so the renderer copies the exact `.bin` bytes into an owned temporary directory and removes it in `finally`. D2 subsets that face into embedded WOFF; no font/image server is fetched. Existing legacy drawings retain their original font/padding rules. The source relationships come from the current supported workflow, app provider and public counter contracts. They do not prove fresh-user onboarding, all-book provider compatibility or data/media restoration.

## Check this slice

```sh
node --test tests/activity-view.test.mjs tests/portfolio-analytics.test.mjs tests/usage.test.mjs
pnpm check
CLOUDFLARE_ENV=preview pnpm build
```

Use isolated fictional daily rows for visual verification, explicitly identify their fixture provenance, and test missing, zero, partial and query-failure states. Check keyboard metric/day selection, native period/surface submission, the no-script path, decoded diagrams and fonts, strict CSP, phone/desktop and both themes. Source/build/local interaction do not establish production or physical-device acceptance.
