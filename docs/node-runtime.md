# Node runtime decision

Reviewed 2026/10/25 (Australia/Melbourne), 2026-10-24T23:10Z. Owner issue
[#316](https://github.com/loftwah/app-composer/issues/316).

The declared runtime stays on the Node 22 line: `>=22.23.4 <23`. Node 24 is
**build-qualified but refused by Get Ready**, so it is not declared. The rest of
this page is the evidence and the exact remaining work.

## What was tested

Both runtimes came from official `nodejs.org` release tarballs, unpacked into an
owned temporary root and checksum-verified against the published
`SHASUMS256.txt`:

| Runtime | Tarball SHA-256 |
| --- | --- |
| Node 22.23.4 (the declared floor) | `c9e1dbc748b33ed2d14f42445191ecaf14c56259c7a9a26d0042c49ec2b66428` |
| Node 24.22.1 LTS "Krypton", released 2026-10-20 | `89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7` |

pnpm 12.8.1 was installed into a separate prefix for each runtime so the
`packageManager` pin stayed exact and the owner's global Node was untouched.
Each probe used its own pnpm store, so the install was a fresh resolution from
the committed lockfile rather than a warm local cache.

## Result

| Gate | Node 22.23.4 | Node 24.22.1 LTS |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | pass | pass |
| `pnpm check:types` | 0 errors, 0 warnings, 56 hints (564 files) | 0 errors, 0 warnings, 56 hints (563 files at probe time) |
| `pnpm test` | 1017 tests, 1017 pass, 0 fail, 0 skipped | 1017 tests, 1000 pass, **7 fail**, **10 skipped** |
| `pnpm build` | 1243 files, 150 archive members | 1243 files, 150 archive members |
| `pnpm freshness` | 27 ok, 0 drift | 26 ok, **1 drift** (`node` outside the policy) |
| `pnpm test:ready` | 106 tests, 106 pass | 106 tests, 99 pass, **7 skipped** |

The build output is byte-for-byte the same shape on both runtimes: the same file
count and the same archive member count. Install, type checking and production
build are genuinely runtime-independent.

## Why Node 24 is not declared

Three guards in `lib/get-ready` deliberately refuse a runtime other than Node 22.
They are not accidental:

| Guard | Effect |
| --- | --- |
| `lib/get-ready/site-skills.mjs:59` | `prepareSiteSkills` fails with `configuration` unless `process.versions.node` starts with `22.` |
| `lib/get-ready/local.mjs:327` | `installReferenceTools` refuses a non-22 major |
| `lib/get-ready/workspace-tools.mjs:23` | workspace tool preparation refuses a non-22 major |

Those refusals are the reviewed support envelope for an operation that installs
and runs pinned third-party binaries, not a version string that went stale. On
Node 24 they produce:

- **7 failing tests**, all in `tests/readiness-site-skills.test.mjs`. Each one
  asserts a *successful* preparation, so the runtime refusal surfaces as an
  unexpected `Readiness check did not pass` (`code: 'configuration'`) from
  `site-skills.mjs:13`.
- **10 skipped tests**: four in `tests/readiness-owned-tools.test.mjs`, three in
  `tests/readiness-workspace-tools.test.mjs` and three in
  `tests/temporary-storage.test.mjs`, each gated on
  `process.versions.node.split('.')[0]==='22'` (or `startsWith('22.')`).

`pnpm freshness` reports one drift on Node 24 for the same honest reason: the
runtime in use is outside the reviewed range. That row is the intended signal,
not a defect to widen away.

`tests/readiness-site-skills.test.mjs` also keeps a negative test, "unsupported
declarations, missing inventory, inactive runtime and unknown fields refuse
before any writes". The refusal is specified behaviour, so weakening the seven
positive tests to make Node 24 look green would remove the coverage that
protects it.

## What would change the decision

Node 24 becomes declarable when all of the following are recorded, in one
reviewed change:

1. The three guards accept the new major, and the ten gated tests run instead of
   skipping.
2. `lib/get-ready/workspace-tools.mjs` tool preparation is exercised with its
   real reviewed archives (GitHub CLI 2.98.0 and pnpm 12.9.1 for macOS arm64) on
   the new runtime, not only with fixtures.
3. `lib/get-ready/local.mjs` reference-tool installation is exercised against the
   exact maintained Hello source on the new runtime.
4. `config/dependency-policy.json`, `package.json` and the three library
   manifests move together; `tests/node-runtime.test.mjs` enforces that they do.
5. This page and `docs/engineering-baseline.md` record the new evidence.

The fixtures alone cannot carry points 2 and 3. They substitute `gh` and `pnpm`
with local scripts, so a green fixture run proves the code path, not the real
binaries.

## Current support status

Node 22 is in Maintenance LTS until 2027/04/30, so the declared line is
supported today and nothing here is urgent. Node 24 is Active LTS and is the
eventual target; the qualification above is the starting evidence for that move.

## Reproducing the probe

The Composer suite reads two independent checkouts. Two platform tests compare
the selected Guestbook source against `composition.lock.json` and fail if the
sibling `../app-composer-guestbook` has drifted, even when every other test
passes:

```sh
COMPOSER_DEMO_GUESTBOOK=/absolute/clean/app-composer-guestbook \
COMPOSER_INCIDENT_GUESTBOOK=/absolute/clean/app-composer-guestbook \
pnpm test
```

Point both at a clean checkout of the pinned commit
(`5075d7be53b43aca288d3707fd06851aca91e8c2` at the time of writing) before
reading the result. With a drifted sibling checkout, tests 365 and 368 fail on
either Node runtime; that is an environment mismatch, not a runtime defect.

Then run the gates for the runtime under test:

```sh
pnpm install --frozen-lockfile
pnpm check:types && pnpm test && pnpm build
pnpm freshness
pnpm test:ready
```

A probe that only runs install, types and build will always pass on Node 24 and
will never reveal the refusal. `pnpm test` and `pnpm test:ready` are the gates
that decide this question.
