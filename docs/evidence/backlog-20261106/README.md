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
  `b9aac397-f743-4212-a6a6-8bea32497c3b`. Documentation, lint and tests only.
- Capability catalogue: PR [#415](https://github.com/loftwah/app-composer/pull/415),
  merge `9e2e2fcb4d8fba59aa7e556d22edf1801fd5dc13`, Worker
  `8db8cd14-63c3-4b2c-9d6d-9236ff242e70`.
- Catalogue rendering polish: PR [#416](https://github.com/loftwah/app-composer/pull/416),
  merge `9746822be17e47ac4e688e03aaed30991e007391`, Worker
  `a1934745-6f34-4ea1-97a7-953cea4314ce`.
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
| Deployed source (final) | `9746822be17e47ac4e688e03aaed30991e007391` |
| `/capabilities.json` | 200, contract 1, 8 apps, 5 verified operations |
| `/capabilities` | 200 HTML, canonical correct, one `h1`, no horizontal overflow at 390 or 1440 |
| `/sitemap.xml` | lists `/capabilities` once |
| `/agent.md` | links the catalogue |

## Measured async change

`readResourceInventory` (resource rows, saved-stack bindings and retained operations)
now reads its three independent D1 statements together. With a fake D1 adding 40 ms per
read, five samples moved from a 126.5 ms median to 42.2 ms. This is a local Node
measurement, not a production p95. Overview's two scope reads run together within D1's
six-connection budget; the four problem-source reads deliberately stay sequential.

## Capability catalogue (first slice of #412)

Composer's verified description of the operations the shipped apps already support:
`POST /api/inspect` and `/healthz` for Link Check, the invitation and public items reads
for Here / there, and the published profile read for Linkarooie. Validation rejects
unknown apps, duplicates, unsafe paths, stray fields, credential-like fields, public
effects and effect operations without confirmation. Each entry names its real permit and
verification date; none grants access or executes anything.

This is **not** the full #412 acceptance: app-owned declarations read from each
`app.manifest.json` and a verified authorised mutation remain open. Screenshots:
[desktop](capabilities-desktop.png) · [phone](capabilities-phone.png).

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
