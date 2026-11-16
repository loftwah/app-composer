# Pinned Media Studio build replay — 16 November 2026

This record closes one specific gap in the Media Studio blueprint: the pinned
source had been fetched and inspected, and a fresh installation had been
deployed, migrated and restored from a *different* revision, but nobody had
rebuilt the **exact pin** from a clean checkout. That build now has a receipt.

It is a build replay, not a deploy, not a provider run and not an independent
owner. Those boundaries are stated below.

## The pin and where it lives

| Field | Value |
| --- | --- |
| Repository | `https://github.com/loftwah/composer-media-studio` |
| Commit | `e8b3778cd5d800378f42985afda80820fcb7ef57` (short `e8b3778`) |
| Commit date | 2026-11-16T00:44:14+11:00 |
| Commit subject | Add the Studio Director, a working Apps dialog and reproducible browser evidence (#15, #148, #151) |
| Manifest digest carried with the pin | `sha256:f71eb2c5b84dc73127fb064b70936b321fc1bd6e2c536c9e1f038b371369a37b` |

The active pin is `source.commit` in
[`config/media-studio-standalone.json`](../../../config/media-studio-standalone.json).
It is not copied into the catalogue. `src/lib/blueprints.mjs` imports that file,
spreads `mediaStudio.source` into `standaloneApps["media-studio"]`, and
`blueprintSources()` returns it for the blueprint. The pin was read and left
unchanged by this replay.

## Isolated checkout

The studio was cloned from GitHub into this run's owned temporary root inside
the Composer worktree, not from any existing local checkout:

```sh
mkdir -p output/pin-replay
git clone --quiet https://github.com/loftwah/composer-media-studio output/pin-replay/studio
cd output/pin-replay/studio
git checkout --quiet --detach e8b3778cd5d800378f42985afda80820fcb7ef57
```

- Clone path: `output/pin-replay/studio` under the Composer worktree
  `/private/var/folders/qm/ltm8shgs7tv9k8qfqgfpjxq80000gn/T/opencode/train-20261116b/wt/composer-replay`
- `origin` in the clone: `https://github.com/loftwah/composer-media-studio`
- `.git/objects/info/alternates`: **none**. The clone object store was not
  borrowed from the existing local checkout.
- `git rev-parse HEAD` immediately after checkout and again after the build:
  `e8b3778cd5d800378f42985afda80820fcb7ef57` both times.
- Tracked working tree clean (`git status --porcelain` empty) before and after
  each command. `pnpm-lock.yaml` sha256:
  `20a69c7191979c0ce2f59d55bf7d450472f7e3245beb6b4d098a549936378ef6`.

## Environment

| Item | Value |
| --- | --- |
| OS | macOS (arm64), `darwin` |
| Node | `v26.13.1` — inside the pin's `>=26.13.1 <27` range |
| pnpm | `12.19.0` — matches the pin's `packageManager` |
| `package.json` scripts used | `check`, `build:frontend` |

## Commands and results

All commands ran in `output/pin-replay/studio` at the pinned commit. Every exit
code was `0`; no command installed extra tooling, used a credential or made a
provider call.

| # | Command | Result | Measured duration |
| --- | --- | --- | --- |
| 1 | `pnpm install --frozen-lockfile --store-dir ../store` | Lockfile current, resolution skipped; dependencies linked from a fresh isolated store (1.0 GB downloaded into the owned root) | 13.8 s |
| 2 | `pnpm check` (`tsc --noEmit` + `launcher-assets.mjs --check` + `node --test tests/*.test.mjs`) | `Checked launcher output matches.`; **329 tests, 329 pass, 0 fail, 0 skipped** (test suite 3705 ms) | 7 s total |
| 3 | `pnpm build:frontend` (`tsc --noEmit` + `vite build`) | Vite 8.3.8: **148 modules transformed**, `✓ built in 134ms` | 4 s total |

Notes on method:

- A first `pnpm install --frozen-lockfile` reused the machine's shared pnpm
  store and finished in 901 ms. To make the receipt meaningful, `node_modules`
  was removed and the install was repeated with `--store-dir ../store` inside
  the owned root, forcing a real download of the locked tree. The cold result is
  the one recorded above; the warm run only shows the lockfile was already
  valid.
- `pnpm check` covers the TypeScript check, the launcher asset check and the
  repository's own test suite. `build:frontend` is the declared production
  frontend build.
- Identity was re-checked after install, after `pnpm check` and after the build:
  HEAD stayed `e8b3778cd5d800378f42985afda80820fcb7ef57` and the tracked tree
  stayed clean. The build writes ignored output only.

## Live studio identity (later source, not rebuilt here)

Read-only requests at `2026-11-16T07:36:52Z`:

```json
// https://media.loftwah.com/build.json
{"revision":"69e120e66b9a4a0d8d408675307a0b60f51a8007","builtAt":"2026-11-16T07:30:11.924Z"}

// https://media.loftwah.com/healthz
{"ok":true,"revision":"69e120e66b9a4a0d8d408675307a0b60f51a8007","bridge":true,"builtAt":"2026-11-16T07:30:11.924Z","time":"2026-11-16T07:36:53.319Z"}
```

The live Studio is deliberately **later** than the blueprint pin. The later
changes were released through the Studio's own guarded clean-pushed-main deploy
path in its own repository. This replay did not deploy, did not touch that
repository and did not reproduce that release. The pin and the live revision
are different values on purpose; neither is rewritten here.

## What this proves

- The exact pinned commit is fetchable from the public repository and its
  identity can be checked independently of any local working copy.
- `pnpm install --frozen-lockfile` resolves the pinned lockfile on the Node and
  pnpm versions the repository declares, from a cold package store.
- At that commit, the repository's own `tsc --noEmit`, launcher asset check and
  full test suite pass: 329 of 329, no skips.
- The declared production frontend build succeeds (148 modules, Vite 8.3.8).
- Nothing in the run required a credential, a Cloudflare account, a provider
  request or spending.

## What this does not prove

- **No provider-funded generation.** No Workers AI or fal.ai call was made, no
  job was dispatched, no media was produced, no allowance was reserved or spent.
- **No independent owner.** This ran on the owner's machine under the owner's
  toolchain in a temporary directory. It is not a second person or a second
  Cloudflare account replaying the recipe.
- **No storage, migration, deploy or restore at the pin.** No D1 database, R2
  bucket, Durable Object, secret or Worker was created or changed. The earlier
  fresh-install deploy/restore was a different revision and is recorded
  separately.
- **No live provenance claim for `69e120e`.** The live identity above is only a
  read of `/build.json` and `/healthz`; this record does not attest how that
  release was produced beyond the repository's stated guarded path.
- **No byte-identical artifact guarantee.** One run on one OS and one
  architecture. It shows the pinned source builds, not that every machine
  produces identical bytes.
- **No human journey at the pin.** No browser session, owner sign-in, upload,
  publish or phone check was performed against this build.

## Cleanup

- `rm -rf output/pin-replay/studio output/pin-replay/store` removed the clone,
  its `node_modules` and the isolated package store. Both paths were confirmed
  absent afterwards; no studio clone remains in the worktree.
- The raw command logs (`install.log`, `install-cold.log`, `check.log`,
  `build.log`) stay in the gitignored `output/pin-replay/` for this run only.
  They are not committed and contain no secrets.
- No Cloudflare resource, provider job, credential or deployment was created,
  changed or charged by this replay.

## References

- App Composer [#600](https://github.com/loftwah/app-composer/issues/600) —
  pinned-build replay with honest boundaries.
- [#457](https://github.com/loftwah/app-composer/issues/457),
  [#425](https://github.com/loftwah/app-composer/issues/425) — blueprint and
  flagship proof tracking.
- [`docs/portfolio/blueprints.md`](../../portfolio/blueprints.md#media-studio) —
  the runnable recipe. Its own replay status still says *not replayed*: an
  independent owner has not run the storage, deploy and provider steps.
