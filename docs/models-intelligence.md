# Upstream model intelligence: the models.dev adapter

Reviewed 8 November 2026. This is the first executable slice of
[#19](https://github.com/loftwah/app-composer/issues/19): a deterministic,
credential-free adapter for the public models.dev catalogue. It adds no
scheduler, GitHub Action, hosted CI, model call, credential or issue writer.

The source is data. A provider or model listed here is **not** a supported
Composer recipe, a tested credential, an account entitlement or a readiness
claim.

## What it does

One invocation performs at most one conditional read of
`https://models.dev/api.json`:

- sends `If-None-Match` and `If-Modified-Since` from the retained store;
- caps the response at **16 MiB** and the request at **20 seconds**, refuses
  redirects and retries a transient failure at most **twice** (three attempts);
- validates the whole payload before accepting it — a malformed, partial,
  oversized or missing-field response is refused as a candidate, never merged
  into the retained catalogue;
- keeps the last validated catalogue separately from the compact state record;
- classifies real changes, marks freshness honestly and keeps a deduplicated
  incident/action ledger.

A `304`, or a `200` whose SHA-256 content hash matches the retained one, is
**unchanged**. It advances `checked-at` only. It does not advance `changed-at`,
the recipe revision or a material-change date, and it writes no incident or
action.

## Command

```sh
# One live conditional check. State, catalogue and summary stay under the
# ignored output/ directory by default.
pnpm intelligence:models

# A controlled fixture drill with an explicit clock. Never used to describe a
# live upstream event.
node scripts/models-intelligence.mjs --reset \
  --fixture tests/fixtures/models-dev/catalogue-v1.json \
  --state output/models-dev-intelligence/drill/state.json \
  --snapshot output/models-dev-intelligence/drill/lkg.json \
  --publish output/models-dev-intelligence/drill/summary.json \
  --now 2026-11-08T02:00:00Z
```

Options: `--state`, `--snapshot`, `--publish`, `--fixture`, `--providers`,
`--attempts` (1–3), `--now`, `--reset`. Exit code `0` means the check ran, was
deliberately deferred by backoff, or recorded an outage. Exit code `1` means the
command's own input or retained state was unusable; the store is never
overwritten in that case.

## Persisted records

The state record (`composer.models-dev-state/1`) keeps these facts apart:

| Field | Meaning |
| --- | --- |
| `lastAttempt` | The latest attempt, including a deferred run, its outcome, status, bounds and detail. |
| `lastSuccess` | The latest validated `200` or `304`, with ETag, content hash, byte count and catalogue counts. |
| `lastChange` | The latest actual content change, with bounded added/removed/material/cosmetic samples. |
| `lastMaterialChange` | The latest change that affects price, limits, status, capability or a removal. |
| `upstream` | Retained ETag, Last-Modified, SHA-256 and size. A `304` keeps these unchanged. |
| `recipe` | The actual Get Ready recipe id and version this check is attributed to. A catalogue change never advances a recipe-tested date. |
| `outage` | Consecutive failures, failure signature and the next permitted attempt. |
| `incidents` | Deduplicated failure records, newest first. |
| `actions` | At most one `material-change` owner action per source/integration/recipe. |
| `modelCalls`, `issuesWritten` | Recorded as `0` rather than inferred. |

The validated catalogue (`composer.models-dev-snapshot/1`) is written beside the
state and read beside it. An unreadable or mismatched pair fails closed.

## Change classification

- **Provider added** and **model added**: informational. They update
  `lastChange`, never create an owner action.
- **Model removed**, **provider removed**, changed `cost`, `context`/`output`
  limit, `status`, `tool_call`, `reasoning`, `attachment` or `modalities`:
  material. This is a candidate to investigate; it is not permission to delete
  history or to keep recommending an unavailable model.
- **Name, release date or last-updated changed**: cosmetic.

A removal retains bounded samples in `lastMaterialChange` so the actual removed
identity is inspectable after the new catalogue is accepted.

## Incidents and actions

A failure fingerprint is
`source|integration|recipe-id@recipe-version|failure-signature`, for example
`models.dev|models-dev-api|codex-github-cloudflare-hello-v2@2|schema-invalid`.
Repeated failures of the same class update `lastSeen` and `occurrences` instead
of adding records. A successful validated read resolves open adapter incidents
with `resolution.requirement = "fetch-and-validate"`; a recovered fetch alone
never closes a product repair.

A material change proposes at most one action, keyed by
`source|integration|recipe|material-change` and attributed to issue #19. The
adapter never writes that issue: `issuesWritten` stays `0`, and a repeated
observation increments the same proposal rather than creating another.

Transport failures are backed off exponentially from 15 minutes to a cap of 24
hours. A `429` honours `Retry-After` between one minute and the cap. While the
backoff is active the adapter makes no request and records `deferred`, which is
not a successful check.

## Freshness

`freshness` returns one explicit state:

| State | Meaning |
| --- | --- |
| `never-checked` | No attempt and no success, or only deferred/incomplete attempts. |
| `fresh` | Last validated success is at most 48 hours old and the latest attempt did not fail. |
| `stale` | Last validated success is older than 48 hours. |
| `degraded` | Latest attempt failed; any retained catalogue is last-known-good, not current. |

A retained catalogue with a degraded or stale state stays available but is never
described as current.

## Consumable summary

`modelsDevSummary` publishes `composer.models-dev-summary/1` with selected
providers from `config/models-dev.json`, bounded model fields, the freshness
record, upstream identity, incident counts and the proposed action. A provider
absent from the retained catalogue appears with `modelCount: 0` and an empty
name; it is not silently treated as supported. The selected providers are the
coding routes named by #12 and the Codex/GitHub/Cloudflare recipe; selection is
catalogue scope, not a support claim.

## Fixtures and focused checks

`tests/models-dev-adapter.test.mjs` uses local fixtures and an injected fetcher:

```sh
pnpm check:fast -- tests/models-dev-adapter.test.mjs
```

Covered: valid shape and normalisation; first population; `304` without
change-history movement; identical `200`; added model without action; changed
price/limit and model removal; cosmetic rename; malformed, partial,
missing-field and changed-schema payloads; oversized declared and streamed
bodies; timeout; `429` with `Retry-After` and recovery; repeated-failure
deduplication and backoff; deferred-before-first-check honesty; state/snapshot
round-trip and corrupt-state refusal; summary gaps; request bounds and the
absence of an authorization header.

## What this does not establish

- No scheduled run has been observed in the selected runtime. The adapter is a
  command, not automatic maintenance.
- No material supported-recipe change has been published, reverted or mapped to
  a live issue. The action ledger is local and unwritten.
- No core/Composer parity is claimed. The compact summary is not yet consumed by
  Get Ready or a public surface.
- One live `200`/`304` pair is dated evidence of the conditional read, not an
  upstream SLA, a credential check or a model-quality claim.

Those gates stay on #19 and are recorded in
[the 8 November evidence](evidence/models-dev-adapter-20261108/README.md).
