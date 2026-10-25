# Node runtime decision

Reviewed 25 October 2026 for [#316](https://github.com/loftwah/app-composer/issues/316) / #321.

Composer supports `>=22.23.4 <23 || >=24.22.1 <25`. The default `.node-version`
remains 22.23.4, so this adds an explicitly selected Node 24 path without changing
an existing operator's selected runtime. Odd majors, Node 26, older patch floors
and prerelease/custom version strings remain outside the exercised local
execution contract. Independent mini-app policies remain separately owned.

Node 24.22.1 is an [official LTS security release](https://nodejs.org/en/blog/release/v24.22.1).
The prior [decision at source 473b8b9](https://github.com/loftwah/app-composer/blob/473b8b9354f511bc38b8b5570af3d2d76c79d617/docs/node-runtime.md)
correctly kept 24 undeclared while the actual setup operations were unqualified.
Seven policy refusals were not seven independent package incompatibilities.

## Real failures found and fixed

1. Node 22 allowed `cpSync(source, existingEmptyDirectory, {recursive:true,
   force:false,errorOnExist:true})`; Node 24.22.1 throws `ERR_FS_CP_EEXIST`.
   The actual pinned workspace-tool download reproduced this at `candidate/bin`.
   A minimal identical operation passed on 22.23.4 and failed on 24.22.1. The
   repair retains exclusive destination reservation and copies each absent
   child with the same no-overwrite flags. It also covers adopted owned-project
   `node_modules`; relative package symlinks and owner-file refusal are tested.
2. Maintained Hello `db0a98c` pinned Wrangler 4.143.1, while Composer's actual
   verifier requires 4.152.0. Its real reference-tool installation therefore
   failed after installing on either runtime. Hello's independently reviewed
   [PR #26](https://github.com/loftwah/app-composer-hello/pull/26) aligns the pair,
   patches the newly resolved Undici path, regenerates declarations and fixes
   the existing missing development build identity. It shipped as
   `47d5d8cfc8961f029c9a663dc22dd194345187c1`, Worker
   `0bcbcbc0-48f2-469f-b609-7d4d38bc8b37`. Its Node 22 support policy is unchanged.

## Qualification

The installed mise runtimes 22.23.4 and 24.22.1 were reused; no runtime or global
package manager was installed. pnpm remains 12.8.1 for Composer.

The real-operation probe used one owned temporary root and a qualification-only
copy of the guard before any source engine declaration was changed:

- On Node 24.22.1, actual fixed/hash-checked GitHub CLI 2.98.0 and pnpm 12.9.1
  archives install into the isolated workspace; a repeat verifies the same tree
  without a download.
- Actual GitHub main was re-read and Hello cloned at exact `47d5d8c`. The real
  `createLocalAdapter().installReferenceTools()` installs its frozen dependencies
  and returns Wrangler 4.152.0 / selected pnpm 12.8.1; repeat reports `changed:
  false`. Hello's complete types/lint/format/26-test check passes on Node 24.
- The separate Hello slice passes checks/build and actual workerd startup on
  both runtimes. `/`, `/build.json` and `/healthz` return 200 and retain the
  configured title. Development identity is labelled `development`; the
  deployed guard independently verified the exact Git source.
- All 31 affected site-skill, owned-tool, workspace-tool, reserved-copy and
  temporary-cleanup tests pass on both Node lines, with zero skips. This includes
  the ten previously gated cases; negative credential stripping, inactive
  runtime, source mutation, partial owner tools and cleanup checks remain.
- Required composition/readiness checks plus runtime-policy checks pass on both
  lines. Manifests, dependency policy and the MCP archive identity guard move
  together. The shared runtime predicate preserves refusal for unsupported
  versions rather than replacing a guard with a permissive major check.

Both complete `pnpm check` runs pass: 1,171 tests, zero failures/skips, and
635 files with zero type/Astro errors or warnings. Both production builds pass
the publication guard with 1,268 files / 150 archive members. The Node 24 frozen
lockfile install succeeds and freshness reports no drift on either runtime.
Actual Composer dev startup on each line serves the homepage and `/guide`; the
guide derives EmDash 1.3.1 / Astro 7.4.2 from the maintained package manifest.
Each local server is stopped after its probe. Bounded
command logs and raw receipts for this run are kept under ignored
`output/node24-20261025/`; the integrated release source and live Worker receipt
belong once in #11. Source passes do not establish a customer account, Access
session, hosted MCP, physical device or provider interoperability.

## Reproduce

Use existing runtimes, exact lockfiles and the maintained commands:

```sh
pnpm check
pnpm build
mise exec node@24.22.1 -- pnpm check
mise exec node@24.22.1 -- pnpm build
```

`mise` is optional: selecting the same installed Node executable in PATH is
equivalent. The suite's two independent Guestbook consumers must point at the
clean commit in `composition.lock.json`, currently
`5075d7be53b43aca288d3707fd06851aca91e8c2`, not a drifted owner's checkout:

```sh
COMPOSER_DEMO_GUESTBOOK=/absolute/clean/pinned/guestbook \
COMPOSER_INCIDENT_GUESTBOOK=/absolute/clean/pinned/guestbook pnpm check
```

Real tool setup remains explicit and scoped. It does not authenticate, deploy,
change an IdP or create a provider resource. The real-operation probe strips
service credentials from dependency installation; its temporary homes, archives,
source checkout and node_modules are removed on success/failure. Existing owner
checkouts and global runtime selection are preserved. The generated content-site
EmDash 1.2.0 pin remains its own migration gate; Node support is not an implicit
CMS upgrade.
