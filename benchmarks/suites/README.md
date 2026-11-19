# Versioned suite packs

A suite pack is a small JSON file that names deterministic checks already
implemented in `benchmarks/suites/*.mjs`, plus the committed results file that
contains its evidence. It is data, not executable code: adding a pack cannot add
a provider call, a credential or a spend.

The validator is `src/lib/benchmark-suite.mjs`. It refuses a pack that is
undated, asks for a network or credential, claims spend, references a check the
committed results do not contain, or claims a recorded result that did not pass.
`/benchmarks/suites` calls the same validator while building.

## Schema `benchmark-suite/v1`

```json
{
  "schema": "benchmark-suite/v1",
  "id": "FLOW-01",
  "name": "Short pack name",
  "description": "What this pack measures, in 20 to 400 characters.",
  "kind": "deterministic",
  "providerFree": true,
  "requirements": {
    "network": false,
    "credentials": [],
    "spendMicro": 0
  },
  "checks": [
    { "module": "sandbox-save-reopen", "id": "edit-survives-reopen" }
  ],
  "evidence": {
    "status": "recorded",
    "file": "benchmarks/results/latest.json",
    "source": "951b31384a6abb85f947fbc46c87a3ee95363c63",
    "recordedAt": "2026-11-15T13:30:04.758Z"
  },
  "limits": [
    "What this pack still does not prove, in one readable sentence."
  ]
}
```

| Field | Rule |
| --- | --- |
| `id` | Uppercase pack id such as `FLOW-01`, at most 32 characters. |
| `kind` | Must be `deterministic`. A provider run belongs in a separate record. |
| `providerFree` | Must be `true`. |
| `requirements.network` | Must be `false`. |
| `requirements.credentials` | Must be an empty array. |
| `requirements.spendMicro` | Must be `0`. |
| `checks[].module` | File stem in `benchmarks/suites/`, for example `sandbox-save-reopen`. |
| `checks[].id` | Check id exported by that module. |
| `evidence.status` | `recorded` or `not-run`. |
| `evidence.file` | A committed `benchmarks/results/*.json` file when recorded. |
| `evidence.source` | The exact 40-character source revision of that run. |
| `evidence.recordedAt` | The `generatedAt` timestamp of that run. |
| `evidence.note` | Required when `status` is `not-run`: say why no evidence exists yet. |

A pack with no evidence says **not run** on `/benchmarks/suites` and is never
rendered as a pass. The committed results file is checked for every named check
and for the same source and timestamp. If they disagree, the pack is not run.

## SHIPPED PACKS

| Pack | What it checks | Evidence |
| --- | --- | --- |
| `FLOW-01` | Public sandbox save/reopen, tamper refusal, moderation after restore and blueprint export | `benchmarks/results/latest.json` (recorded 15 November 2026) |

## RUN ONE

```sh
node benchmarks/runner.mjs --suite FLOW-01
```

The runner loads the JSON spec, resolves the named modules, runs only the named
checks and prints the same result shape as a normal run. The existing `.mjs`
suite discovery is unchanged: `node benchmarks/runner.mjs` still runs every
suite.

## Cloudflare creation campaign

[CF-COMPOSE](../cloudflare-composition/README.md) defines six creator journeys
and a local foundation pack for the Cloudflare wishlist. Its optional pack uses
this runner with `--suites benchmarks/cloudflare-composition --suite CF-COMPOSE-01`.
Local helper results and full browser/provider qualification are reported
separately; this campaign does not add a routine release gate.
