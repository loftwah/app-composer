# App Composer

App Composer is an agent-operated application studio built around EmDash and Cloudflare. Get Ready prepares the supported environment before an idea; Init turns content, fields and app choices into a portable specification; composition connects independently maintained mini-apps. The product carries forward WordPress’s useful content/form/white-label lessons while agents handle implementation and operations. See the [whole platform](https://composer.loftwah.com/architecture) and [product definition](PRODUCT.md) for current capability and remaining work.

An agent-operated platform for a verified development environment and genuinely composed independent applications. Target: https://composer.loftwah.com. MP directs; agents implement, verify and recover. Reviewed 13 October 2026. MIT.

## Supported implementation

Astro 7.3.5, EmDash 1.2.0, Cloudflare adapter 14.3.3, Wrangler 4.143.1. The lockfile pins the tested Cloudflare Vite integration and Workers runtime. EmDash manages the published catalogue through isolated D1/R2. It is a real query-backed CMS boundary; customer mini-apps are independent Workers, not forced into CMS plugins.

- [Photo Guestbook](https://github.com/loftwah/app-composer-guestbook), standalone at https://guestbook.loftwah.com.
- [Curated Showcase](https://github.com/loftwah/app-composer-showcase), standalone at https://showcase.loftwah.com.
- [Hello World reference](https://github.com/loftwah/app-composer-hello), https://ready.loftwah.com.
- [Fictional Portable AI State](https://github.com/loftwah/app-composer-state), https://ai.loftwah.com. Synthetic-only pending full security gates.

The first pair mounts through declared, separately pinned integrated Worker services. `pnpm compose:promote` compiles the exact reviewed pins, deploys those services and leaves standalone upstream version changes outside the composition code. Approved items become featured cards through a generic provider API. Current privacy is resolved on every public request. Code rollback does not restore old data or permissions.

## Local operation

`pnpm install`, `pnpm dev`, `pnpm check`, `pnpm build`. Local EmDash D1 state is disposable and separate from production. To demonstrate seeded catalogue content locally, use the documented EmDash seed/migration tools against the local database; remote content is never silently copied into local or preview state.

The public Get Ready handoff offers complete setup, read-only inspection and rechecking after sign-in. Each uses the same core and current repository instructions. Copying a prompt executes nothing; check/resume requests prohibit setup mutations and automatic retries. Manual copy remains available without JavaScript or clipboard permission.

`pnpm ready` verifies the actual authorised Codex/GitHub/Cloudflare workspace, selected account hostname routing and exact HTTPS Hello source, saving private progress even when a check fails. It does not inspect another user's environment or obtain credentials on their behalf.

The doctor distinguishes human authentication/permission steps from agent setup, provider retries and agent repairs. HTTP 429/5xx and network interruption produce a failed check without readiness expiry; other independent checks continue. A rerun rechecks actual permissions and source identity rather than trusting a saved green receipt. Errors and provider bodies are not copied into receipts. A public site's 403 is not assumed to mean its operator needs another API permission.

The tool check probes Git, GitHub CLI and pnpm independently and reports every missing or unusable tool together, with official installation/repair links. Successful evidence keeps only validated versions. An active Codex desktop workspace works without a separately installed Codex CLI; an installed CLI alone does not establish an active agent. The agent owns ordinary tool repair, but this doctor performs no global installations. Reviewed 14 October 2026 against the official [Git](https://git-scm.com/install/), [GitHub CLI](https://github.com/cli/cli#installation) and [pnpm](https://pnpm.io/installation) instructions.

### Show your own progress

The agent can add `--report` to the doctor to output a redacted JSON progress report instead of its text summary. Capture that stdout in a new JSON file and open it in **Your setup progress** at `/ready`. An incomplete doctor still returns a nonzero exit status with a valid report. The private `.private/readiness.json` receipt is a different format and is refused by the viewer.

The export includes fixed check IDs/states/timestamps, bounded tool diagnoses and unfinished operation names; it excludes account IDs, repository names, local paths, raw actions, credentials and provider evidence. `readinessReport(session)` and `inspectReadinessReport(report)` expose the same interface to independent consumers. Browser inspection uses the core’s existing freshness rules, not a second readiness engine. Report version 1 is display data, not source authority, permission or proof of the current environment. The browser reads the selected file locally without uploading or saving its contents; expired reports need an actual agent recheck. Unknown versions/fields and oversize files are refused while the previous displayed report remains intact. Clearing removes the report from that page. Without JavaScript, use the agent’s own results instead.

An independent Hello workspace can run the same doctor without importing EmDash or Woodhouse: `node /path/to/app-composer/scripts/ready.mjs --workspace /path/to/hello --account ACCOUNT_ID --reference-worker WORKER_NAME --reference-url https://YOUR_HOST --reference-repo OWNER/REPO`. Tools and credentials are checked in the selected workspace.

The importable core is `lib/get-ready/index.mjs`: create a scoped session, run/resume the supported checks, inspect capabilities and next recovery steps, or use the locked local adapter. `examples/get-ready.mjs` is a minimal independent Node consumer. It accepts workspace, account, Worker, HTTPS origin and repository as arguments; unselected pre-idea targets use `-`. The module contains no EmDash, composition or Woodhouse runtime imports. Sessions reject credential fields; adapter credentials stay in the authorised process. MIT licence and attribution apply to the reusable source.

Verification is read-only. The explicit `--deploy-reference` CLI flag (or `deploy-reference` example operation) freshly checks prerequisites, then builds a verified temporary snapshot of the reviewed Hello source and verifies its deployment over HTTPS. This first action supports the authored Hello repository on clean pushed main, the exact installed Wrangler 4.143.1, matching account/Worker/configured origin and an existing account-owned route. It creates no domains, accounts or resources and executes no arbitrary repository or supplied shell command. The adapter passes the selected repository/account/Worker/origin as explicit non-secret release inputs. The adapter executes Hello’s independently maintained target contract from the verified snapshot, matching these inputs to its Git remote and actual Wrangler configuration. It checks every tracked byte before and after testing/building, preserves ignored owner files, and uploads through the selected pinned Wrangler with a stripped environment and dotenv disabled. Tests and dry-run receive no service credentials; only the upload receives the selected Cloudflare credentials. Inherited CI Worker names, API base URLs and Node controls cannot alter this supported release. It verifies the selected hostname without redirects. The independent Hello repository’s manual deploy command remains separate; this protection applies to the Get Ready operation. A failed deployment cannot become ready merely because an old site still responds. The explicit `--install-reference-tools` operation runs before the Cloudflare check, after fresh agent/tool checks and an independent exact-main source read. This local preparation does not require or grant upstream push permission; the doctor remains incomplete when its GitHub write check fails. It supports clean reviewed Hello checkouts on macOS Apple Silicon, Node 22 and pnpm 12.8.1/12.9.1. It matches actual package/lockfile bytes to committed Git blobs before package/tool execution and after installation, including edits hidden from Git status. It detects the actual local Wrangler executable first, installs missing pinned dependencies with a frozen lockfile and disabled scripts/hooks, isolates unrelated user/global registry settings and excludes service credentials from the install process. A repeat verifies the local tool without installing again. No global tools or cloud resources are changed. Global Git/GitHub CLI/pnpm/Codex installation, initial account/domain bootstrap, general customer-fork execution and hosted API/MCP remain unfinished; the bounded private-starter initial deployment is described below.

### Prepare a missing reference checkout

The agent can use the same engine to acquire the maintained public Hello source from an **authorised Codex folder**, including one with no Git repository or app idea. Git, GitHub CLI and pnpm must already be installed. Explicitly choose a new directory whose parent already exists:

```sh
node /path/to/app-composer/scripts/ready.mjs \
  --workspace /path/to/empty-folder --clone-reference /path/to/new-hello
```

`clone-reference` checks the active agent/tools and freshly reads Hello’s exact main revision through GitHub CLI at `github.com` before reserving the new directory. Reading this public source requires no parent/upstream push permission. A confirmed missing login or denied source read is recorded as a human authentication/permission step; malformed responses stay with the agent. The clone then verifies its clean main checkout and remote. Git hooks, templates, URL rewrites and inherited Git configuration are disabled; the public clone receives no service credentials. Existing files, empty directories, symlinks and unrelated/modified checkouts are refused. An already unchanged exact-main Hello checkout returns `changed:false`. A failed or interrupted acquisition keeps partial files for agent inspection, and read-only resume never retries it. Cancel its recorded intent before selecting a different destination. No GitHub repository or cloud resource is created.

The receipt still describes the **parent folder**; it does not declare the new checkout ready. A completed acquisition can therefore accompany an `action_required` doctor and nonzero CLI exit. Read the operation result separately from overall readiness. Run the doctor against the destination next, selecting the account and existing route explicitly. Missing pinned tools can then be installed without upstream push permission. Use the Composer-owned command from outside the selected Hello checkout:

```sh
node /path/to/app-composer/scripts/ready.mjs --workspace /path/to/new-hello --install-reference-tools \
  --account ACCOUNT_ID --reference-worker WORKER_NAME \
  --reference-url https://YOUR_HOST --reference-repo loftwah/app-composer-hello
```

This is maintained-reference acquisition, not customer source ownership: a public clone does not grant upstream push permission. Personal private source ownership and initial deployment are supported below; general customer-fork execution remains unfinished. Deployment still requires fresh GitHub write permission; public acquisition and local tool preparation do not supply it. The independent consumer accepts `clone-reference ABSOLUTE_DESTINATION` as its final arguments. Official [Git clone options](https://git-scm.com/docs/git-clone) and [hook configuration](https://git-scm.com/docs/git-config) reviewed 14 October 2026.

### Own the prepared source

After acquiring the maintained checkout, the agent can explicitly prepare a **new personal private GitHub repository**. Select the account and unused name; this creates source storage, not a deployment:

```sh
node /path/to/app-composer/scripts/ready.mjs \
  --workspace /path/to/new-hello --own-reference YOUR_GITHUB_LOGIN/my-first-app
```

The authenticated GitHub account must match the selected owner. Organisations and public repository creation are not supported by this operation. GitHub atomically refuses a name that already exists; the agent never guesses that a failed read means a name is available. The starter must be unchanged at the actual maintained main SHA, including actual file bytes hidden from Git status. No working files, secrets or local configuration are uploaded: only the captured public commit and its existing MIT history are pushed. The operation verifies the private repository ID, current write/admin access and remote refs, uses an empty-branch lease, then changes the checkout's origin to that repository. It adds no Actions, collaborators, cloud resources or billing commitment.

A private local receipt records the created repository ID and source. An interrupted creation/push retains both local and remote work for agent inspection; it never deletes a repository or retries automatically. An explicit repeat of a fully rebound checkout verifies the selected account, source, privacy, repository identity, both remote directions and refs before returning `changed:false`. A partial creation requires separate `--resume-ownership` intent after agent inspection: this explicitly authorises completing that selected existing personal private repository, while refusing unexpected branches or source. A receipt alone cannot authorise a push or origin change. The operation refuses multiple origin URLs or an explicit origin push URL before creation, so an ordinary future push cannot silently go to upstream. An ambiguous provider outcome must be investigated, not repeated under another name. Ownership always requires a new doctor run under the changed origin; it does not supply a verified deployment target. The same local-tool installer now supports an unchanged personal private copy, after actual GitHub owner/permission and maintained-source checks. A separate initial deployment operation supports the committed prepared profile described below; The supported owned Init/update path is described below; general source updates/cleanup and the complete fresh-user journey remain unfinished.

After ownership, prepare local tools with the same operation:

```sh
node /path/to/app-composer/scripts/ready.mjs \
  --workspace /path/to/new-hello --install-reference-tools
```

For an owned copy, current GitHub main must equal the actual maintained main SHA. The authenticated personal owner, private repository and source access are checked again; local ownership receipts do not grant source authority. Local preparation does not require write/admin access; GitHub write readiness remains a separate deployment prerequisite. All tracked bytes and both origin directions are verified, including hidden changes. Modified source and organisational/public copies are outside this install path. The supported Mac/Node/pnpm versions remain unchanged.

Missing dependencies install in a temporary project containing only verified package, lock and workspace-policy inputs. Copied bytes are matched to the captured commit. Ignored local registry files/hooks and service credentials are excluded, scripts stay disabled, and source is rechecked before exclusively reserving `node_modules`. Relative package links are preserved. An existing valid local installation returns `changed:false`; an incomplete/unrelated directory is preserved for agent repair rather than replaced. This prepares tools, not a deployed app. No target, account or cloud resource is created. Reviewed 14 October 2026 against the selected runtime and official [pnpm installation](https://pnpm.io/cli/install) and [package-layout documentation](https://pnpm.io/symlinked-node-modules-structure).

### Prepare the owned deployment destination

With local tools installed and the owned starter still unchanged, the agent can select an **unused workers.dev address in an existing authorised account**:

```sh
node /path/to/app-composer/scripts/ready.mjs \
  --workspace /path/to/new-hello --prepare-reference-target \
  --account YOUR_ACCOUNT_ID --reference-worker my-first-app \
  --reference-url https://my-first-app.YOUR_SUBDOMAIN.workers.dev \
  --reference-repo YOUR_GITHUB_LOGIN/my-first-app
```

Use the account’s actual Workers subdomain, not the launch operator’s. The shared engine verifies the installed Wrangler account, reads that account’s subdomain and current Worker inventory, and rejects an existing name, mismatched origin, malformed/partial response or conflicting inherited account. Fresh personal/private/source checks and all tracked bytes are rechecked around provider reads. Only the local `wrangler.jsonc` is changed; its original regular file must have one hard link and retain its inode. Existing edits, linked owner files and changed source are preserved.

The prepared profile binds that account, name and origin, disables preview URLs and includes the starter’s fixed asset settings with a 10ms CPU limit. It adds no domains, routes, storage, services, secrets or analytics publisher. **The name is not reserved and no Worker is created.** The CPU limit is not a dollar spending cap. Preparation reports `action_required`, without readiness expiry, and redacted inspection names the review/commit/push/initial-deployment step. It does not retry automatically. A repeat refuses the now-modified source for agent inspection; never reset the prepared file to make the doctor green. Initial owned deployment requires the separate explicit operation below; the subsequent three-field owned Init/update path is also described below. The independent example accepts `prepare-reference-target` after the same five explicit scope arguments. Reviewed 14 October 2026 against official [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) and [Worker inventory API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/list/).

### Deploy the prepared owned starter

The agent reviews the local deployment file, commits/pushes **only that prepared configuration** to the owned private main, then explicitly runs:

```sh
node /path/to/app-composer/scripts/ready.mjs \
  --workspace /path/to/new-hello --deploy-owned-reference \
  --account YOUR_ACCOUNT_ID --reference-worker my-first-app \
  --reference-url https://my-first-app.YOUR_SUBDOMAIN.workers.dev \
  --reference-repo YOUR_GITHUB_LOGIN/my-first-app
```

This is initial Worker creation in an existing authorised account. Fresh agent/GitHub-write/Cloudflare checks precede it. Actual personal ownership, private/default-main metadata, local/remote/GitHub main and all tracked bytes are rebound. The current maintained GitHub SHA anchors the executable/public file inventory and modes; only the exact prepared Wrangler profile may differ. Other source/configuration changes are refused. This operation requires the already installed pinned local tools.

Tests and a real pinned-Wrangler dry-run run against a temporary snapshot of verified tracked bytes, excluding ignored owner `.env`, registry files and hooks. Tests/build receive no service credentials. The upload receives only the selected Cloudflare token/account and safe runtime controls; CI target/API/Node overrides are stripped and Wrangler’s dotenv loading is disabled. Source, GitHub ownership/write authority, local tooling/account and Worker-name availability are checked again after the build. Availability reads are snapshots, **not an atomic reservation**; an agent should use a name it controls and avoid simultaneous deployments to it.

After upload, bounded checks verify the selected account’s routing and exact HTTPS app/source/title/contract/data version. The doctor then rechecks that source independently before readiness can pass. A failed build/verification never earns readiness. Existing and partially created Workers are refused before another upload, including an explicit repeated creation request: inspect the actual provider outcome and use read-only verification instead of blindly retrying. Receipts cannot authorise overwrites; cancellation deletes no resource, and automatic cleanup and general source updates remain unfinished. A separate explicit Init/update path is described below. A successful creation adds one Worker with the bounded profile and static assets, without new storage/domains/subscriptions or analytics publishing. Existing plan costs still apply; no dollar cap is implied. The independent example accepts `deploy-owned-reference` after the same five explicit scope arguments. Reviewed 14 October 2026 against the pinned Wrangler runtime and official [Workers deployment commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/) and [version/deployment semantics](https://developers.cloudflare.com/workers/versions-and-deployments/).

### Configure and update the verified owned app

Once the owned starter is verified, export **Hello** from Init with a title, introduction and theme. Keep temporary-address intent for an already verified workers.dev app. It changes no hostname and provisions no new target. Plan without provider/workspace IO, then apply explicitly:

```sh
node scripts/init-hello.mjs --spec hello-spec.json \
  --workspace /path/to/owned-hello --account YOUR_ACCOUNT_ID \
  --reference-worker my-first-app \
  --reference-url https://my-first-app.YOUR_SUBDOMAIN.workers.dev \
  --reference-repo YOUR_GITHUB_LOGIN/my-first-app
# Add --apply after reviewing the planned fields.
```

The same shared engine checks actual ownership/current private main and the old HTTPS source before preparing only `config.json`. It rechecks all bytes after provider waits, preserves changed owner work and refuses hard-linked/replaced files. Portable multiline introductions use the same text policy in plan/apply. A changed configuration stays action-required with no readiness expiry; it is not a deployment. An unchanged request writes nothing. The maintained authored custom-domain path remains supported separately.

Review/commit/push that configuration, then explicitly update using the **source SHA and active Worker version actually verified before the change**:

```sh
node scripts/ready.mjs --workspace /path/to/owned-hello \
  --account YOUR_ACCOUNT_ID --reference-worker my-first-app \
  --reference-url https://my-first-app.YOUR_SUBDOMAIN.workers.dev \
  --reference-repo YOUR_GITHUB_LOGIN/my-first-app \
  --update-owned-reference --previous-source PREVIOUS_SHA \
  --previous-version PREVIOUS_WORKER_VERSION
```

The update accepts only the three bounded Hello fields plus the prepared deployment profile; every other tracked byte/mode must match actual maintained main. It proves the previous source is in the selected private repository/history and has the same target/profile. Actual routing, previous HTTPS app/source/title and Cloudflare’s latest active single 100% version must agree. Split traffic, foreign/stale bindings and changed source are refused. The version is rechecked **after** the final routing/HTTPS wait, before synchronous source/snapshot checks and upload. These provider reads are snapshots, not an atomic compare-and-swap lease: avoid simultaneous writes to the selected Worker. A local receipt alone authorises no overwrite, and direct adapter calls with absent/malformed update intent cannot fall back to creation.

The update shares initial deployment’s isolated tests/build, stripped tooling environment and pinned Wrangler upload. The new active version and exact HTTPS identity must verify; a separate doctor can then recheck readiness without uploading. There is no automatic retry/rollback/delete. General executable-source updates, customer account bootstrap and automatic cleanup remain unfinished. The independent Node example accepts `update-owned-reference PREVIOUS_SHA PREVIOUS_VERSION` after the five target arguments. Programmatic consumers use the same `runLocalReadiness` with `configure-owned-reference`/three-field `configuration`, or `update-owned-reference`/two-field `previousDeployment`; no site/CMS runtime is needed. Official [deployment-list contract](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/) reviewed 14 October 2026: its first result is the latest active deployment. Existing credential/plan costs apply; no subscription or permission is added.

The independent Node example also supports pre-idea setup without invented cloud targets. Use `-` for each unselected target: `node examples/get-ready.mjs /path/to/new-hello - - - - own-reference YOUR_GITHUB_LOGIN/my-first-app`. For acquisition, replace the last two arguments with `clone-reference /path/to/new-hello`. Reviewed 14 October 2026 against [GitHub's personal repository API](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user) and the installed Git/GitHub CLI; credentials stay in the authorised process.

`pnpm compose` fetches and validates known public app manifests at exact commits, verifies their actual deployed identities and stages an inspectable cached candidate. Arbitrary catalogue repositories are never executed. `pnpm compose --spec path/to/spec.json --apply` additionally validates the portable spec and applies authorised configuration using private owner credential files in the adjacent independent app checkouts; purchases and unverified targets are blocked. This operator path is deliberately narrow, not public multi-tenant provisioning.

Production uses `pnpm deploy`: clean pushed main, type/risk checks, production build, Wrangler and exact live-host source verification. There are no GitHub Actions. Preview is a separate named environment with separate D1/R2 and no production app service bindings; missing app services fail explicitly rather than sharing production data.

## Secrets and human gates

`OWNER_API_TOKEN` and `EMDASH_ENCRYPTION_KEY` are runtime secrets, generated in private operator storage and passed to Wrangler over stdin. They never enter specs, source or browser output. EmDash admin/API paths are protected by the exact-owner Cloudflare Access policy and a Worker-level JWT issuer/audience check. Native EmDash Access authentication validates the signed identity and provisions its first protected owner as Admin; production passkeys, self-signup and invites are replaced by Access. Preview has no audience and remains closed. The policy was activated in the authenticated browser with MP approval; preserve the exact owner allowlist. Never make admin public to work around that gate.

The optional unpacked Chrome extension has explicit-click activeTab injection, Get Ready/Init handoffs and local decision exploration. No Cloudflare dashboard credential scraping, native-product/partnership claim or public build API. Installed dashboard acceptance and Web Store publishing are distinct.

## Boundaries and evidence

Read `ARCHITECTURE.md`, `composition.lock.json`, `docs/STATUS.md` and GitHub #11. Public browsing and configuration drafts need no account. Upload/moderation/curation require invited owner access. Demo artwork and vault personas are original/synthetic, never real private records. Current manifest support is the authored first pair; wider registrars/providers, automated update policies, arbitrary builds and real-data vault import are not advertised as shipped.

Official integration references reviewed 13 October 2026: [EmDash Cloudflare](https://docs.emdashcms.com/deployment/cloudflare/), [content queries](https://docs.emdashcms.com/guides/querying-content/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [Worker rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/). Runtime/public evidence must be checked independently of source or tests.

## Assets

Original editable marks and functional diagrams are in `public/brand/`. Presentation and social imagery uses generated raster originals, with provenance beside delivered JPEGs. PNG icon exports derive from the editable mark. Fictional gallery originals use the real moderated upload pipeline; generation is never presented as documentary photography. Space Grotesk is SIL OFL, originally by Florian Karsten; the licence is retained with the font. No Koji assets or proprietary source is used. Real screenshots belong to release evidence, never fabricated UI illustrations.

Default dark and saved light themes use Tailwind 4.3.3 semantic tokens and native Astro controls. Read [UNSLOP.md](UNSLOP.md) for the writing/interface standard. Native controls handle the present forms without an extra shadcn client runtime.

Preview: select `CLOUDFLARE_ENV=preview pnpm build` before `pnpm wrangler deploy`. Verify the generated config names only the preview D1/R2/KV and has no app services, then apply preview migrations and deploy. Passing `--env` only at deploy time does not select the Vite build environment. Restore a production build before any production command.

Cost controls: the operator keeps public builds/signups closed, owner uploads capped and mutation rates bounded. Composer has a 1,000ms CPU limit per invocation and bounded deployment verification retries. These limits do not enforce a dollar budget. The existing account usage alert is US$5 and excludes fixed subscription fees; no new paid plan was introduced by Composer. A traffic surge can still incur usage charges on the existing paid Workers/R2 account.

Wrangler secret commands require an explicit environment: use `--env preview` for preview and `--env=""` for the root Worker. They do not follow the generated Vite build target. Keep distinct private encryption key files and confirm the printed Worker name. Never print key values.

Email: the native `composer-resend` transport reads `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` and `RESEND_ALLOWED_RECIPIENTS` from deployment secrets at delivery time. It adds no public route and denies every recipient not explicitly invited, including unlisted plus aliases. The sender domain is verified at Resend. Activate the provider and test it in native EmDash Settings → Email; configuration alone is not delivery evidence. Preview has no email secrets. Keys never enter plugin options or CMS settings. The native format is necessary for deployment-secret access; the older npm Resend plugin targets EmDash 0.5. Official [email setup](https://docs.emdashcms.com/guides/email/) and [native secret handling](https://docs.emdashcms.com/plugins/creating-native-plugins/your-first-native-plugin/) reviewed 13 October 2026.

Readiness doctor: a fork selects `pnpm ready --workspace /path/to/project --account ACCOUNT_ID --reference-worker WORKER_NAME --reference-url https://hello.example.com --reference-repo OWNER/HELLO_REPO`. The supported account-routing check uses an existing scoped `CLOUDFLARE_API_TOKEN`; Wrangler OAuth alone does not prove that the selected hostname belongs to that account. GitHub push, active Codex runtime, authenticated Wrangler account and account-owned custom-domain/workers.dev routing must all pass. `--cancel` cancels only the receipt; it does not delete infrastructure. Private receipt updates are atomic, concurrent runs are excluded and an interrupted process leaves an explicit incomplete state. Storage refuses linked private folders/receipts and malformed or unrelated JSON. Exclusive temporary files replace the old predictable filename; receipt or lock edits during a run stop later writes and preserve the changed bytes. The agent must inspect and relocate unrelated or damaged receipt files before explicitly rerunning; the doctor does not repair or discard them. A stale lock must be checked against its recorded process before removal. Every resume revalidates credentials and current source; no cached client report grants execution authority. Source/target changes start fresh scoped evidence. `--publish-proof` is an explicit launch-operator-only action; ordinary runs never overwrite the public launch proof. Global tool installation, initial DNS setup, domain purchases and fresh-user provisioning still require the agent’s supported authorised workflow; the doctor does not claim to perform them.

Composition `--apply` first rejects missing specs, Hello, preview, purchases and unsupported hostnames before inspecting workspace authority, fetching providers or writing staging state. The supported existing operator target also requires a verified, finite unexpired readiness receipt matching the clean current launch workspace, source and Cloudflare account. Failed, cancelled, interrupted and legacy receipts are rejected before staging or writes; a fork’s receipt cannot authorise the launch operator’s production targets.

Hello Init uses `pnpm init:hello --spec FILE --workspace /path/to/hello --account ACCOUNT_ID --reference-worker WORKER_NAME --reference-url https://YOUR_HOST`. Without `--apply` it prints the proposed title/introduction/theme without inspecting the workspace or calling providers. Explicit `--apply` requires the authored clean exact-main Hello repository and a matching existing-domain spec, then runs the same Get Ready engine before preparing `config.json`. Failed readiness or a workspace change leaves the configuration untouched; unrelated existing fields are preserved. The command never commits, pushes or deploys. The agent reviews the diff, follows the independent repository release path and uses `deploy-reference` to verify the changed HTTPS result. Unsupported preview/purchase/hostname intent is rejected before setup writes. Hello's hidden gallery layout normalises to the stable spec default and does not create a fictional configuration feature. Customer-fork provisioning remains unfinished.

EmDash 1.2.0 upgrade: direct CMS/Cloudflare packages move together, with a rehearsed raw D1 recovery export and retained runtime keys before its forward core migrations. Native admin ships English only and caps media uploads at 1 MiB; customer mini-app media limits remain independent. Vendor-generated upgrade work orders and refreshed skills are private operator evidence.

Focused checks: `pnpm check:types`, `pnpm test:core`, `pnpm test:ready`, `pnpm test:access`, `pnpm test:email` and `pnpm test:release` run independently without network mutation. Run the relevant group while developing; `pnpm check` retains every required release gate. For a single regression, use `node --test --test-name-pattern="name" tests/example.test.mjs`. Browser, real deployment and disaster-recovery checks are separate explicit operations, never hidden behind a unit test.

The public app library at `/apps` and native nine-dot launcher share one list of shipped entry points. That navigation list does not replace EmDash's published catalogue contracts.

Contributions of code, documentation, design and accessibility feedback are welcome: [Contributing](CONTRIBUTING.md), [Code of Conduct](CODE_OF_CONDUCT.md), [Security](SECURITY.md), [Accessibility](ACCESSIBILITY.md). Ctrl/Cmd+K opens the searchable app/task launcher; the nine-dot button provides the same path.

Supported dependency-install behaviour was checked against the selected pnpm runtime and current official [install options](https://pnpm.io/cli/install), [configuration locations](https://pnpm.io/cli/config) and [local Wrangler installation guidance](https://developers.cloudflare.com/workers/wrangler/install-and-update/) on 13 October 2026. A fresh Hello clone ran missing-tool detection → pinned install → unchanged repeat → exact-source HTTPS deployment. This used existing account/domain credentials and is not first-account provisioning evidence.

First-time users can follow [/ready/guide](https://composer.loftwah.com/ready/guide). Native disclosure steps link to current vendor instructions; generated images never imitate sign-in screens. Editable D2 workflow sources live in `public/diagrams/`. Lucide 1.56.0 (ISC) supplies static Astro icons. Original app artwork and optimised thumbnails include provenance in `public/brand/apps/`; MP-supplied concept originals remain unchanged at the root, with explicitly labelled public derivatives. These guides do not claim new-user account/domain/fork provisioning is automated.

Failed reference operations retain their scoped intent through read-only resume. The standalone inspector’s `ready` result requires current checks and no unfinished operation; individually passing HTTPS checks do not hide a failed deployment. `next` reports unfinished operations alongside missing/stale checks. Rerunning the doctor never retries an operation automatically. An explicit successful retry clears its intent; cancellation or a changed workspace/account/source/target starts a separate scope. Repairing dependencies does not silently discard an unfinished deployment. Prior failure summaries are marked for agent recheck rather than reused as proof that human authentication is still required.
Older blocked receipts may not identify the operation. Their unfinished intent is retained through unrelated setup; the agent explicitly cancels that legacy intent before starting a new scoped operation. Cancellation changes only the local receipt and does not remove infrastructure.

Init conditional drafts: only the visible existing-domain choice validates and exports a hostname. Hidden card/layout/hostname controls cannot block native form submission. Switching back keeps unfinished values in the current form so they can be repaired; only applicable validated fields enter the saved/exported spec. Active link cards need a title and HTTPS destination, and removing a row immediately refreshes the spec/handoff. No form choice authorises setup or deployment.

## Prepare missing workspace tools

Reviewed 14 October 2026. The explicit supported step uses active Codex on macOS Apple Silicon, Node 22 and existing Git. It checks existing tools first. Usable GitHub CLI and pnpm are reused; otherwise it prepares GitHub CLI 2.98.0 and pnpm 12.9.1 inside the selected workspace. It changes no machine installation, shell profile, account login or cloud resource. The Node command works before pnpm is available:

```sh
node /path/to/app-composer/scripts/ready.mjs --workspace /your/authorised-folder --install-workspace-tools
```

Official release URLs, sizes and SHA-256 digests are fixed in `lib/get-ready/workspace-tools.mjs`. Only one GitHub release-assets redirect is allowed. Decoded bytes are bounded and hashed; compressed HTTP lengths do not replace those checks. pnpm’s full runtime and both tools’ licences are retained. The complete installed file tree is checked before execution and again after isolated version probes; service credentials and inherited execution controls are excluded from preparation. Existing, linked or partial tool folders are preserved for inspection. Private temporary preparation bytes remain available after failure; the agent never deletes an interrupted install automatically.

When the result’s scope is `workspace`, explicitly select it for later checks or supported operations:

```sh
node /path/to/app-composer/scripts/ready.mjs --workspace /your/authorised-folder --use-workspace-tools --report
node /path/to/app-composer/scripts/ready.mjs --workspace /your/hello-checkout --tools-workspace /your/authorised-folder --report
```

The second command reuses the verified pair in a different output repository. It does not install another copy or grant repository/account/deployment authority. An `existing` result needs no prepared-tool flag. Ordinary resumes do not activate private executables or retry setup implicitly. Programmatic consumers use the same `runLocalReadiness` operation and `useWorkspaceTools`/`toolsWorkspace` options; there is no second installer/doctor. Git/Node installation, new account sign-in and domain setup remain separate supported-workflow gaps.

Pins were checked against the official [GitHub CLI release](https://github.com/cli/cli/releases/tag/v2.98.0), [pnpm release](https://github.com/pnpm/pnpm/releases/tag/v12.9.1) and [installation guidance](https://pnpm.io/installation). These are reviewed versions, not an automatic latest-version policy.

## App activity and health

Reviewed 14 October 2026. `/activity` ranks recorded public home-page opens across the five mini-apps, with original photo opens and completed inspections separately labelled. `/api/usage` exposes the same aggregate data. Existing Composer D1 stores only UTC day/app/event/version counters; no individual event, IP, cookie, user, URL, search or vault data is saved. Seven- or thirty-day views use six finite cache keys per UTC day and a one-minute cache. Retention runs once daily on the existing CMS schedule and keeps 35 inclusive UTC day buckets. Daily counters cap at 1,000 per app/event/version. A native shared limit drops excess events at 60 per minute per app/event per Cloudflare location; capped cells are suppressed in each active isolate. This bounds recorded work, not account spending or global HTTP traffic. The US$5 alert remains an alert.

Standalone publishers are opt-in server code with app-scoped write-only tokens, a 1.5-second timeout, no retries and no redirect following. Fork defaults are disconnected. Promoted services remove optional publisher variables; Composer records their successful mounted responses itself, avoiding double counts and a runtime dependency cycle. Tests use `X-Composer-Verification: 1`; unmarked bots and reloads may count, outages and rate limits may lose events. Never label these numbers people or exhaustive totals.

`GET /healthz` returns liveness and the public source revision only; all mini-apps expose it too, under their mount where applicable. `HEAD` is supported and other methods return 405. It does not inspect storage, return environment details, prove an app flow or replace Get Ready. Use exact `/build.json` plus real interactions for release acceptance. `node --test tests/usage.test.mjs` checks collector permissions, byte bounds, actual SQLite cap/pruning, rate refusal, cap suppression, publisher failure and liveness semantics. Official [Workers rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) and [background work](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil) checked 14 October 2026.

Optional local diagnostics: append `?vitals=1`, then open Page performance. The self-hosted standard Web Vitals 6.2.3 bundle (Apache-2.0, licence/provenance included) reports current-load LCP/INP/CLS. No metrics or element attribution are uploaded or persisted. Unsupported measurements remain unavailable. The console shows fixed public source/activity links; no private content. This does not claim a site-wide field pass.

GitHub source-authority checks explicitly select [github.com](https://cli.github.com/manual/gh_api), matching supported Git remotes rather than inherited enterprise-host settings. Reviewed 14 October 2026.

## Separate app settings in Init

Open [Init](https://composer.loftwah.com/init), choose Guestbook + Showcase and open **Settings for each app**. Enable a separate group, edit its title/introduction/theme/layout, or use that app's declared defaults. Uncheck it to inherit the shared values. The form renders the fields and constraints from the reviewed `composition.lock.json` manifests. A separate group contains every supported field; partial per-field inheritance is not supported in this version.

Saved/exported specs are version 2 and include exact selected source commits and manifest digests. Version 1 drafts migrate with their existing shared values; a saved version 2 whose contracts differ is refused with a compatibility message and its saved file is preserved. Unknown settings and incomplete groups fail validation. The effective per-app configuration powers both the preview and the agent command.

For a settings-only change to this already verified operator pair, use `node --env-file=.env scripts/compose.mjs --spec PATH --apply-settings` from clean pushed Composer main after the normal read-only doctor. Composer main must already be deployed. The command checks the actual pinned standalone/mounted source again before each owner API write, then confirms the exact configuration response. It leaves cards, source pins, release records and Worker deployments unchanged. It refuses preview/purchase/other-target/Hello intent and any card additions. Existing composition/card application remains the separate `--apply` path. This is not public provisioning.

If a later app fails, completed settings remain for inspection. There is no automatic retry or rollback; the agent checks the live values before an explicit retry. Provider identity reads are snapshots, not an atomic guarantee against a simultaneous app deployment.

## Optional local Get Ready MCP

Another agent can recheck the supported environment through the same engine using a local stdio connection. This first adapter exposes `get_ready_check` and `get_ready_inspect`, both with empty arguments. The host selects the trusted workspace, account and reference at launch; a model cannot change those selections, run shell commands or request a setup/deployment operation. A check saves the existing private receipt, while its model-visible output is the same redacted dated report and shared freshness/unfinished-operation inspection used by Composer. Inspect reads the latest completed report on that connection, without provider calls; it is empty before a check or after an aborted check.

```sh
node /path/to/app-composer/scripts/get-ready-mcp.mjs \
  --workspace /absolute/path/to/your/trusted/hello \
  --account YOUR_ACCOUNT_ID --reference-worker YOUR_WORKER \
  --reference-url https://YOUR_VERIFIED_HOST --reference-repo YOUR_OWNER/YOUR_REPO
```

For an incomplete environment, supply only the explicit workspace and the selections already known. Missing account/reference choices remain action-required; there is no launch-operator fallback. `--tools-workspace /absolute/path/to/prepared/folder` explicitly reuses a verified workspace tool pair. Global installations, authentication, repo creation, DNS and deployment are unavailable through these tools. Repeat checks do not retry an unfinished setup operation. An active supported Codex runtime and its authorised tools still matter; merely launching MCP cannot certify an agent.

Use the host's normal local runtime credential handling. Tokens/passwords do not belong in launch arguments, MCP tool arguments or exported reports. The adapter retains only selected GitHub/Cloudflare runtime variables and ordinary tool paths; it strips unrelated credentials and execution controls. It accepts one check at a time, refuses unknown tool arguments, limits incoming stdio messages to 64 KiB and clears cached results if a check fails or request cancellation is observed. Cancellation does not forcibly stop the bounded underlying doctor or undo private progress; another check stays blocked until it finishes. No HTTP endpoint, public build service, new cloud resource or automatic client configuration is added. Trusting a local host still grants access to that selected runtime; this is not a sandbox for arbitrary downloaded tools or repositories.

A minimal client is available at `examples/get-ready-mcp.mjs`. Run it with the same scope flags to print only the report JSON for the browser viewer; it exits nonzero if readiness is incomplete. It never exports the private receipt or the entire protocol result. Focused development checks: `pnpm test:mcp`. The real proof copied the ten-module MIT core and adapter outside Composer/EmDash/Woodhouse, used the official SDK client to recheck the unchanged maintained Hello with existing operator credentials, and verified all four capabilities over the protocol. This does not prove a fresh customer's setup or installation into a native MCP host; those remain separate acceptance work.

Protocol implementation uses pinned official `@modelcontextprotocol/server`/`client` 2.3.1 and Zod 4.6.7 as optional local tooling dependencies. SDK package metadata declares Apache-2.0; its retained licence also describes legacy MIT contributions. Zod is MIT. Notices are in [docs/third-party](docs/third-party/); the core and this repository keep their MIT licence. Official [stdio serving](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio) and [client connection](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect) references were checked 14 October 2026.

## Content and form models

[Init’s content-model editor](https://composer.loftwah.com/init/content) turns an agent’s structured field design into an editable, testable form and compatible EmDash seed. Describe the form and copy a design request, import the model JSON, edit labels/types/groups and optional conditions, then test fictional sample values. The portable `app-composer.content-model` version 1 is separate from pinned app configuration/source and readiness. It never grants CMS or deployment authority.

The independent MIT implementation is in `lib/content-model`. It supports text, HTTPS URLs, whole numbers, booleans, choices and bounded non-nested repeaters. Earlier always-visible Boolean/Choice fields can control optional display. Required conditional fields and nested repeaters are refused. Grouping/conditions belong to the generated app form; native EmDash admin is not claimed to hide them. `emdashSeed` emits compatible fields only, while `validateModelValues` excludes inactive values and validates typed entries. The actual installed EmDash 1.2.0 seed/value validators and isolated native SQLite creation are exercised by `pnpm test:models`.

Models have an exact formatted-export byte cap of 64 KiB, shared with imports and saved-draft restore. Only explicitly saved model structure persists in local storage; valid edits also survive Back in their browser-history entry. Sample entries are not persisted. Review the target’s existing schema and data before applying a downloaded seed; the public editor never modifies a CMS, creates a cloud resource or publishes content. General customer implementation/deployment acceptance remains open under #3/#21.

### Installable Get Ready release archive

Reviewed 14 October 2026. [Download the same core and CLI](https://composer.loftwah.com/docs#standalone-get-ready), with its source/checksum manifest and bundled MIT README. `pnpm ready:pack` packages only the reviewed core allowlist using offline npm pack with lifecycle scripts disabled and an isolated configuration/environment. The website build includes that archive; npm registry publication is not claimed. `scripts/ready.mjs` delegates to the packaged CLI, so operation validation and checks stay in one implementation. There are no runtime dependencies in the archive; the optional SDK-backed MCP transport stays separate. `pnpm test:package` verifies actual isolated installation/API/CLI and private-input/link refusal.

### Reusable content patterns

Reviewed 14 October 2026. [Init content/forms](https://composer.loftwah.com/init/content) includes workshop listings, project case studies, a community directory and project enquiries. Each pattern has a validated fictional example and the same portable model/native EmDash seed export. Opening a pattern preserves the explicit saved draft; Restore saved draft brings it back. Example entry values are never persisted or sent. Model changes or failed checks clear stale validated sample output. These are implementation starting points for the authorised agent, not already deployed customer forms or an enquiry inbox. `pnpm test:models` covers model and pattern/native-compatibility tests.
