# App Composer

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

`pnpm ready` verifies the actual authorised Codex/GitHub/Cloudflare workspace, selected account hostname routing and exact HTTPS Hello source, saving private progress even when a check fails. It does not inspect another user's environment or obtain credentials on their behalf.

The doctor distinguishes human authentication/permission steps from agent setup, provider retries and agent repairs. HTTP 429/5xx and network interruption produce a failed check without readiness expiry; other independent checks continue. A rerun rechecks actual permissions and source identity rather than trusting a saved green receipt. Errors and provider bodies are not copied into receipts. A public site's 403 is not assumed to mean its operator needs another API permission.

An independent Hello workspace can run the same doctor without importing EmDash or Woodhouse: `node /path/to/app-composer/scripts/ready.mjs --workspace /path/to/hello --account ACCOUNT_ID --reference-worker WORKER_NAME --reference-url https://YOUR_HOST --reference-repo OWNER/REPO`. Tools and credentials are checked in the selected workspace.

The importable core is `lib/get-ready/index.mjs`: create a scoped session, run/resume the supported checks, inspect capabilities and next recovery steps, or use the locked local adapter. `examples/get-ready.mjs` is a minimal independent Node consumer. It accepts workspace, account, Worker, HTTPS origin and repository as arguments. The module contains no EmDash, composition or Woodhouse runtime imports. Sessions reject credential fields; adapter credentials stay in the authorised process. MIT licence and attribution apply to the reusable source.

Verification is read-only. The explicit `--deploy-reference` CLI flag (or `deploy-reference` example operation) freshly checks prerequisites, then runs the existing reviewed Hello deploy command and verifies HTTPS. This first action supports the authored Hello repository on clean pushed main, the exact installed Wrangler 4.143.1, matching account/Worker/configured origin and an existing account-owned route. It creates no domains, accounts or resources and executes no arbitrary repository or supplied shell command. A failed deployment cannot become ready merely because an old site still responds. The explicit `--install-reference-tools` operation runs before the Cloudflare check, after fresh agent/GitHub prerequisites. It supports clean reviewed Hello checkouts on macOS Apple Silicon, Node 22 and pnpm 12.8.1/12.9.1. It detects the actual local Wrangler executable first, installs missing pinned dependencies with a frozen lockfile and disabled scripts/hooks, isolates unrelated user/global registry settings and excludes service credentials from the install process. A repeat verifies the local tool without installing again. No global tools or cloud resources are changed. Global Git/GitHub CLI/pnpm/Codex installation, initial account/domain bootstrap, customer-fork execution and hosted API/MCP remain unfinished.

### Prepare a missing reference checkout

The agent can now use the same engine to acquire the maintained public Hello source. From an **existing authorised GitHub workspace**, explicitly choose a new directory whose parent already exists:

```sh
pnpm ready --workspace /path/to/authorised-project --clone-reference /path/to/new-hello
```

`clone-reference` checks the parent workspace’s current agent/GitHub prerequisites, looks up Hello’s exact main revision, reserves the new directory exclusively and verifies the resulting clean main checkout and remote. Git hooks, templates, URL rewrites and inherited Git configuration are disabled; the public clone receives no service credentials. Existing files, empty directories, symlinks and unrelated/modified checkouts are refused. An already unchanged exact-main Hello checkout returns `changed:false`. A failed or interrupted acquisition keeps partial files for agent inspection, and read-only resume never retries it. Cancel its recorded intent before selecting a different destination. No GitHub repository or cloud resource is created.

The receipt still describes the **parent workspace**; it does not declare the new checkout ready. Run the doctor against the destination next, selecting the account and existing route explicitly. Where the operator has Hello push permission, missing pinned tools can then be installed:

```sh
pnpm ready --workspace /path/to/new-hello --install-reference-tools \
  --account ACCOUNT_ID --reference-worker WORKER_NAME \
  --reference-url https://YOUR_HOST --reference-repo loftwah/app-composer-hello
```

This is maintained-reference acquisition, not customer source ownership: a public clone does not grant upstream push permission. Creating and deploying a customer-owned fork remains a separate unfinished path. The independent consumer accepts `clone-reference ABSOLUTE_DESTINATION` as its final arguments. Official [Git clone options](https://git-scm.com/docs/git-clone) and [hook configuration](https://git-scm.com/docs/git-config) reviewed 14 October 2026.

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

Readiness doctor: a fork selects `pnpm ready --workspace /path/to/project --account ACCOUNT_ID --reference-worker WORKER_NAME --reference-url https://hello.example.com --reference-repo OWNER/HELLO_REPO`. The supported account-routing check uses an existing scoped `CLOUDFLARE_API_TOKEN`; Wrangler OAuth alone does not prove that the selected hostname belongs to that account. GitHub push, active Codex runtime, authenticated Wrangler account and account-owned custom-domain/workers.dev routing must all pass. `--cancel` cancels only the receipt; it does not delete infrastructure. Private receipt updates are atomic, concurrent runs are excluded and an interrupted process leaves an explicit incomplete state. A stale lock must be checked against its recorded process before removal. Every resume revalidates credentials and current source; no cached client report grants execution authority. Source/target changes start fresh scoped evidence. `--publish-proof` is an explicit launch-operator-only action; ordinary runs never overwrite the public launch proof. Global tool installation, initial DNS setup, domain purchases and fresh-user provisioning still require the agent’s supported authorised workflow; the doctor does not claim to perform them.

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

## App activity and health

Reviewed 14 October 2026. `/activity` ranks recorded public home-page opens across the five mini-apps, with original photo opens and completed inspections separately labelled. `/api/usage` exposes the same aggregate data. Existing Composer D1 stores only UTC day/app/event/version counters; no individual event, IP, cookie, user, URL, search or vault data is saved. Seven- or thirty-day views use six finite cache keys per UTC day and a one-minute cache. Retention runs once daily on the existing CMS schedule and keeps 35 inclusive UTC day buckets. Daily counters cap at 1,000 per app/event/version. A native shared limit drops excess events at 60 per minute per app/event per Cloudflare location; capped cells are suppressed in each active isolate. This bounds recorded work, not account spending or global HTTP traffic. The US$5 alert remains an alert.

Standalone publishers are opt-in server code with app-scoped write-only tokens, a 1.5-second timeout, no retries and no redirect following. Fork defaults are disconnected. Promoted services remove optional publisher variables; Composer records their successful mounted responses itself, avoiding double counts and a runtime dependency cycle. Tests use `X-Composer-Verification: 1`; unmarked bots and reloads may count, outages and rate limits may lose events. Never label these numbers people or exhaustive totals.

`GET /healthz` returns liveness and the public source revision only; all mini-apps expose it too, under their mount where applicable. `HEAD` is supported and other methods return 405. It does not inspect storage, return environment details, prove an app flow or replace Get Ready. Use exact `/build.json` plus real interactions for release acceptance. `node --test tests/usage.test.mjs` checks collector permissions, byte bounds, actual SQLite cap/pruning, rate refusal, cap suppression, publisher failure and liveness semantics. Official [Workers rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) and [background work](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil) checked 14 October 2026.

Optional local diagnostics: append `?vitals=1`, then open Page performance. The self-hosted standard Web Vitals 6.2.3 bundle (Apache-2.0, licence/provenance included) reports current-load LCP/INP/CLS. No metrics or element attribution are uploaded or persisted. Unsupported measurements remain unavailable. The console shows fixed public source/activity links; no private content. This does not claim a site-wide field pass.
