# Backlog delivery — 6 November 2026

Delivery for [#398](https://github.com/loftwah/app-composer/issues/398),
[#407](https://github.com/loftwah/app-composer/issues/407) and
[#411](https://github.com/loftwah/app-composer/issues/411). The source and live
identity below are the ones actually deployed, not a plan.

## Release identity

- First batch: PR [#413](https://github.com/loftwah/app-composer/pull/413), merge
  `703a8fc5f6e34644ffbdb4119422bb8011e9207e`, Worker
  `3b263d3c-cec3-48d2-8f90-4c969cb9ae44`.
- State-ownership batch: PR [#414](https://github.com/loftwah/app-composer/pull/414),
  merge `0c1924f6b0c365ed5d04d3d70b39a1a66fa42dd4`, Worker
  `b9aac397-f743-4212-a6a6-8bea32497c3b`. This batch changes documentation, the
  lint entrypoint and tests only.
- Origin: `https://composer.loftwah.com`
- Release path: clean pushed `main` → `pnpm deploy` (audit, `pnpm check`, build,
  publication/privacy gates, D1 migrations, upload, live source verification).

## Checks

- `pnpm check`: 411 passed for the first batch, 412 passed for the second; 0 failed,
  0 skipped; 0 type errors.
- `pnpm deploy`: dependency audit, required checks, production build, publication
  guard (1,280 files / 150 archive members), remote migrations, Worker upload,
  live source/pinned services, sharing output, publication privacy and anonymous
  administration boundary all passed.
- Generated enquiry and stack-share assets match their maintained sources
  (`scripts/enquiry-assets.mjs --check`, `scripts/stack-share-assets.mjs --check`).

## Live observations

| Check | Result |
| --- | --- |
| `/sitemap.xml` contains `/init/launch-kit` | present once |
| `/init/launch-kit` | 200 `text/html`, canonical `https://composer.loftwah.com/init/launch-kit` |
| `/brand/enquiries/browser/enquiry-form.js` | serves the shared body limit (`enquiryLimits.bodyBytes`) |
| `/brand/stack-share.mjs` | serves the slug/revision binding, not a copied `v2` prefix |
| `/api/composition.json` | 200, contract 1, 3 sources, 10 releases |
| `/s/fictional-trail-notes` | 200 |
| Deployed source (both batches) | `703a8fc5f6e34644ffbdb4119422bb8011e9207e`, then `0c1924f6b0c365ed5d04d3d70b39a1a66fa42dd4` |

## Measured async change

`readResourceInventory` (resource rows, saved-stack bindings and retained operations)
now reads its three independent D1 statements together. With a fake D1 adding 40 ms per
read, five samples moved from a 126.5 ms median to 42.2 ms. This is a local Node
measurement, not a production p95. Overview's two scope reads run together within D1's
six-connection budget; the four problem-source reads deliberately stay sequential.

## Not claimed

- Production admin interaction for the resource inventory was not exercised. The change
  reads the same rows in the same order; its behaviour is covered by types and the shared
  contract, not a new production timing claim.
- Google Search Console/Bing property status remains owner action and was not inferred
  from the 200/sitemap responses. [#397](https://github.com/loftwah/app-composer/issues/397)
  keeps that work.
- No deleted test suite was restored and no new broad test campaign was added.

## Cleanup

- Eight stale Git worktree registrations whose directories no longer existed were pruned;
  live worktrees were not touched.
- The owner's untracked `paperwork-lab-test-pack.zip` was moved aside only for the clean
  release guard and restored byte-identically
  (`sha256:f542b8318b5f49a4f75639948d28ece6357f957ccac25c6f280209bd0dd2c3ce`).
- No owned temporary project roots remain. Ignored `output/` logs are removed after this
  receipt is recorded.
