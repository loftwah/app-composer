# Async waterfall audit — 6 November 2026

Issue: [#407](https://github.com/loftwah/app-composer/issues/407). Scope: request paths in
this repository only. No provider account was read, no mutation was parallelised and no
release gate was reordered.

## Method

1. Traced awaited chains in `src/pages`, `src/lib`, `src/plugins`, `src/worker.ts`,
   `lib/get-ready` and the maintained release scripts.
2. Classified each candidate as independent, result-dependent, ordering/security
   critical, resource-bound or outside a hot path.
3. Measured the one candidate that can be exercised without the EmDash plugin runtime:
   `readResourceInventory`, the shared read behind **Needs attention → App resources**.
   The harness is an owned, ignored script (`output/perf-inventory-before.mjs`) with a
   fake D1 that adds 40 ms to each independent `all()` read.
4. Re-ran the same harness after the change. Five samples, same host, same shape.

## Measured result

| Read | Before | After |
| --- | --- | --- |
| `readResourceInventory` (3 independent D1 reads, 40 ms each) | 126.5 ms median | 42.2 ms median |

That is a 3.0× reduction for the shared resource inventory read. Individual samples are in
the delivery comment for #407. This is a local Node measurement with a stubbed D1; it does
not claim a production p95 or a Cloudflare round-trip figure.

## Changed

- `src/lib/resource-inventory.ts`: the resource rows, saved-stack bindings and retained
  operations are three independent statements scoped to the same workspace. They now run
  in one bounded `Promise.all`. Ordering inside each result is unchanged.
- `src/lib/overview.ts`: the workspace list and recorded environments start together. The
  four problem-source reads stay sequential: together with the resource inventory they
  could exceed D1's six simultaneous connections, so the change stops at the bounded pair.
  A failing source still becomes `unavailable` without suppressing the others.
- `src/pages/api/composition.json.ts`: sources and releases are two independent reads in
  one response, within the same D1 budget.
- `src/pages/s/[slug].astro`: the share-card identity and publication action key are both
  pure crypto derivations from the same immutable publication and now run together.

## Intentionally sequential

- Release, promotion, migration and provider operations. Their order is the safety
  property; parallelising them would be a regression even when the writes look independent.
- Readiness checks whose later probes depend on an earlier target or ownership result.
- Sitemap pagination. The next page needs the previous cursor, so the loop stays serial.
- Per-resource configuration digests. The loop is bounded at 50 and each digest is CPU
  work over already-read rows, not a network wait.
- The four Overview problem-source reads. Running them together plus the inventory read
  could exceed D1's six simultaneous connections; the measured inventory win is kept and
  the broader fan-out is rejected.

## Reviewed with no worthwhile change

- `src/plugins/miniapps/use-miniapps.ts`, `resource-inventory-page.tsx` and
  `orders-page.tsx` already load independent apps with `Promise.allSettled` and guard
  stale responses with generation counters.
- The public launcher and browser bundle do no network reads on open.
- `src/lib/activity-view.ts` and `/activity` already fan out with `Promise.allSettled`.
- The release verifier is deliberately staged; its waits are checks, not independent work.

## Verification

- `pnpm check:types` — 0 errors.
- Focused tests for the touched contracts (sitemap, enquiry, inbox journey) — passed.
- `pnpm check` and the guarded release are recorded in the delivery receipt for this
  change. No production timing counter was added or claimed.
