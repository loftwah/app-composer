# Engineering baseline

Reviewed 25 October 2026 for #175 and #316. Node 22.23.4+ and pinned pnpm remain
the supported local tools; Cloudflare workerd runs deployed Workers. The Node
floor follows Astro 7.4, which refuses 22.23.1 and earlier. Composer and the
plain Worker references select pnpm 12.8.1. The independent content-site recipe
retains its own Astro 7.3.5, EmDash 1.2.0 and separately exercised pnpm 12.9.1
lockfile.

Node 24.22.1 LTS was qualified against the same gates on 2026/10/25: a fresh
frozen-lockfile install, type/Astro check with no errors, and an identical
production build (1243 files, 150 archive members) all pass. It is still not
declared. The full suite fails seven Get Ready site-skill tests and skips ten
owned-tool and temporary-storage tests, because `lib/get-ready` deliberately
refuses a runtime other than Node 22 for the operations that install and run
pinned third-party binaries. The declared range therefore stays on the Node 22
line, and `tests/node-runtime.test.mjs` keeps the five `engines.node`
declarations and the policy on that one reviewed major. Exact commands, versions
and the conditions for moving are in [the Node runtime decision](node-runtime.md).

A local package-manager change would need its own install/check/build/package
comparison; no Bun comparison was performed.

## Checked source and independent distributions

The content model, calendar rules and generated-site application helpers are
maintained as readable `.mts` TypeScript. Their `.mjs` runtime distributions and
`.d.mts` declarations come from the same strict TypeScript 6.0.3 program. Run
`pnpm source:write` after editing them, then `pnpm check`. Normal checks reject
stale emitted bytes and do not rewrite them. Composer's model/recipe gate is
`scripts/content-source.mjs`; a generated project owns its copy of
`scripts/build-source.mjs` and its source/configuration/dependency boundary.

The reviewed app-setting model, saved-stack store, activation planner and
app-owned configuration transport are maintained in `src/lib/{app-settings,
stacks,stack-activation,app-configuration}.mts`. The closed Creator source gate
uses strict Worker-compatible globals and the pinned D1 types. Its same-path
JavaScript and declarations come from that actual implementation; normal dev,
type and build commands reject stale bytes. Incoming documents, stored JSON and
remote acknowledgments remain unknown until runtime validation. Immutable
Guestbook resource references survive publication reads; corrupt snapshots never
fall back to the private draft. A publication validator returns the original
validated JSON object, retaining legacy optional fields, ordering and social-image
identity. Only an editable draft copy receives normalized defaults. SQL transactions, actor predicates, revision
checks and exact publication bytes retain their existing release boundary.

The Node operator still imports `scripts/app-configuration.mjs`: its existing
validated specification planner remains a small JavaScript tooling exception,
and it re-exports the checked Worker-safe transport. No Worker imports Node-only
operator code. The compiler fixture checks every Creator author, rejects Node
globals and proves that errors cannot replace any distribution. Real SQLite and
transport negatives cover prototype-key selectors, corrupt persisted data,
source/target validation, partial outcomes and malformed/lost acknowledgments.
Every actual operator/activation write checks both standalone and mounted source
identities after awaited credentials and workspace guards, then rechecks workspace
authority after those HTTP waits. The validated plan is frozen against guard
mutation. Sequential checks remain snapshots, not an atomic remote source/CAS
guarantee. A lost acknowledgement leaves an app write unconfirmed; no automatic
retry or rollback is performed. This transport is separate from native resource
apply and is never implicitly called by Publish.

Root `pnpm check` now runs types/parity, scoped semantic `pnpm lint`, scoped
`pnpm format:check` and behavior tests. Lint covers the maintained content and
Creator source programs with unused-local/parameter checks. Formatting uses
pinned Prettier 3.9.10 on the maintained Creator and enquiry files named in
`scripts/creator-format.mjs`; generated output retains compiler formatting.
Run `pnpm format` then `pnpm source:write` after Creator edits. This is not a
whole-repository ESLint or formatting claim, and normal checks never rewrite
source or emitted bytes.

Generated projects validate imported model JSON before typed presentation. They
carry their own source, emitted files, compiler configuration, native editor,
behavior tests and lockfile. The project-file allowlist and provenance capture
all of these files; no runtime import reaches back into Composer or Woodhouse.

Generated projects separate strict Worker globals (`tsconfig.worker.json`),
browser/React globals (`tsconfig.browser.json`), shared application emission
(`tsconfig.source.json`) and Astro checking (`tsconfig.json`). `astro build`
is preceded by the explicit checker. Types, distribution parity, semantic
unused-local/parameter lint, pinned Prettier 3.9.10 with Astro support and Node
behavior tests form `pnpm check`. This scoped semantic lint is not an ESLint
claim. Formatting covers maintained application/configuration/check sources;
generated JS/declarations are excluded because their compiler owns formatting.

Hello `07ba881` and Carry / forward `6ac4732` use their independently committed
strict Worker/browser emission scripts. Get Ready now runs the exact tracked
`build-source.mjs --check` from its frozen reviewed snapshot with the stripped
test environment before Wrangler. Any checker failure or tracked-file mutation
refuses the operation. A selected reference owns its compiler dependencies;
installing the packed Get Ready core requires no compiler or Composer runtime.
Explicit tool preparation verifies that reference's exact reviewed TypeScript
pin is present locally when the tracked checker exists. An incomplete owner
installation is preserved and refused; ordinary checks do not install or retry.

The native mini-app/profile/tag/achievement and stack administration bridges now
join this closed Creator program. [Exact runtime and command coverage](runtime-source-coverage.md)
records all eleven authors, their declaration/emission boundary, the six
inspected repository heads and the remaining JavaScript/tooling exceptions.

## Explicit scope and remaining work

Small Node packaging/generation/release tools remain JavaScript, covered by
boundary and package tests. Third-party assets keep their licences. Generated
runtime JavaScript and declarations are checked against authored TypeScript.
The existing Get Ready implementation and other legacy Composer JavaScript have
not all been converted to TypeScript; that remains #175 work. This batch does
not establish the complete six-repository lint/format/type baseline.

The content-site `deploy` command continues to refuse its local placeholder
configuration. Checking/building a generated project does not establish customer
authentication, resources, deployment, editing acceptance or recovery. Existing
projects are never updated by regenerating a recipe. Actual release identities
and live acceptance belong in #11 and the owning issue.

Focused development checks:

```sh
node scripts/content-source.mjs --check
pnpm lint
pnpm format:check
node scripts/creator-source.mjs --check
node --test tests/creator-source.test.mjs tests/creator-boundaries.test.mjs tests/stacks-database.test.mjs tests/stacks-instances.test.mjs tests/app-settings.test.mjs
node --test tests/content-model.test.mjs tests/content-project.test.mjs tests/content-calendar.test.mjs tests/content-entry.test.mjs tests/content-filter.test.mjs
node --test tests/readiness-owned-deploy.test.mjs tests/readiness-maintained-release.test.mjs tests/readiness-package.test.mjs
```

## Dev server React islands

Reviewed 2026/10/25. An earlier Astro 7.4.2 observation reported `Invalid hook
call` on `/effect`. It does not reproduce on the current toolchain (Node 22.23.4,
Astro 7.4.2, React 19.3.1, `@astrojs/react` 7.1.1). Headless Chromium loaded
`/effect`, `/ready`, `/me`, `/people` and `/demo` with no page errors and no React
hook warnings; the `/effect` island hydrated, accepted a click on "Run check" and
moved its live status from "Ready to run the recorded check." to
"Step 1 of 5: Request validated." No speculative change was made.

Reproduce with the built-in launcher and a headless browser:

```sh
pnpm dev                     # prints the 127.0.0.1:4321 address, then `pnpm exec astro dev stop`
```

A single `Invalid hook call` can still indicate two React copies in a consumer's
dependency tree. Nothing in this check proves otherwise for a composed or mounted
app; it establishes the standalone dev server only.
