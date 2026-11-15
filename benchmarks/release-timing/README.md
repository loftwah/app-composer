# Release timing receipts in Benchmarks Studio

Benchmarks Studio can read the `release-timing/v1` receipt that a guarded release
writes under `.release/timing/`. It validates the receipt, groups finished runs by
repository and release path, and reports the total, slowest stage, target, strict
limit, status and measured coverage.

This is a local, read-only ingest. It does not execute a receipt, call a model or
provider, run a hosted job or publish private evidence.

## Receipt contract in one paragraph

A receipt records repo, project, exact 40-character source SHA, run ID, release
kind and path, start/end UTC, target and limit, monotonic total and stage times,
status (`passed`, `over-budget`, `failed` or `incomplete`), failure text, notes
and alert state. **Exactly 300,000 ms is a breach.** Only a duration strictly
below 300,000 ms may be called `passed`. The canonical contract and generator are
[`lib/delivery/release-timing.mjs`](../../lib/delivery/release-timing.mjs) and
[issue #624](https://github.com/loftwah/app-composer/issues/624).

## Ingest a receipt directory

From this checkout, point at this repository's receipt directory:

```sh
node benchmarks/release-timing/report.mjs --dir .release/timing
```

The same command as a package script:

```sh
pnpm bench:release-timing --dir .release/timing
```

For another repository, pass its receipt directory without copying or executing
anything:

```sh
node benchmarks/release-timing/report.mjs --dir /path/to/other-repo/.release/timing
```

The directory is read in file-name order. Only `receipt-*.json` files are read;
`breaches.json` and `pending/` are ignored.

Print the deterministic JSON comparison instead of the table:

```sh
node benchmarks/release-timing/report.mjs --dir .release/timing --json
```

The JSON has no timestamp, so the same receipts always produce the same bytes.
Groups are sorted by repository and release path; each group's history is sorted
by `endedAt` and then `runId`. The newest run supplies the group status, total,
slowest stage and coverage.

## Portable pack

A pack is one JSON envelope around one or more unmodified `release-timing/v1`
receipts. The complete public-safe example is
[`example-pack.json`](example-pack.json):

```json
{
  "schema": "release-timing-pack/v1",
  "note": "Deploy targets are omitted; keep them in the private receipt.",
  "receipts": [ ]
}
```

Read it with:

```sh
node benchmarks/release-timing/report.mjs --pack benchmarks/release-timing/example-pack.json
```

To copy one receipt from another repository safely, strip the private deploy
target and wrap the receipt without editing any measured field:

```sh
node -e '
const fs = require("node:fs");
const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (receipt.notes) delete receipt.notes.deployTarget;
process.stdout.write(JSON.stringify({
  schema: "release-timing-pack/v1",
  note: "Public-safe receipt copied for comparison.",
  receipts: [receipt]
}, null, 2) + "\n");
' /path/to/other-repo/.release/timing/receipt-<run-id>.json \
  > /tmp/release-timing-pack.json
```

Review the pack before sharing it. `failure`, free-text notes and any other
private value are never printed by the report, but the pack itself still contains
them. Share the report, not an unreviewed raw pack.

## What is refused

The importer calls the canonical `assertReceipt` first, then adds the checks the
comparison needs:

- an unknown schema, version, top-level field, stage field, alert field or pack
  field;
- a missing total, stage duration, timestamp, coverage label or other required
  field;
- a `passed` or `over-budget` status that disagrees with the 300,000 ms boundary,
  or a limit other than 300,000 ms;
- a status of `running`: an unfinished run is not comparison evidence;
- a live revision that is missing for a finished pass, malformed or different
  from the source SHA;
- a repeated run ID in one batch;
- a URL, absolute private path or secret-shaped value in a published field;
- any receipt that `redact()` would change, because the caller cannot tell which
  credential or signed URL was removed;
- a stage sum that exceeds the total beyond the generator's small timing slack,
  or an unmeasured time that hides a larger gap between stages and total.

Refusing is deliberate: a receipt that cannot be compared honestly is an error,
not a zero, a pass or a silently redacted claim.

## Report fields

Each group reports `repo`, `releasePath`, `runs`, `status`, per-status counts,
`targetMs`, `limitMs`, `totalMs`, `slowestStage`, `measuredMs`, `unmeasuredMs`,
`coveragePct`, the newest `latest` receipt summary and the ordered `history`.

Coverage is the summed stage time divided by the monotonic total. Unmeasured time
is named rather than hidden; for example the Composer fixture measures 86,300 ms
of a 92,500 ms total, so coverage is 93.30% and 6,200 ms is unmeasured.

The report never includes `notes.deployTarget`, `failure`, credential-shaped
values, a cost estimate, a winner or a rank. Over-budget is a timing SLO result,
not a claim that the deployment failed.

## Fixtures

The fixtures are test data, not production evidence:

| File | Origin |
| --- | --- |
| `fixtures/receipt-composer-pass.json` | Reconstructed from the measured stage record in #624: 92,500 ms total. |
| `fixtures/receipt-studio-pass.json` | Copied from a public-safe Studio release receipt: 27,035 ms total. |
| `fixtures/receipt-over-budget.json` | Constructed to exercise a 312,400 ms breach. |
| `fixtures/receipt-failed.json` | Constructed to exercise a failed release. |
| `fixtures/receipt-incomplete.json` | Constructed to exercise a run that stopped before live identity. |

The two passing fixtures have genuinely different durations and different slowest
stages, so the comparison is not one number copied twice.

## Focused check

```sh
node --test tests/benchmark-release-timing.test.mjs
```

The test covers a valid pass, over-budget, failed, incomplete, the 299,999 /
300,000 / 300,001 ms boundary, a duplicate run ID, a forged live SHA, missing and
extra fields, URL/path/secret refusal, deterministic ordering and the comparison
summary.

## Known gap

The public `/benchmarks` page links to this ingest and documents the gap instead
of publishing receipts: the canonical receipts live in each repository's ignored
`.release/timing/` directory, so the page has no public-safe run to display yet.
A future slice can publish a reviewed, explicitly selected pack and render the
same report. No hosted inference is required for any part of this importer.
