# Local delivery journey

This page describes the local-first release path for App Composer. It is one executable journey, not a hosted CI product and not a second deployment engine:

```
focused checks → optional preview candidate and review → authorised release → independently verified result
```

Composer does not use GitHub Actions. A human operator or a local agent can run the same commands. A team may call the outer shell example from its existing runner, but Composer does not install, configure or require one.

## Prerequisites

- Node 22 and the declared pnpm version.
- Pinned dependencies: `pnpm install --frozen-lockfile`.
- Git with `origin` configured. Candidate and release steps require the exact commit to be present at `origin/<branch>`; release requires clean pushed `main`.
- An authorised Cloudflare session only when the release step actually runs. Local checks and candidate builds do not upload anything.

## Commands

Run from the repository root:

```sh
# Default: read-only identity inspection and the required local checks.
node scripts/delivery-journey.mjs

# Machine-readable receipt, plus an optional saved receipt.
node scripts/delivery-journey.mjs --json --receipt output/delivery/local.json

# Local preview candidate: checks, CLOUDFLARE_ENV=preview build and binding inspection.
node scripts/delivery-journey.mjs --candidate --receipt output/delivery/candidate.json

# Explicit authorised release of clean pushed main. This is the only mode that uploads.
node scripts/delivery-journey.mjs --release --receipt output/delivery/release.json

# Independent live check of the current clean pushed main.
node scripts/delivery-journey.mjs --verify --receipt output/delivery/verify.json
```

`--local` is the default and is explicit if a caller wants it. Select only one mode. `--receipt PATH` writes the receipt after printing it; `output/` is ignored by Git.

## What each step does

| Step | Command | Boundary |
| --- | --- | --- |
| Local checks | `pnpm check` | Existing required gates. No upload and no production claim. |
| Focused iteration | `pnpm check:fast -- tests/<area>.test.mjs` | Same type/source, lint and format gates plus only the named tests. Not a release gate. |
| Preview candidate | `pnpm check`, then `CLOUDFLARE_ENV=preview pnpm build` | Build-time environment selection. No upload. |
| Review | read the printed or saved receipt | The candidate digest, source commit, target, bindings and next action are explicit. |
| Authorised release | `pnpm deploy` | Runs the dependency audit, full `pnpm check` and production build before remote migrations and upload. Explicit `--release` only. |
| Independent result | `scripts/verify-live.mjs` | Re-reads `/build.json` and every mounted `/APP/build.json` after release, or on its own via `--verify`. |

The candidate is a separate stage for preview work; release does not rebuild it or claim its evidence. Run the candidate and relevant isolated integration or browser checks when the change needs them, including changes to preview bindings or behaviour; a local candidate alone does not establish those checks. `pnpm deploy` rechecks clean pushed `main`, runs the dependency audit, full check and production build, validates the generated target and packages, and rechecks remote main before migrations and upload. A preview artefact is never uploaded by the production command.

### Measured local cost

On a 14-core macOS host with Node 22.23.4 and a warm pnpm store, 25 October 2026: `pnpm check` 103.8s (types/generated source 16.8s, lint 2.2s, format 0.7s, tests 84.3s); `pnpm build` 12.2s; `CLOUDFLARE_ENV=preview pnpm build` 12.0s; `pnpm dev` 8.5s to a ready server; the first uncached page in a browser 6.3s; `pnpm check:fast -- tests/page-share.test.mjs tests/public-ui-assets.test.mjs` 21.9s. These historical measurements predate the separated preview stage; release runs one `pnpm check` and one production build, and `pnpm deploy` prints each gate with its duration.

## Preview isolation

A Version URL is not a sandbox. It can serve code that still reaches production bindings. This journey therefore treats the **local candidate build** as the safe preview step and refuses a candidate whose generated Worker does not prove isolation.

The checker requires all of the following in `wrangler.jsonc` and in the generated `dist/server/wrangler.json`:

- the preview Worker name is not the production Worker name;
- `PUBLIC_ORIGIN` is distinct from production;
- D1, R2 and KV bindings each point at a distinct preview resource, never a production ID or bucket;
- no app service bindings, routes or cron triggers;
- no Queue producer/consumer or Workflow binding, in either the authored preview or generated candidate; these background paths have no qualified isolation in this journey;
- the generated Worker name matches `env.preview`, which proves `CLOUDFLARE_ENV=preview` was selected at build time rather than only at deploy time.

The candidate receipt records the generated configuration digest and `uploaded: false`. It leaves `dist/` containing the preview build; the release step rebuilds production before upload.

Wrangler may warn that top-level service or rate-limit bindings are not inherited by `env.preview`. That warning is expected here: isolation means the preview must not receive those production bindings, and the checker refuses any preview service binding.

A separately deployed preview is still an operator decision. If one is created, it must use the preview D1/R2/KV above and must have no production service bindings. It is not implied by this local candidate and is not claimed as verified here.

## Receipt

Every mode emits the same bounded schema. A successful release looks like this in shape:

```json
{
  "schema": "app-composer.delivery-receipt/1",
  "mode": "release",
  "state": "passed",
  "source": {
    "repository": "loftwah/app-composer",
    "branch": "main",
    "commit": "<40-character SHA>",
    "originCommit": "<40-character SHA>",
    "dirty": false,
    "pushed": true,
    "releaseEligible": true
  },
  "target": {
    "worker": "app-composer",
    "account": "<account ID>",
    "environment": "production",
    "origin": "https://composer.loftwah.com",
    "composition": {"id": "<lock digest>", "apps": [{"id": "guestbook", "commit": "<SHA>"}]},
    "preview": {"worker": "app-composer-preview", "isolated": true, "services": 0}
  },
  "steps": ["local checks or delegated release steps with durations"],
  "candidate": null,
  "release": {"attempted": true, "performed": true, "command": "pnpm deploy", "commit": "<SHA>"},
  "verification": {"performed": true, "independent": true, "origin": "https://composer.loftwah.com"},
  "nextAction": "Record this receipt in #11 ..."
}
```

The receipt contains no tokens, private keys or command output. It records the exact source commit, target account, Worker, environment, origin, composition pins and step outcomes. A refusal or failure still produces a receipt with a bounded `error.code` and `error.message`.

## Actual local run

Recorded 24 October 2026 on `lane-h-delivery-20261024` at commit `4b2165d2532c2fcb16ecbda8a09089fa8f3c0d9a`, using the optional runner:

```sh
examples/local-delivery-runner.sh --candidate
```

The full check/build stream stays in the ignored `output/delivery/candidate-run.log`. Its journey summary was:

```text
App Composer delivery journey — candidate
Source: lane-h-delivery-20261024 @ 4b2165d2532c (pushed to origin/lane-h-delivery-20261024)
Target: app-composer · account 1003dc1d93af0ebea56b2f1252f89627 · production · https://composer.loftwah.com
Preview: app-composer-preview · D1/R2/KV distinct · 0 services · 0 routes
PASS Required local checks: pnpm check (179.5s)
PASS Safe preview candidate build: pnpm build (15.3s)
Candidate: app-composer-preview · sha256:89dd64455ea92cf5d2609101a3fb57d5e70bdc8cd9aa0392af386dcaa63259b5 · uploaded: no
State: passed
Receipt: output/delivery/candidate.json
Next: A candidate from a branch is not release approval. Merge the exact commit to clean pushed main before --release.
```

The actual `pnpm check` inside that run reported Astro/TypeScript `0 errors`, `0 warnings`, `54 hints` across 533 files; the scoped lint and 33-file format checks passed; `961` tests ran with `959` passing and `2` skipped. The preview build's publication guard inspected 1189 files and 125 archive members.

The release gate refused the same branch without running a command or uploading anything:

```sh
node scripts/delivery-journey.mjs --release --receipt output/delivery/release-refused.json
```

```text
State: refused
Reason: wrong-branch — Production release requires clean pushed main. Current branch is lane-h-delivery-20261024.
Next: No upload occurred. Fix the reported source or target problem, then rerun from clean pushed main.
```

No production release or live verification was performed from this branch. The draft PR links [#319](https://github.com/loftwah/app-composer/issues/319); #11 remains the canonical index for an actual authorised deployment receipt.

## Authorisation and failure

`--release` is the explicit approval. A receipt cannot authorise a release, and an old candidate cannot approve a changed commit. Release rechecks clean pushed `main` and delegates to `scripts/deploy.mjs`; use `--candidate` separately when preview evidence is needed. The deploy script then rechecks its own guards before upload.

- Dirty, detached, wrongly branched or unpushed source is refused before any release command runs.
- An ambient `CLOUDFLARE_ENV` is refused for release; preview selection belongs only to the candidate build.
- A failed build is reported as failed. Nothing is uploaded.
- A failed or ambiguous release is not retried automatically. Inspect the actual Worker version and live source first.
- The journey does not roll back, create cloud resources, approve content or replace owner authentication.
- Local checks and a local candidate do not prove production. Only the independent live result, recorded in #11, can support a release claim.

## Optional external runner

[`examples/local-delivery-runner.sh`](../examples/local-delivery-runner.sh) is a plain one-shot POSIX shell wrapper. It runs one journey, writes `output/delivery/<mode>.json`, and exits with the journey status. It starts no daemon and creates no schedule.

```sh
examples/local-delivery-runner.sh --local
examples/local-delivery-runner.sh --candidate
examples/local-delivery-runner.sh --release
examples/local-delivery-runner.sh --verify
```

The authoritative gate is the `--release` flag inside the journey. An existing Jenkins, GitLab, Buildkite, Azure DevOps, CircleCI or CodeBuild job may call the wrapper instead of reimplementing the commands. That integration is optional and user-owned. Composer does not provision it, and none of these providers is required.

The same commands are importable for an agent through `runDeliveryJourney()` in `scripts/delivery-journey.mjs`; the CLI is the supported human interface.
