# Engineering baseline

Reviewed 18 October 2026 for #175. Node 22 and pinned pnpm remain the supported
local tools; Cloudflare workerd runs deployed Workers. Composer and the plain
Worker references select pnpm 12.8.1. The independent content-site recipe retains
its exercised pnpm 12.9.1 lockfile. A local package-manager change would need its
own install/check/build/package comparison; no Bun comparison was performed.

## Checked source and independent distributions

The content model, calendar rules and generated-site application helpers are
maintained as readable `.mts` TypeScript. Their `.mjs` runtime distributions and
`.d.mts` declarations come from the same strict TypeScript 6.0.3 program. Run
`pnpm source:write` after editing them, then `pnpm check`. Normal checks reject
stale emitted bytes and do not rewrite them. Composer's model/recipe gate is
`scripts/content-source.mjs`; a generated project owns its copy of
`scripts/build-source.mjs` and its source/configuration/dependency boundary.

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
node scripts/content-source.mjs --lint
node --test tests/content-model.test.mjs tests/content-project.test.mjs tests/content-calendar.test.mjs tests/content-entry.test.mjs tests/content-filter.test.mjs
node --test tests/readiness-owned-deploy.test.mjs tests/readiness-maintained-release.test.mjs tests/readiness-package.test.mjs
```
