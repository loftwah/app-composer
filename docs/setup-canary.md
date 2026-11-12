# Setup canary: owner, command, cadence and budget

Reviewed 8 November 2026. This is the recurring check for the portable
`/setup` guide ([#292](https://github.com/loftwah/app-composer/issues/292)). It
reuses the committed fresh-agent harness and adds no scheduler, GitHub Action,
hosted CI, container or paid service. [#19](https://github.com/loftwah/app-composer/issues/19)
still owns upstream intelligence maintenance; this document does not satisfy its
acceptance.

## Owner

The Composer delivery agent, the same agent that integrates changes and releases
this repository, runs and records the canary. MP owns scope, any budget change
and any decision to qualify another agent client or provider. A run is evidence
about the product; it never approves a release, widens permissions or closes an
issue by itself.

## Exact command

The canary needs a local render of the source under review, the committed
fixtures and one agent CLI.

```sh
# 1. Render the source under review (an existing local dev server is fine).
pnpm dev

# 2. Capture what the real /setup form produces, then run the deterministic checks.
node scripts/setup-export.mjs --origin http://127.0.0.1:4321
node scripts/eval-fresh-agent.mjs check

# 3. One fresh session per case, each in its own owned temporary root.
export OPENCODE_CLI="$HOME/Library/Application Support/ai.opencode.desktop/cli/<version>/opencode-cli"
BASE="${TMPDIR:-/tmp}/composer-setup-canary/$(date +%Y%m%d)"; mkdir -p "$BASE/receipts"
node scripts/eval-fresh-agent.mjs run --case new-project --root "$BASE/new" \
  --agent opencode --bin "$OPENCODE_CLI" --timeout 900
node scripts/eval-fresh-agent.mjs run --case existing-change --root "$BASE/existing" \
  --agent opencode --bin "$OPENCODE_CLI" --timeout 900
node scripts/eval-fresh-agent.mjs summarise --receipts "$BASE/receipts"
```

Use `opencode-cli` on `PATH` instead of the absolute path when that is the
installed client. The harness refuses to write outside the OS temporary
directory or this repository's ignored `output/`, starts exactly one agent
process per run, and records the assertions itself. Copy the receipts that will
be committed into `labs/fresh-agent/results-<date>.json`, write the dated
record, then remove the exact owned root. Raw transcripts stay ignored.

## Compare reasoning effort on the same task

Use two fresh fixture roots and the same signed-in Codex CLI. The existing
`existing-change` case checks an actual HTTP response, the project's tests,
the agent's structured report and the original bytes of four owner files.

```sh
node scripts/eval-fresh-agent.mjs run --case existing-change --root "$BASE/medium" \
  --agent codex --model gpt-6.1-sol --reasoning medium
node scripts/eval-fresh-agent.mjs run --case existing-change --root "$BASE/high" \
  --agent codex --model gpt-6.1-sol --reasoning high
```

Add `--bin /absolute/path/to/codex` to both commands to use a specific installed
CLI. Each receipt records the executable version, requested model and requested
effort. Check the session header for effective settings and record any account
or client rejection before comparing results. Compare assertions passed,
elapsed time and human intervention. If both efforts pass, use a more demanding
fixture with a concrete invariant before drawing a conclusion about capability.
Keep the two receipts and clean up the owned roots as above.

## Cadence and rotation

| Check | When | Sessions |
| --- | --- | --- |
| Weekly | Alternating: `new-project` in odd ISO weeks, `existing-change` in even weeks | 1 |
| Monthly | First working day: full rotation — new, existing, repeat on the prepared workspace, interrupted resume | 4 |
| After change | Within two working days of a merged change to `src/lib/project-setup.ts`, the guide schema or version, a fixture, the harness, or the qualified agent client/model | affected cases |

The repeat case copies a completed workspace and runs the same guide again, so
the session has to reconcile a stale project statement with a project that
already exists. Copy the manifest too and rewrite its `workspace` field to the
copy: the harness trusts that path for the agent's working directory and for the
assertions. A copied manifest that still names the source silently re-runs in
the source; one attempt on 8 November was discarded for exactly this. The resume
case starts from the committed interrupted fixture.

## Budget

- At most four agent sessions in a normal month, eight when a post-change re-run
  lands in the same month.
- Fifteen minutes per session; observed local sessions take 2–6 minutes. The
  harness kills the process group at the limit and records `agentTimedOut`.
- No provider credential, Composer account, Cloudflare Access session,
  deployment, account creation or purchase. The agent may use host browser
  tooling; the run record names what it had.
- Fixtures are fictional and local. Real external projects are inspected
  read-only under their own issue; they are not handed to this canary.

## Failure handling and backoff

A failed assertion is not retried inside the run. Classify it first as missing
context, unclear instruction, stale command, environment or access, unsupported
capability, or agent behaviour — the taxonomy #292 names. One same-case re-run is
allowed after that classification is recorded; the first attempt stays in the
record and counts.

Two consecutive failures of the same case at the same guide version stop the
rotation and update one regression issue with the receipt, the failing assertion
and the smallest reproduction. Do not open a second issue for the same failure
signature, and do not add an automatic retry loop.

If the qualified CLI is unavailable, signed out or over its usage limit, record
`blocked` with its exact message and resume at the next cadence. Do not buy
credits, switch providers silently or substitute a model narrative for the
assertions.

Contamination outranks assertions. A session that references this repository,
its lab or the harness is `contaminated` and can never be reported as a pass.

## Regression rule

- A guide version is described as tested only at the export hash recorded in the
  ledger. If the renderer changes bytes for a case's settings,
  `node scripts/eval-fresh-agent.mjs check` fails its hash comparison and the
  affected core cases must be re-run before the public summary claims that
  version.
- Changes to a case, fixture or assertion are versioned evaluation changes:
  state them in the dated document and keep the earlier receipts.
- The public **Tested setups** summary is generated from
  `labs/setup-evaluation/runs.json`. Only committed, sanitised run records enter
  it; export and schema checks never count as agent runs.
- Record the actual client and model per run. Different clients are reported
  separately, never pooled into one reliability number.
- No reliability-over-time claim until at least three subsequent dated rotations
  exist for the same guide version. One batch is a baseline, not a trend.

## Retention

Committed: the dated evaluation document, `labs/fresh-agent/results-<date>.json`,
the public run ledger entries, and the captured exports with their provenance.
Ignored: raw transcripts and screenshots under `output/` or the owned temporary
root. Receipts are redacted for home paths and email addresses by the harness;
replace remaining temporary paths with `$TMPDIR` before committing a ledger.

## What this does not establish

Same-model, same-host local runs. The canary does not establish cross-client
behaviour, provider onboarding or sign-in, deployment, physical-device or
screen-reader acceptance, cost, or longitudinal reliability. The
Cloudflare Access-protected admin is not part of any case and no owner session is
used.
