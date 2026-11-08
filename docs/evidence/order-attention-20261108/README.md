# Saved order exceptions in Needs attention — 8 November 2026

Scoped [#118](https://github.com/loftwah/app-composer/issues/118) commerce
source. Production is Composer `09c441c68b3d4a987a7f906187ad503326fe6594`,
Worker `7d0cc1fa-edd7-4526-8f4f-bbd3c981eb0c`; `/build.json` matches the source.

## Delivered

- A new administrator-only **Orders** source in the existing **Needs attention**
  view. It reads at most the newest 50 saved orders for the exact workspace,
  account and environment.
- One shared predicate (`orderNeedsAttention`) is used by both the Orders screen
  filter and the overview, so the two surfaces cannot disagree. It covers an
  uncertain checkout, an unknown or failed retained operation, unknown or
  failed fulfilment, and failed, expired or cancelled payment. A routine
  pending or unpaid checkout is waiting, not an exception.
- A deep link to the exact saved order:
  `orders?workspace=…&order=<uuid>#order-<uuid>`. The Orders page now selects
  `?order=` on load, validates it against the loaded records, and marks the
  detail section with that anchor.
- Non-administrators receive a `restricted` source, never an empty clean list.
  A stored order whose identity or scope disagrees with its row makes the source
  `unavailable`; it is never shown as zero.
- The overview contract now requires seven sources and accepts only the exact
  order deep-link shape.

## Live production state

Read-only `wrangler d1 execute` against `app-composer-emdash`:

| Query | Result |
| --- | --- |
| Orders grouped by environment and payment | 1 order: `production`, `refunded` |
| Retained actions grouped by kind and state | 1 `create-checkout/succeeded`, 1 `prepare-fulfilment/succeeded` |

That order is not an exception under the shared predicate, so the source
correctly has 0 items. This is a checked empty state from real stored records,
not an invented zero. No exception order exists in production to display; the
non-zero branch is covered by the SQLite integration test and the predicate
tests, not by a live item.

The authenticated admin render is unchanged in this environment: both
`/_emdash/admin/plugins/composer-stacks/overview` and the order deep link return
`302` without an Access session, and `overviewRead` returns `302`. Public `/`,
`/catalogue` and `/manage` return `200` and contain no order record, order API
or attention string; there is no public `/orders` route (`404`). Reading order
data requires the existing Access-protected admin boundary.

## Checks

```sh
pnpm check:fast -- tests/order-attention.test.mjs tests/plugin-trust-attention.test.mjs tests/overview-release-attention.test.mjs
```

Types and generated source passed (21.3s), semantic lint passed (3.0s), format
passed (0.9s), and 19 focused tests passed with 0 failures. Eight of those are
new: routine waiting is not an exception; uncertain checkout, failed operation,
failed/expired/cancelled payment and fulfilment precedence; the deep link stays
inside the contract; a short source list and foreign link are refused; the real
SQLite read returns only in-scope exceptions and excludes another account; an
inconsistent retained identity rejects as unreadable.

The guarded `pnpm deploy` then ran the full check, production build, migrations,
upload and every live gate, and verified the exact live source.

## Still open on #118

- **Connection expiry:** the connection contract still records
  `expiresAt: null`; no real expiring connection source exists.
- **Backup/recovery:** no persisted restore-proof record exists to read.
- **Public overview proof:** there is no public overview surface; the admin
  render and a live exception-to-recovery journey remain owner-session steps.
- The authenticated **Needs attention** visual pass, a real failed order, and
  the connection/backup sources are not proven here.
