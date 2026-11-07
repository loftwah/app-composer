# Release binding, advisory seam and release-health attention — 8 November 2026

Batch 1 of the [continuation 26 plan](../../backlog-20261106.md#continuation-26--8-november-2026).
Issues: [#319](https://github.com/loftwah/app-composer/issues/319),
[#365](https://github.com/loftwah/app-composer/issues/365),
[#118](https://github.com/loftwah/app-composer/issues/118).

## Result

The delivery receipt can now bind a release to one exact candidate, the Plugin
Trust evaluation has a bounded credential-free advisory seam, and a failed or
unverified production release receipt appears as one administrator-only
**Release receipts** item in **Needs attention**. Production moved from
`d16db028` / Worker `65243396` to `bcc8eca` / Worker `9b384c29`.

| Fact | Value |
| --- | --- |
| Production source before the batch | `d16db028bc4969d966022c3e07c1d31082e2190c` / Worker `65243396-3d10-4fdf-bc54-1a47d8f05431` |
| Production source after the batch | `bcc8eca78c84cd5f2d7b6afad39150d81d51d89a` / Worker `9b384c29-dd33-4172-8c9c-2cb79d7ca175` |
| Live `/build.json` | `bcc8eca78c84cd5f2d7b6afad39150d81d51d89a` |
| Migration | none (reads `composer_delivery_runs` from `0023`) |
| Jenkins regression source | `8cef1866b292338948b8ccf01498bfbf868199e8` (clean pushed `main` before this batch) |
| Jenkins run | LTS 2.580.2, job `composer-delivery` #1, `SUCCESS` in 121.6s |
| Jenkins receipt | `app-composer.delivery-receipt/1`, runner `jenkins`, run `http://localhost:57396/job/composer-delivery/1/`, candidate `sha256:8175…026a`, artefact `sha256:279f…535d`, 1294 files, no upload |
| Candidate run source | `bcc8eca78c84cd5f2d7b6afad39150d81d51d89a` |
| Candidate receipt | `sha256:16404f69a1e36e4a4e680ea8b268fec0f9cedaf139f6ce607737cb1210a1cf8f`, artefact `sha256:36430f78949aef53b9b7ec6ed459ddc230dbb6a414222d991ed4be1fa2de69b7`, 1294 files, uploaded: false |
| Release receipt | bound to the candidate receipt digest `sha256:863170295a8ccf37df576cfb171aab9ff6a4f33f19eb37a2514437ace516d1a9`, release artefact `sha256:ab09b32f80f8f191d7ca7d696a082b815d30217c38c7a8252b3c7f5799e12817` |
| Release verification | `scripts/verify-live.mjs` passed; exact live Composer source `bcc8eca` |
| Cleanup | Jenkins container, `JENKINS_HOME`, temporary clone and root removed |

Bounded machine records stay in the ignored local `output/evidence/` and
`output/delivery/` directories. The fixture image
`composer-jenkins-fixture:d14c9e7f17c0` is the only retained local image.

## What changed

### A release binds one exact candidate

`node scripts/delivery-journey.mjs --release --candidate-receipt PATH` reads a
bounded candidate receipt and refuses the release before any command when the
source commit, Worker, account, environment, origin, composition lock or preview
Worker/origin differs. The refusal codes are explicit
(`candidate-commit-mismatch`, `candidate-target-mismatch`,
`candidate-composition-mismatch`, `candidate-preview-mismatch`,
`candidate-receipt-state`, …). A matching release records
`approval.binding` with the candidate receipt digest and the exact bound facts.

The real release in this batch used the candidate above and recorded the
binding. A second real release attempt with the same candidate receipt and a
different source commit was refused with `candidate-commit-mismatch`, `state:
refused`, `release.attempted: false`, and no upload.

A release without `--candidate-receipt` still runs under the explicit
`--release` flag, but records `approval.binding: null` and makes no claim that a
candidate was reviewed. Older receipts remain readable.

### The credential gate is documented and visible

The receipt now records `credentials: {recorded: false, required: true, source:
"operator-environment"}` for a release. The journey never reads, records or
forwards a Cloudflare token. The local Jenkins fixture runs candidates only and
does not inject `CLOUDFLARE_API_TOKEN`, account credentials or `.env` into the
container. A release from an external runner remains an owner decision: the
owner supplies a scoped credential through that runner's own secret store.

### A bounded advisory seam, off by default

`src/lib/plugin-trust-advisory.ts` defines a credential-free adapter interface
that receives only publisher DID, slug and version. No adapter is configured by
default. The evaluation records `ADVISORY_SOURCE_NONE` for no source and
`ADVISORY_SOURCE_UNKNOWN` for a configured source that is unreadable, malformed
or returns another adapter's identity. A checked source with findings produces
`ADVISORY_FINDING` (RED for high/critical, AMBER otherwise). No source is ever
treated as clean.

A changed advisory state produces one deduplicated `ADVISORY_STATE_CHANGED`
review item per publisher, package, version and code. A change to a readable
source with no findings is informational and raises no item. The watch remains
off by default, and this batch bought no feed, added no install/update path and
called no advisory provider.

### Release health in Needs attention

`src/lib/release-attention.ts` and the new `delivery` source in the shared
overview surface a recorded production release receipt that failed or performed
an upload without an independent live read. Repeated attempts for the same
commit and environment become one item; the underlying receipts stay in
**Delivery runs**. The source is administrator-only (`restricted` otherwise),
never public, and says plainly that recording is evidence, not approval and that
no Worker version or live source is read by the overview.

The Delivery runs page now anchors each receipt as `#delivery-run-<id>` and
focuses it when the overview links to a specific row.

## Checks

| Check | Result |
| --- | --- |
| `pnpm delivery:jenkins` on `8cef186` | `SUCCESS` in 121.6s; run ID, source commit, candidate digest, 1294-file artefact, receipt contract and no-upload state all matched |
| `pnpm delivery --candidate --receipt output/delivery/candidate-bcc8eca.json` | `pnpm check` passed (82.2s), preview build passed (12.0s), candidate digest and 1294-file artefact recorded, no upload |
| `pnpm delivery --release --candidate-receipt output/delivery/candidate-bcc8eca.json` | guarded deploy passed (145.5s), independent live verification passed (0.2s), binding recorded |
| Wrong-commit release attempt | refused with `candidate-commit-mismatch`; `release.attempted: false`; no command ran |
| `pnpm check:fast -- tests/delivery-journey.test.mjs tests/delivery-runs.test.mjs tests/plugin-trust-advisory.test.mjs tests/plugin-trust-watch.test.mjs tests/plugin-trust-attention.test.mjs tests/overview-release-attention.test.mjs` | types, lint, format and 56 focused tests passed |
| Live `/build.json` | `bcc8eca78c84cd5f2d7b6afad39150d81d51d89a` |
| Live public pages | `/`, `/plugin-trust` and `/docs` return 200; `/plugin-trust` contains no review anchor, table name, `Mark reviewed` or advisory code |
| Live admin boundary | Overview, Delivery runs and Plugin Trust admin routes answer 302 to an unauthenticated request |
| Live `/plugin-trust` at 1440 × 1000 and 390 × 844 | document width equals the viewport, one `h1`, no horizontal overflow, only the known CSP block of Cloudflare's Insights beacon in the console |
| Production D1 | the release-health query returns `success: true` with 0 recorded release rows (no receipt has been recorded in production yet) |

## Remaining gates

- The authenticated **Delivery runs**, **Needs attention** and **Plugin Trust**
  renders were not opened because the automation browser has no Cloudflare
  Access owner session. The route, administrator-only gate, contract and live
  unauthenticated boundary are proven; the owner-session visual pass remains an
  owner step.
- Production has 0 recorded delivery runs, so the new Release receipts source
  currently shows 0 items. Recording the release receipt is an owner-session
  action; the receipt is retained locally at
  `output/delivery/release-bcc8eca.json`.
- The daily Plugin Trust watch is still off. The advisory seam is an interface,
  not a feed: no licensed advisory source, SBOM or source-health check ships.
- #319 still lists the EKS path (#252), the other provider templates, provider
  uncertainty, revoked-credential and rollback-mismatch states, and the
  authenticated visual pass.
- #118 still lists order, connection-expiry, backup/recovery and public
  overview proof beyond this release-health slice.
- #22, #20, #18, #15 and #13 each need a real GitHub/Cloudflare/fresh-user proof
  this machine cannot supply without owner accounts; their gates are unchanged.
- #408 still needs the owner to name a host repository with two mini-app
  subdirectories at an exact commit.
