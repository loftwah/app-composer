# Runtime source and command coverage

Reviewed for #175 on 18 October 2026. This inventory reads each repository's
exact `main` tree, package scripts, compiler configurations, emission maps and
format lists. It does not promote a composition pin or establish a new app
build/deployment. Composer's next native bridge batch starts from `193ee41`.

| Repository | Inspected main | Runtime type/check coverage | Semantic lint and formatting scope |
| --- | --- | --- | --- |
| Composer | [`193ee41`](https://github.com/loftwah/app-composer/tree/193ee41f37d568e148340c835ffad5dd0fdb772b) | Content/recipe emission, Creator emission, launcher/QR/sharing emission, then `astro check`. This batch extends Creator to the eleven named `.mts` authors below. Legacy `.mjs` is not covered by an implicit `checkJs` policy. | Content/Creator strict unused-local/parameter checks; eighteen named Creator authors/gates/tests through Prettier. This is not whole-repository lint/format. |
| Guestbook | [`2d9921e`](https://github.com/loftwah/app-composer-guestbook/tree/2d9921e4e662d4b9e3c01b0335a356d052edabc4) | `scripts/build-source.mjs`: Worker `src/**/*.ts`/`.mts`, publisher, and browser source programs; same-path publisher and mapped browser distributions checked. | Same programs with unused-local/parameter checks; browser/publisher, selected release tests/tools/configs. Most Worker source is outside the format list. |
| Linkarooie | [`579d01e`](https://github.com/loftwah/app-composer-showcase/tree/579d01e4fefa28042cd934eb56b2d07dbd78238e) | Same three programs and explicit `scripts/source-map.json`; browser `.d.ts` outputs are deliberately not committed, while the mapped shared `.d.mts` files are checked. | Same semantic checks; browser/publisher plus `item-provider.ts`, `resource-collection.ts`, the scoped-source test and selected gates/configs. Most other Worker source is outside the format list. |
| Link Check | [`99893a3`](https://github.com/loftwah/app-composer-linkcheck/tree/99893a39cf1ce7f13233042eab3c3b047f05cf1f) | Identity generation then the three source programs. `browser-assets.mjs` is a compatibility entry to that same checker. | Same semantic checks; browser/publisher and selected release/report tests/tools/configs. Most Worker source is outside the format list. |
| Hello World | [`3286ef3`](https://github.com/loftwah/app-composer-hello/tree/3286ef3e8ab3c23d34b276f87c42b008b2b18233) | `wrangler types --include-runtime=false --strict-vars=false --check`, then checked Worker/publisher and browser programs. Wrangler compiles the checked Worker directly; publisher/navigation distributions are compared. | Same semantic checks; Worker, publisher, navigation and named source gates/configs/package metadata. |
| Carry / forward | [`cbf197b`](https://github.com/loftwah/app-composer-state/tree/cbf197b50106f82576d9eef2366978090f121a3b) | Same binding-drift check and two source programs, including client/vault `.mts` authors and their readable public distributions. | Same semantic checks; Worker/publisher, navigation/client/vault and named deploy/test/gate/config files. Fictional-only data remains required. |

All six inspected packages declare Node `>=22 <23`, `pnpm@12.8.1`, a pnpm
lockfile, and `dev`, `check:types`, `lint`, `format:check`, `test`, `check`,
`build` and guarded `deploy`. Each `check` aggregates types, semantic lint,
scoped formatting and tests. None currently declares whole-repository ESLint.
The generated content-site recipe is independently installable and deliberately
retains pnpm 12.9.1; its own check includes Astro and its maintained source.

Composer development refuses stale source distributions before Astro. The five
app `dev` commands explicitly regenerate their source distributions first.
App builds run their type/parity gate before the existing credential-free
Wrangler dry run; Guestbook/Linkarooie use `run-worker.mjs` to select their
configuration. Builds, normal checks and the guarded deployment remain distinct.
The binding drift command is present in Hello/State; the three larger apps use
their declared Worker environment interfaces and pinned Workers types instead.

## This native bridge batch

`scripts/creator-source.mjs` names these eleven authors: `app-settings`,
`stacks`, `app-configuration`, `stack-activation`, `miniapp-admin`,
`miniapp-profile-settings-fields`, `miniapp-profile-settings`,
`miniapp-achievements`, `miniapp-tag-fields`, `miniapp-tags` and `stacks-admin`.
Their `.mjs` runtime paths and exports stay compatible. The compiler owns the
corresponding `.d.mts` files; no handwritten `Promise<any>` bridge declaration
remains. The eighteen-file format list includes those authors and their named
gates/boundary tests, not all native pages.

The strict Worker-compatible program checks the dependency graph and emits real
declarations in memory. Existing `.ts` runtime imports must retain their paths
for Astro and Node 22 fixtures. After zero diagnostics, the same pinned compiler
transforms the checked program's immutable source text into readable JavaScript;
all outputs are gathered before writes. This uses TypeScript's documented
[declaration emission and compiler transform APIs](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
with the documented [type-extension import option](https://www.typescriptlang.org/tsconfig/allowImportingTsExtensions.html).
Transformation alone is not the type gate. Tests inject errors and Node globals
into every author, assert that no distribution changed, and reject stale outputs.

`stack-resources.ts` imports its stack types from the pure domain, rather than a
native UI transport. This type-only dependency correction prevents EmDash's
Node declarations from admitting Node globals to the Worker program; it changes
no runtime import, SQL or resource authority. Existing publication validation,
actor/CAS writes and immutable snapshot data retain their separate tests.

External JSON starts as `unknown`. Build identities and mutation receipts are
bounded; current optional settings/item metadata are retained after checking the
fields consumed by the editor. The existing global Guestbook export can contain
historical deleted rows, so this batch introduces no new total-history limit;
the native view still filters deleted items and presents its existing newest
200 records. Private PNG base64 uses Worker globals, without Node `Buffer`.

## Explicit exceptions and remaining work

- Compiler-produced JS/declarations are distributions, not separately authored
  programs. Their owning parity gate checks their exact bytes. The five apps'
  committed `public/brand/launcher.js` copies are maintained from Composer's
  checked launcher author through the explicit shared-asset operation; those
  copies are outside the apps' source maps and normal format lists. A generated
  comment alone does not establish an app-local compiler check.
- Versioned `web-vitals-v6.2.3.mjs` is third-party Apache-2.0 output with retained
  notices, not first-party TypeScript. Shared `page-share.mjs`,
  `page-share-url.mjs` and `page-performance.mjs` remain maintained JavaScript;
  tests and explicit copy checks do not turn them into checked TS. Composer's
  small `theme-bootstrap.js`, State's `reader-theme.js`, Link Check's
  `public/navigation.js` and Showcase's `profile-share.js` are separate small
  authored bootstrap/compatibility exceptions, not inferred generated output.
- Composer's remaining authored domain `.mjs` files include `access-boundary`,
  `explorer-status`, `handoff-draft`, `hello-spec`, `indexing`,
  `init-recommendations`, `inspection-report`, `resend-delivery`, `spec`,
  `stack-theme` and `tutorial-progress`. `lib/get-ready`, its MCP server and
  `lib/usage` also remain JavaScript. Their behavioral/package checks do not
  establish compiler coverage. Convert them in separate bounded batches.
- Node packaging, release, source-generation and filesystem tools, package
  configuration and JavaScript test fixtures are deliberately not this runtime
  conversion. Existing source lists and tests remain explicit. Strict source
  programs can still contain older explicit `any`; enabling `strict` does not
  prove that every older boundary has been repaired.

These are precise remaining #175 gates, not a claim of six fully converted
repositories, complete onboarding or recovery. Actual app code updates retain
independent review, exact pins, build and release evidence in #11.
