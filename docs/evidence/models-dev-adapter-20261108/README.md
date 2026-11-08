# models.dev adapter evidence — 8 November 2026

First executable slice of [#19](https://github.com/loftwah/app-composer/issues/19).
No runtime, Worker, migration, credential, scheduler or issue writer changed.
Production stays at Composer `220a7438545644506ffe6f545604f03a4e0a1f4f`,
Worker `09b67f2d-bca4-4397-ad3f-a871b2f19599`.

## Delivered

- `src/lib/models-dev-adapter.ts`: bounded conditional read, whole-payload
  validation, retained last-known-good snapshot, change classification,
  freshness states, outage backoff, deduplicated incident/action ledger and
  `composer.models-dev-summary/1`.
- `scripts/models-intelligence.mjs` / `pnpm intelligence:models`: one manual
  check per invocation, with a fixture mode and an explicit clock for controlled
  drills.
- `config/models-dev.json`: selected providers (`openai`, `anthropic`,
  `opencode-go`, `deepseek`) and the exact source URL.
- `docs/models-intelligence.md`: contract, limits, semantics and gates.
- 16 focused tests over local fixtures.

## Real conditional read

Two live invocations against `https://models.dev/api.json` from this machine.
The adapter sent `If-None-Match` from the retained store; no credential was used.

| Run | UTC | Outcome | Bytes | ETag | SHA-256 | Catalogue |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 01:22:05.329 | HTTP 200, `changed` | 5,970,151 | `W/"e28d990aed3645a5372056d4908ba833"` | `e28d990aed3645a5372056d4908ba83372ac81a0561afe96ee05942ebd1f8f85` | 235 providers, 8,946 models |
| 2 | 01:22:11.756 | HTTP 304, `unchanged` | 0 | unchanged | unchanged | unchanged |

Run 2 advanced `checkedAt` from `01:22:05.329Z` to `01:22:11.756Z` and left
`changedAt` at `01:22:05.329Z`. It recorded 0 incidents, 0 actions, 0 model
calls and 0 issue writes. No retry was used: each run succeeded on its first
attempt.

Artifacts: [`live-200.json`](live-200.json), [`live-304.json`](live-304.json),
[`state.json`](state.json) and the consumable
[`summary.json`](summary.json). Paths are redacted to `$REPO`; the retained
6 MB catalogue stays in the ignored `output/` store and is not committed.

## Controlled failure and recovery drill

The upstream was **not** broken. A separate drill store substituted local
fixtures through `--fixture` and an explicit synthetic clock, so this proves the
adapter's failure and recovery behaviour rather than a live outage.

| Step | Clock | Input | Result |
| --- | --- | --- | --- |
| 1 | 02:00 | `catalogue-v1.json` | `changed`, `fresh`, no incident |
| 2 | 02:10 | `catalogue-partial.json` | `schema-invalid`, `degraded`, retained catalogue kept, one open incident, backoff until 02:25 |
| 3 | 02:30 | `catalogue-v1.json` | `unchanged`, incident `recovered`, `fresh`, `changedAt` still 02:00 |

The incident fingerprint is
`models.dev|models-dev-api|codex-github-cloudflare-hello-v2@2|schema-invalid`;
the detail names the fixture defect (`Provider "fictional-labs" has no usable
name.`). The recovery requirement is the adapter's own
`fetch-and-validate` check. Artifacts: [`drill/run1.json`](drill/run1.json),
[`drill/run2.json`](drill/run2.json), [`drill/run3.json`](drill/run3.json) and
[`drill/state.json`](drill/state.json).

## Checks

```sh
pnpm check:fast -- tests/models-dev-adapter.test.mjs
```

Types and generated source passed (17.3s), semantic lint passed (2.3s), format
passed (0.7s), and 16 focused tests passed with 0 failures. The focused suite
covers:

- reviewed shape normalisation; first population; `304` and identical `200`
  without change-history movement;
- added model as informational with no action; changed price/limit plus model
  removal as material with one deduplicated action; cosmetic rename;
- malformed, partial, missing-field and changed-schema payloads refusing the
  whole candidate while retaining last-known-good;
- oversized declared and streamed bodies; timeout; `429` with `Retry-After` and
  recovery; repeated-failure deduplication, backoff and deferred honesty;
- state/snapshot round-trip and corrupt-state refusal; summary gaps; request
  bounds, redirect refusal and no authorization header.

`pnpm check:types` separately reported 0 errors before the focused run.

## Not proven

- No scheduled run exists or was observed in the selected runtime. The daily
  cadence in #19 is still a proposal.
- No material change has been published, reverted or written to a live GitHub
  issue. The action ledger is local and `issuesWritten` remains 0.
- Core and Composer do not yet consume the same freshness facts. The summary is
  a contract, not a live consumer.
- One 200/304 pair is not an upstream SLA, a model-quality claim, a credential
  test or evidence that any listed model works with a Composer recipe.
- The fixture drill is not a live outage. A real outage and recovery at the
  selected runtime remain open with the scheduler gate.
