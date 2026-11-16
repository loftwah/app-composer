# Studio job receipts

One dated file behind `/benchmarks/comparisons`: what the independent Media
Studio's production job table recorded per model and kind. It belongs to the
`studio-media` inventory only. Build-agent availability and Worker bindings stay
in their own inventories and are never averaged into a saved rate.

| File | What it holds |
| --- | --- |
| `studio-job-receipts.json` | Totals, 17 model/kind groups and three settings examples, read from the Studio's production D1 `generations` table |

## What is measured

- Job counts and `saved` / `failed` / `unknown` / `cancelled` per model and kind.
- Saved-job latency: `completed_at - created_at` on rows that record both.
- The `cost_estimate_micro` written on every row, summed and medianed.

Failed and unknown rows are counted but not timed. The table records no
`completed_at` or `failed_at` on them, and `updated_at` is not a terminal
timestamp, so the honest answer is "unmeasured", not a guess.

Every cost is labelled **estimate recorded by Studio, not an invoice**. No row in
the 16 November window records `provider_charged_micro`.

## What is never read

The aggregate query selects named columns only: `model`, `kind`, `status`,
`created_at`, `completed_at`, `cancelled_at`, `cost_estimate_micro`,
`provider_charged_micro`. It does not select `request_json`, prompts, project
ids, asset ids, media keys, provider request ids or error details. The examples
query uses `json_extract` for `aspect`, `durationSeconds`, `aspectRatio`,
`outputWidth` and `outputHeight` only. The validator refuses a query containing
`SELECT *`, `prompt`, `asset_id`, `project_id`, `client_request_id`,
`provider_request_id`, `output_asset_id`, `retained_key` or `error_detail`.

## Check it

```sh
pnpm jobs:check
node scripts/studio-job-evidence.mjs --json
node scripts/studio-job-evidence.mjs --sql   # print the exact queries
```

The check is offline and read-only. It fails if the file is undated, has zero
jobs, is labelled with another inventory, maps a model to a non-media inventory
row without saying so, carries a private field, has a negative latency, or has
counts and totals that do not add up. The page calls the same validator at build
time, so an invalid file refuses to render rather than showing a stale
comparison.

## Refresh it

There is no `--write`. A refresh is a reviewed read:

1. Read `PRAGMA table_info(generations)` first and confirm the fields still
   exist.
2. Run the aggregate and examples queries printed by `--sql` against the
   production Studio D1 with read-only access.
3. Replace the aggregates, set `checkedAt`, `source.readAt` and the window.
4. Run `pnpm jobs:check` and `node --test tests/studio-job-evidence.test.mjs`.

If the Studio adds a model that the `studio-media` inventory does not list, keep
the production key, set `inventoryEntry` to `null` and say so in
`inventoryNote`. Do not invent an endpoint or an inventory row to make the
tables agree.

## What this is not

- Not a quality ranking. A saved job means an output was stored, not that it was
  good.
- Not a human preference for these routes. The aggregate table never becomes one.
  A separate matched-still pair lives in `benchmarks/media/`; if it has a
  recorded vote, `/benchmarks/comparisons` says so and links to it. That vote is
  one unauthenticated label's preference between two saved clips, not a ranking
  of the routes in this table.
- Not an invoice, a provider-wide benchmark or a failure-latency measurement.
- Not a usage report. The table records no token or credit usage for these media
  jobs, so none is claimed.
- Not permission. Reading aggregates grants nothing and executes nothing.
