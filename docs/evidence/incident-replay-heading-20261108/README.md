# Incident replay heading order — 8 November 2026

Issue: [#7](https://github.com/loftwah/app-composer/issues/7). A live public-page
audit found the only real heading-order defect across the 70 sitemap pages.

## Production identity

- Composer source `1969da32308b8e4bbec39f5cbbe8bcecc97fe0d7` (`1969da3`).
- Worker version `b13e5a4e-a65e-4703-99ff-ac42483809b1`.
- Released through `pnpm deploy` from clean pushed `main`.

## What changed

`/incident-replay` rendered the SITREP's `<h3>` directly under the page `<h1>`,
skipping level 2. `IncidentSitrep` now takes an explicit `level` prop; the public
replay passes `level={2}` and its subsections render as `<h3>`. The native admin
proposal use keeps the default level 3.

## Verification

- Live heading order at 390 × 844: `H1 Review the investigation…` → `H2 Situation
  report` → four `H3` sections → the page's three `H2` sections.
- Document width 390, no horizontal overflow.
- `pnpm check:types`: 0 errors.
- `pnpm deploy`: full check, build and live gates passed.
- `tests/agent-proposals.test.mjs`: 21 passed.

## Remaining gates

This was a mechanical audit of 70 public pages (title, description, canonical,
Open Graph, Twitter card, one `h1`, heading order, duplicate IDs, empty links,
missing alt). It does not replace a full assistive-technology review; physical
screen-reader acceptance remains #35/#264. Decorative icons intentionally keep
`alt=""`.
