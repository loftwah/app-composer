# External runner acceptance and the native delivery receipt surface — 8 November 2026

Batch 1 of the [continuation 25 plan](../../backlog-20261106.md#continuation-25--8-november-2026-three-batch-plan).
Issue: [#319](https://github.com/loftwah/app-composer/issues/319).

## Result

One real Jenkins LTS job ran the same repository delivery wrapper a person or an
agent runs, against a temporary clone of this repository, on the operator's own
machine. It produced the same run identity, source commit, artefact identity,
check result and receipt contract as a local run. The run was a **candidate**
only: nothing was uploaded to production.

| Fact | Value |
| --- | --- |
| Production source before the batch | `fbb0760c736d6286462fdd8512db2d3d25a26678` / Worker `64627453-eb84-421c-ae3c-e346ad7ff7b9` |
| Production source after the batch | `43ea8cf5468ab65faad8041b6b60c66ad1fddf71` / Worker `d9eab220-0f42-4922-9ca9-4ade773e185d` |
| Jenkins run source | `43ea8cf5468ab65faad8041b6b60c66ad1fddf71` (clean pushed `main`) |
| Jenkins | LTS 2.580.2, local container, job `composer-delivery` build #1, `SUCCESS` in 104s |
| Radius fixture image | `composer-jenkins-fixture:d14c9e7f17c0` (Jenkins LTS, Node 22.23.4, pnpm 12.8.1, Pipeline + Git plugins, python3) |
| Receipt schema | `app-composer.delivery-receipt/1` |
| Receipt runner | `jenkins`, run id `http://localhost:51496/job/composer-delivery/1/` |
| Candidate artefact | `sha256:817597283a682565ed843036d4a7959e2b847d6331219d45efda38c383de026a` (generated preview config) |
| Build artefact | `sha256:6d9184af12e7339bdf9b447db29bd6368e695822b7ea6d2d766ec68c8700be84`, 1294 files |
| Checks inside Jenkins | `pnpm check` passed (55.5s), `CLOUDFLARE_ENV=preview pnpm build` passed (16.4s) |
| Cleanup | container removed, temporary root and clone removed, teardown clean |

Bounded machine record:
[`jenkins-run.json`](jenkins-run.json). The long console and container logs stay
in the ignored local `output/evidence/` directory.

## What changed

### Runner identity and artefact identity in the receipt

- `scripts/delivery-journey.mjs` records `runner` (`local`, `jenkins`, `gitlab`,
  `buildkite`, `azure-pipelines`, `circleci`, `codebuild`, `other`) with its own
  run id and URL. `--runner`, `--run-id` and `--run-url` set it explicitly; a
  known CI environment is detected when they are omitted. A recorded runner
  grants no approval and does not change which steps run, and a run URL is never
  fetched.
- `artefact` is a deterministic SHA-256 over the sorted `dist/` file list and
  each file's digest, with a file count and byte size. A candidate records the
  same object under `candidate.artefact`. Symlinks are refused.
- A local run with an external run id is refused rather than mislabelled.

### A disposable, real Jenkins fixture

- `examples/jenkins/Dockerfile` builds a local Jenkins LTS image with Node, the
  pinned pnpm, python3 (the SQLite test helper) and only the Pipeline and Git
  plugins. The image tag follows the Dockerfile digest, so a changed fixture
  never reuses a stale image.
- `examples/jenkins/Jenkinsfile` checks out the repository, installs pinned
  dependencies, names the delivery branch, then runs
  `examples/local-delivery-runner.sh --candidate --runner jenkins --run-id
  "$BUILD_URL" --run-url "$BUILD_URL"`.
- `scripts/jenkins-fixture.mjs` (`pnpm delivery:jenkins`) starts one container
  against a temporary clone, creates the job through the authenticated Jenkins
  API with a session-bound CSRF crumb, waits for the build, and compares the
  Jenkins build identity with the receipt. It fails on any mismatch and always
  removes the container, `JENKINS_HOME`, the clone and the temporary root.

### A defect the external runner found

`discoverWorkspace()` treated every `filter.*` git key from any config scope as
an unsafe repository hook. A host with **git-lfs** installed has
`filter.lfs.*` in its system config, so every clean workspace was reported as
`dirty: null` and reference preparation refused with a configuration error. The
guard is now scoped to repository config (`git config --local`), because only
the inspected checkout is untrusted input; the host's own tooling is trusted.
`remote.origin.pushurl` is still refused from any scope. The Jenkins run failed
with 30 test failures before this fix and passed with 505 passing tests after
it.

### Native EmDash Delivery runs surface

- Migration `0023_delivery_runs.sql` adds `composer_delivery_runs`; the newest 20
  receipts are retained.
- `src/lib/delivery-runs-contract.ts` validates the bounded receipt with the same
  field names the journey writes, and refuses extra fields, unknown runners, a
  candidate receipt without a candidate, a release receipt without its attempt,
  and a "passed" release without an independent live read.
- `src/lib/delivery-runs.ts` exposes owner-only `deliveryRead` (GET) and
  `deliveryWrite` (POST) routes with the existing production-origin check. An
  identical receipt recorded twice keeps one row.
- `src/plugins/delivery-runs-page.tsx` is the owner-only **Delivery runs** page:
  runner, mode and state, source commit, target Worker/account/environment/origin,
  the checks that actually ran with durations, artefact identity, release and
  verification state, and the bounded receipt. For a release receipt it re-reads
  `/build.json` in the owner's browser and states whether the live commit matches
  the recorded release — a fresh read, never a stored approval.
- Recording is evidence only: the page cannot deploy, approve or verify anything,
  and it is not linked from the public site.

## Checks

| Check | Result |
| --- | --- |
| `pnpm check:fast -- tests/delivery-journey.test.mjs tests/delivery-runs.test.mjs` | types, lint, format and 26 focused tests passed |
| Readiness suite (`pnpm test:ready`) on the host | 58/58 passed |
| Jenkins job, full `pnpm check` in Linux | 505 passed, 7 skipped, 0 failed |
| Jenkins preview build | passed, 1294-file artefact digested |
| `pnpm deploy` | dependency audit, full check, production build, migration `0023`, upload `d9eab220`, and every live gate passed |
| Live `/build.json` | `43ea8cf5468ab65faad8041b6b60c66ad1fddf71`, matches the deployed source |
| `d1_migrations` | `0023_delivery_runs.sql` applied |
| Admin boundary | `/_emdash/api/plugins/composer-stacks/deliveryRead` and `/_emdash/admin/delivery` answer 302 to an unauthenticated request (Cloudflare Access), never public content |
| EmDash policy dispatch test | anonymous 401, roles 10/20/30/40 403, administrator read and write 200 |

## Remaining gates

- The authenticated **Delivery runs** render (empty state, file/paste record,
  live-source comparison) was not opened because the automation browser has no
  Cloudflare Access owner session. The route, permission dispatch and bounded
  contract are proven; the visual owner-session pass remains an owner step.
- The fixture proves the **candidate** contract. A Jenkins `--release` run was
  not attempted: it would still need clean pushed `main`, the guarded deploy and
  an independent live read, and this batch released through the normal guarded
  local path.
- GitLab, Buildkite, Azure Pipelines, CircleCI and CodeBuild remain templates
  until one is exercised the same way. No provider-specific generator ships.
- #319 also lists approval/evidence binding beyond a changed artefact/account/
  environment and the EKS path (#252); those stay open.
