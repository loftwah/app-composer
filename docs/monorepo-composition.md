# Mini-apps inside a host repository

App Composer supports two source layouts for a mini-app:

- **Separate repository (default, unchanged).** A mini-app has its own repository,
  lockfile, tests and release. Composition pins an exact commit of that
  repository.
- **Same repository (opt-in).** A mini-app lives in a subdirectory of a host
  repository. Composition pins the host repository, an exact commit and the
  relative path that carries `app.manifest.json`.

A composition may mix both. Sharing a repository never implies a shared Worker,
database, bucket, secret or deploy. Each mini-app keeps its own manifest,
logical identity, routes, data ownership and release.

This page documents the authoring and validation slice that exists in the
repository today. It does not claim that an in-repo app can be promoted through
`pnpm compose:promote`: that guarded path still accepts only the reviewed
Guestbook/Showcase pair, so the route, configuration, action and rollback
acceptance in
[#408](https://github.com/loftwah/app-composer/issues/408) stays open.

## Source plan

A plan is committed data, never executable instructions:

```json
{
  "contract": 1,
  "reviewed": "2026-11-07",
  "sources": [
    {
      "id": "guestbook",
      "repository": "https://github.com/example/product",
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "path": "apps/guestbook",
      "url": "https://guestbook.example.com"
    },
    {
      "id": "showcase",
      "repository": "https://github.com/example/showcase",
      "commit": "89abcdef0123456789abcdef0123456789abcdef",
      "path": ""
    }
  ]
}
```

- `repository` is an `https://github.com/owner/repo` origin with no credentials,
  query, fragment or trailing slash.
- `commit` is an exact 40-character lowercase SHA. Branch names are refused, so
  a plan cannot silently move.
- `path` is optional. The empty string means the repository root, which is what
  every existing pin already means.
- `url` is the app's own deployed origin. The production command refuses a
  composition where an app has no origin, because serving a mini-app without a
  deployed identity would hide the real release.

Validate a plan without writing anything:

```sh
pnpm compose:sources --file composition.sources.json
```

The command reads each manifest from GitHub through the authenticated `gh` CLI
at the exact commit, validates the manifest contract, rejects duplicate and
overlapping identities, rejects route collisions and prints a deterministic
plan with a content digest. It does not rewrite `composition.lock.json`, upload
a Worker, read a token or execute app source.

To validate a plan against a local clone before pushing (the origin must match
the plan):

```sh
pnpm compose:sources --local guestbook=../product --local showcase=../showcase
```

`--stage` writes the same plan to `.private/candidates/<digest>.json` with
`state: "staged"`. That is candidate evidence only; it is not a release.

The composition authoring command accepts the same locator:

```sh
pnpm compose \
  --source guestbook=example/product@0123456789abcdef0123456789abcdef01234567:apps/guestbook \
  --origin guestbook=https://guestbook.example.com
```

When every source is separate, `pnpm compose` behaves exactly as before.

## Path rules

`scripts/source-locator.mjs` normalises and validates every path before any read:

- relative only; no leading or trailing slash, no empty segment, no `.` or `..`
  segment, no backslash, colon, control character or space;
- each segment matches `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` and does not end with a
  dot;
- hidden segments and reserved device names (`con`, `nul`, `com1`, `lpt9`, …)
  are refused so a plan stays portable across macOS, Linux and Windows;
- at most 6 segments and 160 characters.

Two sources cannot name the same repository and path, and one source path cannot
contain another in the same repository. Both cases make ownership, provenance
and rollback ambiguous.

## Reading a pinned tree

- `git ls-tree` decides what exists at the commit. Ignored, untracked and
  working-tree files never become candidates.
- The manifest must be a regular blob (`100644` or `100755`). A symbolic link
  (`120000`) is refused, so a manifest cannot point outside its subdirectory.
- A path that does not exist at the commit fails closed; Git does not resolve a
  symlinked directory into another tree location.
- The manifest's `id` and `repository` must match the locator, and the existing
  composition contract still validates runtime, data version, routes,
  capabilities and per-app feature descriptors.

## Workspace discovery

`discoverWorkspaceApps` lists `app.manifest.json` files under a pinned commit:

```js
import {discoverWorkspaceApps} from './scripts/source-locator.mjs';
discoverWorkspaceApps({workspace: '../product', commit: '0123…', root: 'apps'});
```

- sorted, deduplicated and bounded to 32 candidates;
- `node_modules` is ignored;
- the host's own root manifest is not reported as a mini-app;
- an explicit `root` narrows the scan, and exceeding the bound fails with a
  request to declare explicit paths instead.

Discovery only proposes paths. A human or agent still reviews the manifests and
commits the plan.

## Trade-offs

Same repository:

- one pull request, review, lockfile and local checkout for the host and its
  mini-apps;
- atomic source changes across the host and a mini-app;
- shared tooling without a second repository.

Separate repository:

- independent release, rollback and ownership;
- a mini-app can be consumed by someone who does not own the host;
- a source review does not have to include unrelated host changes.

Both layouts still need a deployable identity per mini-app: its own Worker,
D1/R2/KV bindings and secrets. A monorepo changes where source lives, not what
runs.

## Browser verification needed after a source-layout change

The plan command is static. Any later deploy of an in-repo app still needs the
affected journey checked in a real browser, including the mounted route, at
390 px and 1440 px, in both themes where the app supports them.

## Evidence

- `tests/source-locator.test.mjs` — path normalisation, locator validation,
  duplicate and overlapping identities, real Git tree reading, symlink refusal,
  bounded discovery, mixed composition, plan validation, local and GitHub
  resolution, staging, and refusal to rewrite the lock.
- `docs/evidence/monorepo-source-locator-20261107/README.md` — this slice's
  source identity, checks and remaining gates.
