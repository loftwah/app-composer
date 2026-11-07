# Plugin Trust review items in the shared attention view — 8 November 2026

Batch 2 of the [continuation 25 plan](../../backlog-20261106.md#continuation-25--8-november-2026-three-batch-plan).
Issue: [#365](https://github.com/loftwah/app-composer/issues/365).

## Result

The persisted Plugin Trust review items, the owner watch enablement state and a
failed or partial watch run are now part of the existing owner **Needs
attention** view. They are administrator-only, they link to the exact Trust
Centre review row, and the public `/plugin-trust` page still renders none of
them.

| Fact | Value |
| --- | --- |
| Production source before the batch | `43ea8cf5468ab65faad8041b6b60c66ad1fddf71` / Worker `d9eab220-0f42-4922-9ca9-4ade773e185d` |
| Production source after the batch | `d16db028bc4969d966022c3e07c1d31082e2190c` / Worker `65243396-3d10-4fdf-bc54-1a47d8f05431` |
| Migration | none (reads `composer_plugin_trust_reviews` / `composer_plugin_trust_watch` from `0022`) |
| Live `/build.json` | `d16db028bc4969d966022c3e07c1d31082e2190c` |
| Production rows at verification | 0 reviews, 0 watch rows, 0 delivery runs — the watch is still off |

## What changed

- `src/lib/plugin-trust-attention.ts` reads the open persisted reviews and the
  watch record and returns one bounded attention item per review (maximum 25)
  plus one item when the watch is enabled and the last run is `failed` or
  `partial`. The source note states enablement, the last run state, that the
  advisory feed is missing (`ADVISORY_SOURCE_NONE`), and that review items are
  administrator-only, deduplicated and never public.
- Non-administrators receive a `restricted` source, never an empty clean list.
  An absent database is `unavailable`. A thrown read is `unavailable` at the
  overview level. None of these becomes zero.
- `src/lib/overview.ts` adds the `plugin-trust` source, refuses a non-administrator
  `recheck`, and never lets a plugin-trust item be attributed to a workspace app.
- `src/lib/overview-contract.ts` now accepts five sources and pins the only
  permitted Plugin Trust links to
  `/_emdash/admin/plugins/composer-stacks/plugin-trust#plugin-trust-(review-…|watch)`.
  A foreign origin, an extra query or an unknown fragment is refused.
- `reviewAnchor()` in `src/lib/plugin-trust-contract.ts` gives each review row a
  stable, lower-case URL-safe id; the Trust Centre renders it and scrolls/focuses
  the row when the page opens with that fragment. The watch block has
  `#plugin-trust-watch`.
- The public `/plugin-trust` page now states that review items and watch state
  appear only in the signed-in administrator's shared view.

## Checks

| Check | Result |
| --- | --- |
| `pnpm check:fast -- tests/plugin-trust-attention.test.mjs tests/plugin-trust-route.test.mjs tests/plugin-trust-watch-run.test.mjs` | types, lint, format and 24 focused tests passed |
| `tests/plugin-trust-attention.test.mjs` | 9 tests: restricted for non-admins, unavailable without a database, watch-off note, three items for two open reviews plus a failed watch, partial state surfaced, healthy state silent, stable anchors, contract accepts the new source and refuses foreign links, attention ranking |
| Public-page guard | the rendered public page contains no `Mark reviewed`, review anchor, table name or advisory code |
| `pnpm deploy` | dependency audit, full check, production build, upload `65243396`, and every live gate passed |
| Live `/build.json` | `d16db028bc4969d966022c3e07c1d31082e2190c` |
| Live public page | `/plugin-trust` 200, shows the administrator-only sentence, zero private strings |
| Live admin boundary | `/_emdash/admin/delivery`, `/_emdash/admin/plugins/composer-stacks/overview` and `overviewRead` all answer 302 to an unauthenticated request |
| Production D1 | both Plugin Trust tables exist; 0 open review rows because the watch is off |

## Remaining gates

- The shared view was not opened in an authenticated owner session (the
  automation browser has no Cloudflare Access session). The route, the
  administrator-only gate and the item contract are proven by tests and the
  live unauthenticated boundary; the visual owner-session pass remains an owner
  step. With the watch off there is nothing to display yet.
- Enabling the daily watch is still an explicit owner action. This batch did not
  enable it, run it, or write a review row into production.
- A licensed advisory feed/SBOM/source-health check is still absent; the shared
  view says so rather than implying clean.
- Native install/update/disable receipts, per-site inventory isolation,
  financial fields and the fork/rescue playbook remain open on #365.
