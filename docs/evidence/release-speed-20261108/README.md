# Measured routine release speed — 8 November 2026

The release gate no longer pins the test suite to two files at a time. The same
575 tests now run at Node's default concurrency (`availableParallelism - 1`),
and the guarded deploy prints its total elapsed time plus the slowest stage when
the 300-second routine target is exceeded.

| Fact | Value |
| --- | --- |
| Production source before | `896e7b1` / Worker `945a82fb-4ede-41fb-a73f-65c88c36fb9d` |
| Clean pushed `main` at start | `df6ab4f` (docs-only after the previous release) |
| Production source after | `26b5c8060a7ce1cbc1300b2848118654d4df94b7` / Worker `490591d2-4078-46b5-a401-31869ed51017` |
| Live `/build.json` | `26b5c8060a7ce1cbc1300b2848118654d4df94b7` |
| Test files / assertions | 80 files, 575 tests, unchanged |
| Full suite, two workers | 90.8s (measured before the change) |
| Full suite, default concurrency | 30.4s (three runs: 31.3s, 30.4s, 33.4s inside `pnpm check`) |
| `pnpm check` before | 122.0s (27.2 types, 3.1 lint, 0.9 format, 90.8 tests) |
| `pnpm check` after | 66.3s (25.2 types, 4.6 lint, 1.1 format, 33.4 tests) |
| Focused check | `pnpm check:fast -- tests/check-fast.test.mjs tests/emdash-key-deploy-gate.test.mjs` 38.8s |
| Guarded release | `pnpm deploy` 139.3s by its own clock (142.4s wall) |
| Checks plus release | 178.1s = 2m58s, before implementation time |
| Release log | `output/evidence/release-26b5c80.log` (ignored local evidence) |

## Release stages observed in the real deploy

| Stage | Duration |
| --- | --- |
| Dependency audit | 0.6s |
| Required checks (`pnpm check`, 575 tests) | 78.1s |
| Production build and publication guard | 30.2s |
| Remote D1 migrations and receipt schema | 1.5s |
| Worker upload | 18.9s |
| Live source, sharing, privacy and administration gates | 3.6s |
| Release record | 0.3s |
| Total | 139.3s |

The in-deploy check was 78.1s rather than the standalone 66.3s, with the test
portion at 41.1s and the build at 30.2s against 15.4s standalone. That is host
and cache variance in the same work, not extra gates. The budget below uses the
slower observed release.

## What changed

- `package.json`: `test` and `test:ready` no longer pass
  `--test-concurrency=2`. Node chooses `availableParallelism - 1`, so the same
  suite adapts to smaller hosts and still serialises on a two-core machine.
- `scripts/check-fast.mjs`: focused tests use the same default concurrency.
  The type/source, lint and format gates are unchanged.
- `scripts/deploy.mjs`: records each gate duration already printed before,
  prints `Release elapsed: Ns` after the independent live read, and names the
  slowest stage when elapsed exceeds 300s, so an overrun is reported with a
  concrete cause instead of an assumption.
- `tests/check-fast.test.mjs`: expects the new focused-test arguments.

No test was removed, skipped or weakened. No release assertion was deleted. No
scheduler, hosted CI, dependency or paid resource was added.

## Why the concurrency change is safe

- The suite was run at two, four, six, ten and default workers; all 575 tests
  passed at each setting.
- Tests that need a server bind an ephemeral port (`server.listen(0)`); fixed
  `localhost` values in the delivery and team-hub tests are assertion strings,
  not listeners.
- Database and package tests own a temporary root per test and remove it in
  `finally`; no test shares a workspace-level SQLite file.
- The default is lower on smaller machines by construction, so a 14-core host
  is the fast case rather than a required configuration.

## Limits

- One host (14-core macOS, Node 22.23.4, warm pnpm store). A cold store, a
  remote D1 migration or a provider slowdown can exceed these numbers; the
  deploy now prints where the time went.
- The five-minute target covers the whole change. At 2m58s for checks plus
  release, a routine slice has about two minutes for preflight, the edit and
  the affected live inspection. Work that needs more is classified as not
  routine and gets its own window.
- The full suite still runs once per release. It is the release gate; the
  focused check is the only test run during implementation.
- Authenticated owner-session screens were not part of this release. The
  affected behaviour is the release tool itself, proven by the real deploy and
  the live source read.
