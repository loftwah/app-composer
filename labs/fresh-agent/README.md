# Fresh-agent evaluation lab

Versioned inputs, asserted outcomes and bounded results for what a new agent can do with the exported `/setup` guide and the `/roles` packs. Everything here is fictional. The harness never deploys, signs in, provisions or spends.

| Path | What it is |
| --- | --- |
| `guides/*.md` | The **actual** Markdown exported by the public `/setup` form (and the role-pack download) for each case, captured by `scripts/setup-export.mjs`. |
| `guides/provenance.json` | Capture receipt: origin, source commit, browser, byte counts and SHA-256 per export. |
| `cases/*.json` | One bounded case: task, fixture, exported settings, prompt wrapper and declarative assertions. |
| `fixtures/` | Fictional projects an agent may copy but never modify in place. |
| `results-20261025.json` | Sanitised machine-readable results of the runs recorded in `docs/evaluations/fresh-agent-20261025.md`. |

## Commands

```sh
node scripts/setup-export.mjs --origin http://127.0.0.1:4327   # re-capture the real exports
node scripts/eval-fresh-agent.mjs plan                          # list cases and assertion counts
node scripts/eval-fresh-agent.mjs check                         # deterministic self-checks, no agent
node scripts/eval-fresh-agent.mjs prepare --case new-project --root "$TMPDIR/lane-g/new"
node scripts/eval-fresh-agent.mjs run --case new-project --root "$TMPDIR/lane-g/new" \
  --agent opencode --bin "$OPENCODE_CLI" --timeout 900
node scripts/eval-fresh-agent.mjs verify --case new-project --root "$TMPDIR/lane-g/new"
node scripts/eval-fresh-agent.mjs summarise --receipts "$TMPDIR/lane-g/receipts"
```

`run` prepares the root if needed, starts exactly one agent process, then runs the assertions itself. It writes `manifest.json`, `prompt.md`, `agent.log` (redacted and capped), `last-message.md` and `receipt.json` into the owned root.

## Rules the harness enforces

- **Owned roots only.** Writing is refused outside the OS temporary directory or this repository's ignored `output/`.
- **No silent retries.** One agent process per run. `agentExit`, timeout and stderr are recorded as observed.
- **Isolation is falsifiable.** The transcript is scanned for this repository, the lab and the harness. A hit marks the run `contaminated`, which outranks any assertion result.
- **Assertions run outside the agent.** Byte hashes, the project's own test command, a real localhost probe, JSON shape derived from `src/lib/role-packs.ts`, and absence checks.
- **One disclosed correction is allowed, never a silent one.** `reverify` re-runs assertions against the untouched workspace and records `reverifiedAt` plus the reason.

## Fixtures

- `existing-notes` — a Python standard-library app with owner configuration, an owner marker and an unrelated dirty draft. Seven owner tests pass; a setup run that overwrites `site.json` fails them.
- `interrupted` — the same world after an interrupted step: one verified receipt, one stale lock, one incomplete temp file and exactly one failing test.
- `blank-start` — an empty owner folder with one marker and no chosen idea.
- `role-review` — a folder holding a downloaded QA pack and one evidence bundle; the bundle arrives from `examples/role-packs/` at prepare time.

Never run an agent against `fixtures/` in place. `prepare` copies, makes a local Git commit and records that commit in the receipt.

## Boundaries

Same-host, same-model local runs. This lab does not establish cross-client behaviour, provider onboarding, deployment, physical-device or screen-reader acceptance, cost, or longitudinal reliability. The Cloudflare Access-protected admin is not part of these cases and no owner session is used.
