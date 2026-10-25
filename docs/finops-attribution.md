# Cost attribution with real evidence

Reviewed 25 October 2026 (Australia/Melbourne). This page records what Cloudflare
usage and cost evidence is actually readable for account
`1003dc1d93af0ebea56b2f1252f89627`, what the bounded attribution view does with
it, and which authority is still missing. It supports
[#312](https://github.com/loftwah/app-composer/issues/312) and leaves real usage
metering to [#220](https://github.com/loftwah/app-composer/issues/220) and
inventory to [#219](https://github.com/loftwah/app-composer/issues/219).

## What is implemented

- `src/lib/cost-attribution.ts` — a pure, deterministic contract
  (`composer.cost-attribution/1`). It takes an explicit mapping and one read-only
  provider observation and returns per-resource measures.
- `scripts/finops-attribution.mjs` — the adapter. `--plan` prints the fixed GET
  reads without network access. `--allow-live-read` performs **GET only** and
  prints a bounded observation; adding `--view` builds the attribution view.
- `tests/cost-attribution.test.mjs` — refuses ambiguous or unsafe input, keeps
  unknown measures `unverified`, and proves `/` is never rendered as zero.

Rules enforced by the contract:

1. A resource is attributed only when this repository records it. The mapping is
   derived from `wrangler.jsonc`, so it covers Composer's own Worker, D1 database
   and R2 bucket in `production` and `preview`.
2. An observed resource with no recorded mapping is listed as `unallocated`. It
   is never assigned to an app because its name looks similar.
3. A measure is `measured` only when the provider returned a value. Otherwise it
   is `unverified` with the missing authority named. `value` is `null`, never `0`.
4. A real provider zero (for example an empty R2 bucket) stays a measured `0`;
   that is different from an unknown.
5. The account id must match exactly, the capture time cannot be in the future,
   duplicate resources and duplicate claims are refused.

## Endpoint evidence — 2026/10/25 10:05 Australia/Melbourne (2026/10/24 23:05 UTC)

Read-only GET requests with the repository's existing account token. No write,
plan, subscription or notification request was made.

| GET path | Status | Observed |
| --- | --- | --- |
| `/user/tokens/verify` | 401 (code 1000) | An account-scoped token is not verifiable at the user endpoint. This does not invalidate it: the account reads below succeed. |
| `/accounts/{account}` | 200 | Account readable |
| `/accounts/{account}/workers/scripts` | 200 | 117 Worker scripts listed (inventory only; no request counts) |
| `/accounts/{account}/d1/database` | 200 | 19 databases; each row includes `file_size` |
| `/accounts/{account}/d1/database/{uuid}` | 200 | `file_size`, `num_tables`, region |
| `/accounts/{account}/r2/buckets` | 200 | Bucket inventory |
| `/accounts/{account}/r2/buckets/{bucket}/usage` | 200 | `payloadSize`, `metadataSize`, `objectCount`, window `end` |
| `/accounts/{account}/billing/profile` | 403 (code 10000) | Not authorised |
| `/accounts/{account}/billing/history` | 403 (code 10000) | Not authorised |
| `/accounts/{account}/subscriptions` | 403 (code 10000) | Not authorised |

GraphQL analytics was **not** requested. It requires a POST query and an account
analytics read scope; this work is limited to GET, and a GET-only adapter cannot
obtain request or CPU series.

### Measured in that observation

| Resource | Environment | Measure | Value |
| --- | --- | --- | --- |
| `app-composer` | production | Worker present | yes |
| `app-composer-preview` | preview | Worker present | yes |
| `app-composer-emdash` | production | D1 storage | 2,203,648 bytes |
| `app-composer-emdash-preview` | preview | D1 storage | 1,429,504 bytes |
| `app-composer-media` | production | R2 stored payload | 12,514 bytes (1 object) |
| `app-composer-media-preview` | preview | R2 stored payload | 0 bytes (0 objects, measured) |

Coverage from the same run: `workerExists` 2/2, `d1StorageBytes` 2/2,
`r2StorageBytes` 2/2, `requests` 0/6, `cpuMs` 0/2, `cost` 0/6. One hundred and
forty-six other account resources were listed as `unallocated`; none was
attributed to Composer.

These values are a dated point-in-time observation, not an invoice, a period
total or a saving. Fresh numbers require a new run; the checked-in test fixtures
use fictional values.

## Missing authority

| Measure | What is missing | What would be required |
| --- | --- | --- |
| Requests per Worker/D1/R2 | A request series. The REST inventory does not include counts. | A token with account analytics read, and a POST to `/client/v4/graphql`. That is outside the GET-only authority used here. |
| CPU time | Same analytics series (`workersInvocationsAdaptive` or equivalent). | Same analytics scope and POST. |
| Cost, invoice, allowance, currency | Any billing read. All three billing endpoints returned 403. | A billing-scoped token or a provider invoice/export. |
| Per-app attribution for the eight independent mini-apps | No recorded provider resource mapping in this repository. | An explicit, reviewed mapping (app, environment, Worker, D1, R2) from authenticated inventory, then exact-name matching. [#318](https://github.com/loftwah/app-composer/issues/318) owns that reconciliation. |
| Budget alerts and hard spend caps | Not implemented and not implied. | A separate, explicitly enabled owner decision. |

## How to re-run

```sh
# Offline: show the exact GET plan and the missing authority
node scripts/finops-attribution.mjs --plan

# Read-only observation (GET only; needs the existing account token)
node scripts/finops-attribution.mjs --allow-live-read > observation.json

# Attribution view keyed to the recorded wrangler mapping
node scripts/finops-attribution.mjs --allow-live-read --view
```

The collector refuses to run without `--allow-live-read`, never prints the
token, and writes nothing to Cloudflare. `output/` is ignored, so a saved
observation is local evidence only.

## Limits and non-claims

- This is not an EmDash **Costs & resources** screen. The product surface,
  labels, charts, exports and phone/desktop review remain #312 design work and
  depend on #220 measures.
- Storage bytes are not cost. No price, plan, allowance, invoice or allocation is
  guessed, and an unknown is never shown as zero.
- A Worker/D1/R2 name match is not proof of app ownership. Only the committed
  mapping is used; the independent apps stay unallocated until a reviewed
  mapping exists.
- The account holds unrelated projects. Their resources appear only as
  `unallocated` names and are never shown as Composer spend.
- No production data, plan, subscription, notification or budget was changed for
  this work.
