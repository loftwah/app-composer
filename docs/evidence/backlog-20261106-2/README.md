# Backlog continuation — 6 November 2026

Second delivery batch for the 6 November backlog. Exact source and Worker identity
are recorded after the guarded production release; nothing here treats a local
check as deployment evidence.

## Closed issues

- [#401](https://github.com/loftwah/app-composer/issues/401) — testing stays fast
  and evidence-based. The focused selector, full release gate and current
  zero-skip suite are verified below.
- [#395](https://github.com/loftwah/app-composer/issues/395) — owned-resource
  registration and bounded teardown now exist in the real run entrypoints and
  are proven for success, failure, timeout and cancellation.

## #401 — suite and selector evidence

| Check | Result |
| --- | --- |
| `pnpm test` on default Node 22.23.4 | 420 passed, 0 failed, 0 skipped, 66.9 s |
| `pnpm test` on Node 26.13.0 | 420 passed, 0 failed, 0 skipped, 59.8 s |
| `pnpm check:fast -- tests/owned-resources.test.mjs tests/freshness-policy.test.mjs tests/access-identity.test.mjs tests/core.test.mjs tests/public-pages.test.mjs` | types/source, semantic lint, format and 21 focused tests passed |
| `pnpm check:fast` behaviour | rejects no/non-test/outside-test paths; runs the same type/source, lint and format gates; reports each stage and stops at the first failure |
| `pnpm deploy` | runs `pnpm check` and `pnpm build` once on the clean pushed commit before remote mutations |

The suite has no optional skips on either declared runtime. The deliberate
November reduction is respected: no deleted test file was restored. Two focused
tests were added for the real owned-resource and freshness-policy gaps.

## #395 — owned resources and teardown

`scripts/lib/owned-resources.mjs` registers only resources created by one run:

- a temporary directory, accepted only under the operating system temporary root;
- a detached child's exact process group;
- an HTTP server;
- a timer;
- an abort signal and a bounded, idempotent teardown report.

Teardown runs on success, failure, timeout, `SIGINT` and `SIGTERM`. It closes or
removes only registered handles and never scans for or signals unrelated
processes. It does not use `pkill`, add a daemon or delete historical files.

Actual entrypoints using the registry:

- `scripts/platform-demo.mjs`;
- `scripts/platform-qualification.mjs`;
- `scripts/render-journeys.mjs`.

Fresh controlled proof: `tests/owned-resources.test.mjs` launches a child fixture
that creates a temporary directory and a child process, then completes, throws,
exceeds a 300 ms deadline or receives `SIGTERM`. For every case the report is
`clean`, every registered resource is `released`, the owned directory is gone and
the owned child is not alive. A separate parent-owned temporary directory and
child process survive every scenario byte-for-byte and remain alive.

`node --experimental-transform-types scripts/platform-qualification.mjs` also ran
the actual entrypoint: it produced the integration receipt and
`ownedTemporaryRootRemoved: true`; no owned temporary project root remained.

## Dependency, runtime and freshness slice (#321 / #316)

Exact installed versions after the tested batch:

| Package | Before | Now |
| --- | --- | --- |
| `astro` | 7.4.2 | 7.4.5 |
| `@astrojs/cloudflare` | 14.4.2 | 14.4.4 |
| `@astrojs/react` | 7.1.1 | 7.1.2 |
| `@tailwindcss/vite` / `tailwindcss` | 4.3.3 | 4.3.4 |
| `jose` | 6.2.13 | 6.2.15 |
| `@cloudflare/workers-types` | 5.20261024.1 | 5.20261104.1 |
| `@lucide/astro` | 1.61.0 | 1.69.0 |
| `emdash` / `@emdash-cms/cloudflare` | 1.3.1 | 1.4.0 |

`@tanstack/react-router` stays pinned to 1.163.2 because `@emdash-cms/admin`
pins the same exact version. TypeScript stays on 6.0.3 because `@astrojs/check`
peers on `^5 || ^6`. Wrangler stays on 4.152.0 because Get Ready verifies that
exact executable. EmDash 1.4 has no database migration; its caching-header
change and sandboxed-plugin gate were reviewed, and the retained suite passed.

Node 26.13.0 is now a declared, tested line. The synthetic Access fixture needed
the `session.get` method introduced by EmDash 1.4; that was a test-fixture gap,
not a Node incompatibility. `pnpm freshness` reports `27 ok, 0 drift, 0 unknown,
0 unresolved`; `pnpm audit --audit-level low` reports no known vulnerabilities.
`tests/freshness-policy.test.mjs` keeps the parser, exit codes and policy honest.

Still open in #316: remote upstream/advisory/EOL comparison, native EmDash
**Stack status** integration, and an authenticated EmDash owner check against
1.4. Still open in #321: the independent mini-app repositories keep their own
release batches and policies.

## Task-first surface (#313 / #297)

`/guide` previously opened with a long definition and no working action. It now
opens with three direct entries — `/setup`, `/init` and `/learn` — before the
reference material. The reference text and routes remain unchanged.

Observed in a real browser:

| Check | 1440 × 1000 | 390 × 844 |
| --- | --- | --- |
| Task cards in the first viewport | yes, top 668 px | first card top 717 px |
| No horizontal overflow | 1440 / 1440 | 390 / 390 |
| Both themes | dark/light captured | dark/light captured |
| Keyboard focus | task link outline `3px solid rgb(252, 91, 5)`, offset 4 px | shared components unchanged |
| Live routes | `/setup`, `/init`, `/learn` resolve | same |

Screenshots: [1440 dark](guide-1440-dark.png) · [1440 light](guide-1440-light.png) ·
[390 dark](guide-390-dark.png) · [390 light](guide-390-light.png).

This is one scoped slice; the broader #313 EmDash and #297 role-expansion
acceptance remains open.

## #412 — capability pattern

No owner-authorised mutation was performed. The existing Composer-verified
catalogue stays at `/capabilities` and `/capabilities.json`. An app-owned
declaration in the owning repository and a real authorised mutation remain the
two gates; neither is claimed here.

## Release identity

Pending the guarded clean pushed-main release in this batch.

## Cleanup

- Screenshots retained above are the bounded evidence; the rest of ignored
  `output/` was removed.
- The controlled fixture removes its own temporary roots; the parent test retains
  and then removes only its unrelated fixture.
- The owner's untracked `paperwork-lab-test-pack.zip` was not touched. Its
  SHA-256 remains `f542b8318b5f49a4f75639948d28ece6357f957ccac25c6f280209bd0dd2c3ce`.
- No live worktree, service or unrelated process was stopped.
