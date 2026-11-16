# Benchmarks inventory

Three dated data files behind the model feedback loop in
[#601](https://github.com/loftwah/app-composer/issues/601). The page is
`/benchmarks/inventory`; the validator is `node scripts/model-inventory.mjs`.

| File | The question it answers | Owner of the truth |
| --- | --- | --- |
| `build-agents.json` | Which coding agents can a Composer user hand work to, at what published version, with which model ids the agent's own catalogue still lists? | The agent vendor's release feed, model catalogue and public docs; the local installation where one exists |
| `hosted-execution.json` | What can the deployed Composer Worker actually run, and which bindings does it really have? | The deployed Worker's own settings and deployment response, plus the deployed source |
| `studio-media.json` | What can the independent Media Studio generate today? | `loftwah/composer-media-studio`'s own `src/lib/providers.mjs` and its live `/capabilities.json`, then each provider's published route |
| `pending.json` | What could not be answered without spend or a product decision? | The owner |

## Job receipts belong to one inventory

`benchmarks/comparisons/studio-job-receipts.json` records what the Media Studio
production job table actually did: saved/failed/unknown counts, saved-job
latency and the recorded cost estimate per model and kind. Its `inventory` field
must be `studio-media`; the validator refuses evidence labelled with another
inventory, or a model mapped to a non-media row. Build-agent availability and
Worker bindings stay in their own files and are never folded into a saved rate.
Read `benchmarks/comparisons/README.md` for the query, privacy and refresh rules.

## The rules the validator enforces

- Every row needs a `checkedAt`, the exact source that was read, and what that
  source actually returned. No source, no row.
- An `unverified` row must say why, in words, and can never also be `live`.
- A media row must carry the callable endpoint, never a display name.
- A `changes` entry must name a real row and must have different `previous` and
  `current` values. A change log that says nothing changed is refused.
- An inventory must state its own limits, and cannot be dated in the future or
  have a row checked after the file claims.
- A pinned run pointing at a `file:` that does not exist fails the check.

Run it with `pnpm inventory:check` (or `node scripts/model-inventory.mjs
--json`). It is deliberately **not** part of `pnpm build`: a data file going
stale is a fact to display, not a reason to block a release. The page labels an
inventory stale once it passes its own `staleAfterDays`.

## Refreshing one

There is no `--write`. A refresh is a reviewed edit, because a validator that
rewrites the evidence it just checked can always agree with itself.

1. Read the sources named in the file. The Studio plane reads
   `https://media.loftwah.com/capabilities.json` and
   `https://developers.cloudflare.com/workers-ai/models/<slug>/index.md` and
   `https://fal.ai/api/models?keywords=<endpoint>`. The hosted plane reads the
   Worker's own settings and deployments through the Cloudflare API.
2. Copy the previous value into `changes` before overwriting it.
3. Update `checkedAt` on the rows you actually re-read, not on the whole file.
4. Run `pnpm inventory:check` and `node --test tests/model-inventory.test.mjs`.

## What this is not

- Not a benchmark result. A `current` row says a catalogue still lists an id; it
  does not say a trial with it would pass, cost what the estimate says, or look
  good.
- Not permission. Nothing here grants access, authorises spend or executes
  anything.
- Not a claim about a provider account. Where account-level eligibility could not
  be read, the row says `unverified` and names the failing request.
