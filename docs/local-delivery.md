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

## Choosing a delivery profile in Init

Init carries one user-facing delivery choice with the rest of the portable
specification:

- **On this machine or with my agent (default).** The owner or their agent runs
  the local commands below. No hosted CI, no GitHub Actions, no account.
- **My existing CI runner.** The same repository commands are invoked from an
  existing Jenkins, GitLab CI, Buildkite or other agent through
  `examples/local-delivery-runner.sh`. The selection records intent and the
  prompt names the runner; it does not prove that a runner is configured,
  reachable or successful. One real recorded run is still required.

Both profiles export the same five runnable commands, and the copy-to-agent
handoff repeats them with the preview caveats: a Version URL is not a sandbox, a
deployed preview needs its own preview D1/R2/KV bindings, production service
bindings, routes and cron triggers must be absent, and Queue producers/consumers
and Workflows are refused because their preview behaviour is not qualified.

The profile is configuration data. It grants no credential, starts no job and
does not change which commands the release guard actually runs.

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
  "runner": {
    "kind": "jenkins",
    "local": false,
    "runId": "http://localhost:8080/job/composer-delivery/1/",
    "runUrl": "http://localhost:8080/job/composer-delivery/1/",
    "source": "flag"
  },
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
  "artefact": {"path": "dist", "files": 1294, "bytes": 60087731, "digest": "sha256:<build digest>"},
  "candidate": null,
  "release": {"attempted": true, "performed": true, "command": "pnpm deploy", "commit": "<SHA>"},
  "verification": {"performed": true, "independent": true, "origin": "https://composer.loftwah.com"},
  "approval": {
    "mode": "explicit-flag",
    "flag": "--release",
    "sourceCommit": "<SHA>",
    "candidateDigest": "sha256:<candidate config digest>",
    "binding": {
      "receiptDigest": "sha256:<digest of the candidate receipt file>",
      "sourceCommit": "<SHA>",
      "candidateDigest": "sha256:<candidate config digest>",
      "artefactDigest": "sha256:<candidate build digest>",
      "target": {"worker": "app-composer", "account": "<account ID>", "environment": "production", "origin": "https://composer.loftwah.com", "composition": "<lock digest>"},
      "preview": {"worker": "app-composer-preview", "origin": "https://preview.example"}
    }
  },
  "credentials": {"recorded": false, "required": true, "source": "operator-environment", "note": "..."},
  "nextAction": "Record this receipt in #11 ..."
}
```

The receipt contains no tokens, private keys or command output. It records the exact source commit, target account, Worker, environment, origin, composition pins, runner identity, build-artefact digest and step outcomes. A refusal or failure still produces a receipt with a bounded `error.code` and `error.message`.

### Runner identity

`--runner`, `--run-id` and `--run-url` record which runner actually executed the
journey. When they are omitted, a known CI environment is detected
(`JENKINS_URL`/`BUILD_NUMBER`, `GITLAB_CI`, `BUILDKITE`, `TF_BUILD`,
`CIRCLECI`, `CODEBUILD_BUILD_ID`) and the run is otherwise `local`. A recorded
runner is evidence of provenance only: it grants no approval and does not
change which steps run. `--run-url` is stored, never fetched.

### Artefact identity

`artefact` is a deterministic SHA-256 over the sorted `dist/` file list and
each file's own digest, with the file count and byte size. A candidate records
the same object under `candidate.artefact`. Symlinks are refused so a digest
can never cover a file outside the workspace. Changing any built file changes
the digest; rebuilding the same source with the same inputs reproduces it.

## Delivery runs in EmDash

The owner-only **Delivery runs** admin page (`/delivery`) records a bounded
receipt from the local journey or an existing runner and lists the newest 20.
For a release receipt it re-reads the live `/build.json` in the owner's browser
and reports whether the live commit matches the recorded release. A recorded
receipt is never approval, and the page never deploys or changes a target.

Paste the receipt JSON or open the file the journey wrote:

```sh
node scripts/delivery-journey.mjs --candidate --receipt output/delivery/candidate.json
```

The page is not public and is not linked from the public site.

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

### Binding a release to a candidate

`--release` may be given one passed candidate receipt:

```sh
node scripts/delivery-journey.mjs --candidate --receipt output/delivery/candidate.json
node scripts/delivery-journey.mjs --release --candidate-receipt output/delivery/candidate.json --receipt output/delivery/release.json
```

The candidate file is read as a bounded regular file, never executed and never fetched. Its schema, mode, passed state, built candidate, no-upload flag, source commit and complete target identity are validated. The release then requires the **same** source commit, Worker, account, environment, origin, composition lock and preview Worker/origin. Any difference refuses the release with a specific code (`candidate-commit-mismatch`, `candidate-target-mismatch`, `candidate-composition-mismatch`, `candidate-preview-mismatch`, `candidate-receipt-state`, …) before `pnpm deploy` runs. The receipt records the candidate receipt digest and the exact bound facts under `approval.binding`.

A release without `--candidate-receipt` still runs under the explicit `--release` flag, but its receipt states `approval.binding: null`. It makes no claim that a candidate was reviewed, and a candidate from another commit or target can never be presented as its approval.

### Credentials and external runners

The release step needs an authorised Cloudflare session or scoped API token in the environment where `pnpm deploy` actually runs. The journey never reads, prints, stores or forwards that credential; it records only `credentials: {recorded: false, required: true, source: "operator-environment"}`.

The local Jenkins fixture runs **candidates only**. It does not inject `CLOUDFLARE_API_TOKEN`, account credentials or `.env` into the container, and this repository does not provision a credential for it. A release from an existing external runner is an owner decision: the owner configures a scoped credential in that runner's own secret store, restricts who can trigger the job, and accepts that the journey will still require clean pushed `main`, the guarded deploy and an independent live read. Nothing in this repository puts a Cloudflare token into the Jenkins container.

## Optional external runner

[`examples/local-delivery-runner.sh`](../examples/local-delivery-runner.sh) is a plain one-shot POSIX shell wrapper. It runs one journey, writes `output/delivery/<mode>.json`, and exits with the journey status. It starts no daemon and creates no schedule.

```sh
examples/local-delivery-runner.sh --local
examples/local-delivery-runner.sh --candidate
examples/local-delivery-runner.sh --release
examples/local-delivery-runner.sh --verify
```

The authoritative gate is the `--release` flag inside the journey. An existing Jenkins, GitLab, Buildkite, Azure DevOps, CircleCI or CodeBuild job may call the wrapper instead of reimplementing the commands. That integration is optional and user-owned. Composer does not provision it, and none of these providers is required.

### Qualified local Jenkins fixture

Jenkins is the one external runner exercised against a real job, on the
operator's machine, with no hosted CI:

- [`examples/jenkins/Dockerfile`](../examples/jenkins/Dockerfile) builds a
  disposable Jenkins LTS image with Node 22 and the pinned pnpm. Nothing is
  published and no service is left running.
- [`examples/jenkins/Jenkinsfile`](../examples/jenkins/Jenkinsfile) checks out
  the repository, installs the pinned dependencies and runs
  `examples/local-delivery-runner.sh --candidate --runner jenkins --run-id
  "$BUILD_URL" --run-url "$BUILD_URL"`.
- `pnpm delivery:jenkins` (`scripts/jenkins-fixture.mjs`) starts one container
  against a temporary clone, triggers the job, and compares the Jenkins build
  URL/number with `runner.runId`, the clone commit with `source.commit`, the
  candidate configuration digest and build-artefact digest, the recorded
  check/build steps, and the no-upload flags. It writes bounded evidence under
  `output/evidence/` and removes the container, `JENKINS_HOME`, the clone and
  its temporary root afterwards.

The fixture proves the candidate contract only. It does not approve or perform a
release: a Jenkins run with `--release` would still need clean pushed `main`, the
guarded deploy, an independent live read and a credential the owner deliberately
supplies through that runner's own secret store. The fixture never receives one.

GitLab, Buildkite, Azure Pipelines, CircleCI and CodeBuild stay templates until
one is exercised the same way; the repository ships no generator for them.

The same commands are importable for an agent through `runDeliveryJourney()` in `scripts/delivery-journey.mjs`; the CLI is the supported human interface.
