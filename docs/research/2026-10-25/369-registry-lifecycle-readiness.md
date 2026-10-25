# Official EmDash registry installation and lifecycle — readiness report

**Issue:** [#369](https://github.com/loftwah/app-composer/issues/369) — Enable the official registry installation and lifecycle on supported Composer sites
**Dated:** 2026-10-25 UTC (observed 06:01–06:12 UTC)
**Lane:** parallel run R5 (ledger lane E/F), read-only research
**Repository inspected:** `loftwah/app-composer`, HEAD `d9f4dfd1456da10ead2d65951079f1e9606e9fc0` at inspection. Concurrent lanes have uncommitted edits in unrelated page/test files; the configuration files cited here are unmodified in `git status`.
**Report path:** `output/parallel-run-20261025/research/369-registry-lifecycle-readiness.md`
**Companion report:** `output/parallel-run-20261025/research/365-plugin-trust-readiness.md`

## Evidence boundary

Separated throughout:

1. **Official documentation** — EmDash and Cloudflare pages fetched 2026-10-25 UTC.
2. **Live unauthenticated registry evidence** — public discovery calls and two artifact downloads recorded under `output/parallel-run-20261025/research/evidence/`.
3. **Repository source evidence** — exact versions, configuration and code paths in this checkout.
4. **Inference** — reasoning, marked as such.

What was **not** done:

- No plugin installed, updated, enabled, disabled or uninstalled, in production or locally.
- No Worker, D1, R2, KV, Access policy, secret or Worker Loader binding was created or changed.
- No production/preview database was read. `_plugin_state` contents are unknown.
- No Cloudflare API call and no entitlement check. Plan status is **unverified**.
- No third-party plugin code was executed. Two bundles were downloaded and their `manifest.json` read without execution.
- No Composer-specific marketplace, installer or mirrored catalogue was built.

---

## 1. Status in one table

| Capability | State on 2026-10-25 | Evidence |
| --- | --- | --- |
| Public registry discovery API | **Working** | Live `200` responses; `@emdash-cms/registry-client@0.7.1` calls succeed |
| Composer can browse the registry in its native EmDash admin | **No** | `astro.config.mjs` has no `sandboxRunner` and no explicit `registry`; EmDash only shows the catalogue when one is configured |
| Browse-only mode without a sandbox runner | **Possible but not configured** | Docs: explicitly configured registry remains browsable; install/update fail `SANDBOX_NOT_AVAILABLE` |
| Composer is installation-ready | **No** | No `sandboxRunner`, no `worker_loaders` `LOADER`, no isolated target; see §5 |
| Any registry plugin installed/updated/disabled/uninstalled in an isolated test | **No** | Not attempted; #369 acceptance remains unchecked |
| Paid Worker Loader entitlement | **Unknown** | Docs say Workers Paid required; repo documentation says the account is already paid; no provider evidence in this run |
| Generated Composer content sites are installation-ready | **No** | Template pins `emdash@1.2.0`, `@emdash-cms/cloudflare@1.2.0`, Astro `7.3.5`; no sandbox config |

**Bottom line:** browsing the public API is proven; browsing inside Composer's admin is not enabled; installation is blocked by missing configuration and missing isolated-test authority; lifecycle is unproven. Do not claim any part of #369's install acceptance from this report.

---

## 2. Official documentation baseline

All pages fetched 2026-10-25 UTC. Quotes are paraphrased unless in code/error form.

### 2.1 Registry and installation

- [The plugin registry](https://docs.emdashcms.com/plugins/registry/):
  - Official catalogue at `https://plugins.emdashcms.com`; default aggregator `https://registry.emdashcms.com` when the site has an enabled sandbox.
  - Registry installs require **storage**, an **available sandbox runner**, and an administrator with **`plugins:manage`**.
  - Cloudflare uses `sandbox()` from `@emdash-cms/cloudflare`; each plugin gets a separate Worker through Worker Loader.
  - Without the `LOADER` binding, "registry browsing remains available, but config-managed sandboxed plugins do not load and install or update requests return `SANDBOX_NOT_AVAILABLE`."
- [Installing plugins](https://docs.emdashcms.com/plugins/installing/):
  - Consent dialog lists every permission; install verifies the publisher's signed records and the downloaded bundle before loading.
  - Updates require fresh confirmation when they add permissions/MCP tools or change an authenticated route to public.
  - Uninstall removes the bundle and stops loading; plugin storage data remains unless **Also delete plugin storage data** is selected.
- [Configuration reference](https://docs.emdashcms.com/reference/configuration/#registry):
  - `sandboxRunner` is required for `sandboxed: []`, marketplace and registry plugins.
  - With no explicit `registry`, EmDash uses the official aggregator only when `sandboxRunner` is set and `sandbox !== false`.
  - `registry: false` disables discovery while keeping the sandbox runner.
  - Named environments need `CLOUDFLARE_ENV` at **build** time so `sandbox()` reads the same environment.
- [Querying the registry](https://docs.emdashcms.com/plugins/registry-client/):
  - Discovery is public/read-only; pin `@emdash-cms/registry-client` exactly (the docs example shows `0.6.0`, but the current package is `0.7.1` and EmDash 1.3.1 already depends on `0.7.1` — see §4.4).
  - `requires` compatibility is evaluated with `@emdash-cms/registry-client/env`.
  - "Absence of a range is not compatibility"; `profile`/`release` can be `null`; URL schemes must be allow-listed by the consumer.

### 2.2 Sandbox, limits and Cloudflare requirements

- [Plugin sandbox](https://docs.emdashcms.com/deployment/plugin-sandbox/):
  - Cloudflare runner: `sandboxRunner: sandbox()`; requires **Workers Paid**, a `worker_loaders` binding, and `PluginBridge` exported from the Worker entry point.
  - Dynamic Workers are only available on Workers Paid; Worker Loader is **not** Workers for Platforms.
  - Per-invocation limits: **50 ms CPU**, **10 subrequests**, **30 s wall time**; memory is the platform isolate ceiling, not a per-plugin enforced value.
  - Sandbox database access talks to the D1 binding named **`DB`** directly, independent of the configured adapter; **Hyperdrive deployments cannot run sandboxed plugins**.
  - `sandbox: false` is refused on Cloudflare Workers; do not deploy it.
  - Missing binding/export causes `SANDBOX_NOT_AVAILABLE` and a startup warning naming the cause.
- [Capabilities and security](https://docs.emdashcms.com/plugins/creating-plugins/capabilities/):
  - Capabilities gate every host API; `network:request` is restricted to `allowedHosts`; `network:request:unrestricted` skips the allowlist for user-supplied URLs.
  - Sandboxed plugins cannot read host env, filesystem or bindings; storage/KV are scoped per plugin.
  - Consent is required for install and for permission-expanding updates.
- [Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/) (last updated 2026-06-11):
  - Workers Paid only.
  - 1,000 unique Dynamic Workers/month included; then **$0.002 per unique Dynamic Worker per day**.
  - Requests: 10M/month included, then $0.30/M; CPU: 30M ms/month included, then $0.02/M ms. These count toward the existing Workers bill.
  - A "unique Dynamic Worker" is per Worker ID + code; repeated invocations of the same id/code count once per day. EmDash's per-plugin sandbox should therefore not create a new id/code on every request, but this was not measured.

### 2.3 Admin roles

- [Admin panel](https://docs.emdashcms.com/concepts/admin-panel/): Admins can change plugins; Editors cannot. Server-side permission checks are the boundary.
- EmDash 1.3.1 role map (`@emdash-cms/auth@1.3.1`): `plugins:read = 40` (Editor), `plugins:manage = 50` (Admin).

---

## 3. Repository baseline (exact)

### 3.1 Versions

`package.json`:

| Package | Version |
| --- | --- |
| `emdash` | `1.3.1` |
| `@emdash-cms/cloudflare` | `1.3.1` |
| `astro` | `7.4.2` |
| `@astrojs/cloudflare` | `14.4.2` |
| `wrangler` | `4.152.0` |
| `@cloudflare/workers-types` | `5.20261024.1` |
| Node engine | `>=22.23.4 <23` |

`@astrojs/cloudflare` is 14.x, so the project uses `wrangler.jsonc` bindings, not the 15.x `cloudflare.config.ts` shape described in the docs.

### 3.2 `astro.config.mjs`

- `output: 'server'`, Cloudflare adapter with `imageService: 'passthrough'`.
- `emdash({ database: d1({binding:'DB', session:'disabled'}), auth: access({...}), storage: r2({binding:'MEDIA'}), plugins: [ ... ] })`.
- **No `sandboxRunner`.**
- **No `registry`.**
- **No `sandboxed: []`.**
- Four native plugins: `composer-members`, `composer-miniapps`, `composer-stacks`, `composer-resend`.

Consequence (source): `resolveRegistryConfigForSandbox()` returns `undefined` when `registry` is undefined and no `sandboxRunner` is configured (`node_modules/emdash/src/registry/config.ts:16-27`). The admin has no registry catalogue, by design, in this configuration.

### 3.3 `wrangler.jsonc`

| Binding | Root | Preview |
| --- | --- | --- |
| `DB` D1 | `app-composer-emdash` | `app-composer-emdash-preview` |
| `MEDIA` R2 | `app-composer-media` | `app-composer-media-preview` |
| `SESSION` KV | present | present |
| `GUESTBOOK` / `SHOWCASE` / `GUESTBOOK_MEMBERS` services | present | `services: []` |
| `worker_loaders` | **absent** | **absent** |
| Cron | `* * * * *` | none |

- `main: "./src/worker.ts"`.
- `compatibility_date: "2026-10-13"`; flags `nodejs_compat`, `global_fetch_strictly_public`.
- `preview_urls: false`.
- `limits.cpu_ms: 1000` for the site Worker (not the plugin sandbox's 50 ms limit).
- Root vars include `CF_ACCESS_TEAM_DOMAIN`, `PUBLIC_ORIGIN`, `RESOURCE_ACCOUNT_ID`, `RESOURCE_ENVIRONMENT`. `CF_ACCESS_AUDIENCE` is not declared in the file; it is supplied at runtime (the `access()` adapter reads the variable named by `audienceEnvVar`).
- Wrangler's own schema says `worker_loaders` is **not inherited** from the top-level environment and must be declared in every named environment (`node_modules/wrangler/config-schema.json`).

Consequence: adding `LOADER` only to the root would not enable the preview environment; adding it only to preview would not enable production. Each environment needs its own declaration and each build must select `CLOUDFLARE_ENV` correctly. The generated build artifact confirms the current state: `dist/server/wrangler.json` contains `"worker_loaders": []`.

### 3.4 Worker entry

`src/worker.ts`:

```ts
import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';
export { PluginBridge };
```

- The entry point prerequisite is **already satisfied**: `PluginBridge` is exported and `main` points at that file.
- The site Worker's `fetch` wrapper adds Access protection for `/_emdash`, canonical redirects, film assets and usage counters, then delegates to EmDash's handler. A sandboxed plugin cannot call this wrapper directly; it reaches the host through `PluginBridge`.

### 3.5 What is missing, in dependency order

1. `sandboxRunner: sandbox()` in `astro.config.mjs`.
2. `worker_loaders: [{ binding: "LOADER" }]` in `wrangler.jsonc` for each environment that should run plugins.
3. A Workers Paid entitlement that actually permits Dynamic Workers (documented account status suggests yes; **unverified**).
4. An explicitly authorised, isolated non-production EmDash app with its own D1/R2, where installs may be exercised.
5. An owner session with `plugins:manage` in that app.
6. A selected low-risk plugin and a #365 risk review.
7. A lifecycle receipt covering install → configure → disable → enable → update → uninstall → reinstall.

None of items 1–7 exists today. Item 3 may already be true but is not evidence.

### 3.6 Generated content sites are a separate, older baseline

`lib/content-model/site-template/` is the EmDash site shape Composer generates for content projects:

| Package | Template pin |
| --- | --- |
| `emdash` | `1.2.0` |
| `@emdash-cms/cloudflare` | `1.2.0` |
| `astro` | `7.3.5` |
| `@astrojs/cloudflare` | `14.3.3` |

- `src/worker.ts` already exports `PluginBridge`.
- `wrangler.jsonc` has `DB` and `MEDIA`, no `worker_loaders`.
- `astro.config.mjs` has no `sandboxRunner`/`registry`.

**Inference:** enabling registry installs for generated sites would require a template version bump to at least the EmDash/Cloudflare line that supports the documented sandbox, a new opt-in configuration choice, and a clear Workers Paid cost warning. It must not become the default, because it would turn a free-plan-friendly template into one that requires a paid plan.

---

## 4. Official runtime behaviour that determines readiness

### 4.1 Install gate

`handleRegistryInstall()` (`node_modules/emdash/src/api/handlers/registry.ts:512+`) refuses in this order when:

| Condition | Error code |
| --- | --- |
| Registry not configured | `REGISTRY_NOT_CONFIGURED` |
| No storage configured | `STORAGE_NOT_CONFIGURED` |
| No runner or runner unavailable | `SANDBOX_NOT_AVAILABLE` (message appends the cause) |
| Aggregator identity differs from request | `AGGREGATOR_IDENTITY_MISMATCH` |
| Release withdrawn | `RELEASE_YANKED` |
| Aggregator record CID/URI differs from authoritative PDS record | `AGGREGATOR_RECORD_MISMATCH` |
| Signed-record CIDs not acknowledged | `RECORD_CONSENT_REQUIRED` |
| Host compatibility fails | `ENV_INCOMPATIBLE` |
| Bundle checksum/id/version mismatch | `CHECKSUM_MISMATCH`, `MANIFEST_ID_MISMATCH`, `MANIFEST_VERSION_MISMATCH` |
| Plugin id collides with a build-time plugin | `PLUGIN_ID_COLLISION` |

With Composer's current config there is no registry catalogue at all (`REGISTRY_NOT_CONFIGURED` if an install were forced). If an explicit registry were configured without a runner, the blocking error would be `SANDBOX_NOT_AVAILABLE`, whose cause is `the worker has no worker_loaders binding named LOADER` (`node_modules/@emdash-cms/cloudflare/src/sandbox/runner.ts:200-207`).

### 4.2 What EmDash verifies (and the Trust Centre does not)

At install/update EmDash:

1. Resolves the publisher DID and reads the **signed profile and release records directly from the publisher's PDS** (`node_modules/emdash/src/registry/authoritative-records.ts`, `readAuthoritativePackageRelease`).
2. Rejects aggregator metadata that does not match those records (`AGGREGATOR_RECORD_MISMATCH`).
3. Enforces withdrawal labels (`security:yanked` / `security-yanked`, plus malformed-label fail-closed).
4. Requires exact profile/release CID acknowledgement from the consent dialog.
5. Fetches the artifact via the record-scoped cache or publisher PDS, enforces SSRF/size/redirect limits, and verifies the checksum against the release's multihash (`@emdash-cms/registry-verification/dist/artifact.js`).
6. Verifies bundle id/version against the release and reads the bundle's actual capabilities for the consent dialog.
7. Verifies build provenance when the publisher's release policy requires it (`provenance: verified | absent-optional`).
8. On update, diffs capabilities and route visibility against the installed bundle and requires fresh consent for escalations.

**Implication:** a Trust Centre that only reads discovery cannot claim any of steps 1–8. It can show evidence, not verification. This is why #365's snapshot is a curation overlay and why `INSTALL_NOT_TESTED` blocks overall GREEN.

### 4.3 Lifecycle semantics

| Action | Native surface | State effect | Data effect |
| --- | --- | --- | --- |
| Browse | Admin → Plugins/Registry | none | none |
| Install | Registry detail → consent | inserts `_plugin_state` row with `source='registry'`, `registry_publisher_did`, `registry_slug`, `version`; syncs runtime | stores bundle under `registry/<pluginId>/<version>/`; plugin storage created on use |
| Configure | Plugin settings / plugin page | plugin-specific | plugin storage |
| Disable | Plugins → Disable | `status='inactive'`, `deactivated_at` set | preserved |
| Enable | Plugins → Enable | `status='active'`, `activated_at` set | preserved |
| Check updates | Plugins → Check for updates | reads aggregator latest; **version-only** | none |
| Update | Update → consent | replaces bundle/version; capability/route diff gated | preserved |
| Uninstall | Uninstall → confirm | deletes `_plugin_state` row and bundle | `_plugin_storage` preserved unless "Also delete plugin storage data" |
| Reinstall | Registry install | new state row; existing storage may be reused | preserved unless deleted |

**Update-check limitation (source):** `handleRegistryUpdateCheck()` deliberately reports `hasCapabilityChanges: false` and `hasRouteVisibilityChanges: false` because computing them would require downloading both bundles; the real diff happens at update time (`registry.ts:1735-1750`). It also **silently skips** plugins whose aggregator lookup fails, so a Trust Centre must show per-package UNKNOWN rather than assume "no update".

### 4.4 Version alignment finding

`emdash@1.3.1` depends on `@emdash-cms/registry-client@0.7.1` (confirmed in `pnpm-lock.yaml` and `node_modules/emdash/package.json`), while the docs' install snippet still shows `0.6.0`. For this repo:

- Do **not** add `0.6.0`.
- If a direct dependency is needed for the Trust Centre, pin `0.7.1` to match the runtime, or import the transitive copy without adding a second version.
- Re-check this on every EmDash upgrade; the experimental API can change without notice.

---

## 5. Can Composer browse, install, or prove lifecycle today?

### 5.1 "Can browse the registry"

**Public API: yes, proven.** Live unauthenticated calls returned the documented shapes; the pinned client works against `https://registry.emdashcms.com`. See the companion report §2 and `evidence/`.

**Inside Composer's EmDash admin: no.** EmDash only shows the catalogue when `registry` is explicitly configured or a sandbox runner enables the default. Composer has neither. Adding `registry: "https://registry.emdashcms.com"` without a runner would technically make the catalogue browsable (docs), but it would also put install buttons in a production admin that can only fail with `SANDBOX_NOT_AVAILABLE`. That is not a readiness improvement and should not be shipped as one.

### 5.2 "Installation-ready"

**No.** Installation-ready means all of:

- [ ] Workers Paid / Dynamic Workers entitlement verified from a provider signal, not a document.
- [ ] `worker_loaders` with binding `LOADER` in the selected environment.
- [ ] `sandboxRunner: sandbox()` in the build that deploys that environment.
- [ ] `PluginBridge` exported from `main` (already true).
- [ ] `DB` D1 and `MEDIA` R2 storage available to that app.
- [ ] Admin role 50 with `plugins:manage`.
- [ ] An explicitly authorised **isolated** app, not production.
- [ ] A selected plugin that passed #365 review.
- [ ] A lifecycle plan and receipt owner.

Only the `PluginBridge` item is true today. Do not label Composer "install ready".

### 5.3 "Actually installed / updated / disabled / uninstalled in an isolated test"

**No.** Nothing was installed anywhere. No `_plugin_state` row was created. No lifecycle receipt exists. #369's second acceptance checkbox remains unticked.

---

## 6. Blockers (exact)

### Blocker 1 — Missing sandbox configuration in Composer

- `astro.config.mjs` has no `sandboxRunner`.
- `wrangler.jsonc` has no `worker_loaders` in root or preview.
- With an explicit registry configured but no runner/binding, install/update returns `SANDBOX_NOT_AVAILABLE`; cause: `the worker has no worker_loaders binding named LOADER`. In the current config the earlier gate is `REGISTRY_NOT_CONFIGURED`, because no catalogue is configured at all.
- This is a code/config change, not a research action. It affects the live production Worker and must go through the normal reviewed release, not this run.

### Blocker 2 — No authorised isolated target

#369 explicitly says production is not the first test target. A real lifecycle test needs a separately named EmDash app with independent D1/R2 and its own bindings. This run has no authority to create or deploy one. Composer's `preview` environment is not a substitute: `docs/operator-reference.md:199` records that preview has no audience and remains closed, and `src/lib/access-boundary.mjs` denies every `/_emdash` request without a valid Access JWT. The preview admin is therefore closed by design, not an install lab.

### Blocker 3 — Paid entitlement is unverified

- Documentation: Worker Loader / Dynamic Workers require **Workers Paid**.
- Repo documentation: `docs/operator-reference.md:217` says the account is an "existing paid Workers/R2 account" and mentions a US$5 usage alert.
- Provider evidence in this run: **none**. No Cloudflare API call, no billing read, no entitlement probe.
- Therefore: "paid" is a plausible but unverified premise. A deployment attempt without the entitlement would fail at the Cloudflare layer; a local Node test would not prove the Cloudflare path.

### Blocker 4 — Version skew in generated sites

The content-site template is on EmDash `1.2.0` / Cloudflare adapter `1.2.0` / Astro `7.3.5`. Composer itself is on `1.3.1` / `1.3.1` / `7.4.2`. A single readiness claim cannot cover both. The template needs its own upgrade and opt-in decision before any "supported Composer-created site" claim.

### Blocker 5 — No owner session or lifecycle authority

Installing requires a signed-in Admin with `plugins:manage`. This run has no Access session and must not create one. The lifecycle test also executes third-party code, which is beyond read-only research authority.

### Blocker 6 — No advisory or install evidence

Even if configuration were enabled, #369's "demonstrably works" checkbox needs real receipts. #365's overall GREEN also depends on #369. Neither exists yet.

### The entitlement question

| Path | Paid entitlement | Other authority |
| --- | --- | --- |
| Cloudflare Worker Loader | **Yes** — Workers Paid is documented as required for Dynamic Workers | An explicitly authorised, isolated non-production app/account target; owner admin session; plugin execution authority |
| Node `workerd` runner | **No** | Explicit authority to execute third-party plugin code in an isolated local root; `workerd` binary; no production data/credentials |

So: the Cloudflare path is gated by both payment and test authority; the Node path avoids payment but is weaker evidence and still needs execution authority. Neither is granted by this report.

---

## 7. Smallest supported readiness + native install path

### 7.1 Step 0 — read-only readiness command (can ship now)

Add `scripts/plugin-readiness.mjs` (or a subcommand of the existing readiness tooling) that performs **no network and no provider calls**:

Inputs:

- `package.json` pins for `emdash`, `@emdash-cms/cloudflare`, `astro`, `@astrojs/cloudflare`.
- `astro.config.mjs` presence of `sandboxRunner`, `registry`, `sandboxed`.
- `wrangler.jsonc` `worker_loaders`, `DB`, `MEDIA` for the selected environment.
- `src/worker.ts` `PluginBridge` export and `main` target.
- `CF_ACCESS_AUDIENCE` presence only as a boolean (never the value).

Outputs one of:

| State | Meaning |
| --- | --- |
| `browse-only` | Explicit registry configured, no usable runner; catalogue may render but installs will fail |
| `needs-binding` | Runner configured but no `LOADER` in the selected environment |
| `needs-entitlement` | Binding/config present; plan entitlement not proven |
| `installation-ready` | All local prerequisites present **and** an owner/provider entitlement assertion is recorded |
| `unavailable` | Missing storage, missing `PluginBridge`, unsupported adapter, or wrong versions |

Include the exact missing item and the docs link. Do not call Cloudflare to guess the plan. A `--json` report is enough; do not wire it into Get Ready's authority until the check is proven.

### 7.2 Step 1 — isolated Cloudflare acceptance (requires authority)

On a separately named, non-production EmDash app at the same `emdash@1.3.1` / `@emdash-cms/cloudflare@1.3.1` line:

1. Own D1 `DB`, own R2 `MEDIA`, own Worker name and hostname.
2. `wrangler.jsonc`:

   ```jsonc
   {
     "main": "./src/worker.ts",
     "worker_loaders": [{ "binding": "LOADER" }],
     "d1_databases": [{ "binding": "DB", "database_name": "...", "database_id": "..." }],
     "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "..." }]
   }
   ```

3. `astro.config.mjs`:

   ```js
   import { sandbox } from "@emdash-cms/cloudflare";
   emdash({
     database: d1({ binding: "DB" }),
     storage: r2({ binding: "MEDIA" }),
     sandboxRunner: sandbox(),
     // Optional: explicit aggregator + release-age holdback.
     registry: {
       aggregatorUrl: "https://registry.emdashcms.com",
       policy: { minimumReleaseAge: "48h" },
     },
   });
   ```

4. Build with the correct `CLOUDFLARE_ENV` for the environment; deploy; confirm startup logs do **not** contain the sandbox warning.
5. Sign in as Admin (role 50); open the native Plugins area; confirm the Registry catalogue renders.
6. Install one low-risk plugin selected after #365 review. Selection criteria: no network/write/email/users capability, an explicit `requires` range that includes EmDash 1.3.1, `releaseHistoryComplete: true`, at least one prior release, and a current `listing-passed` release label. Record the exact profile/release CIDs, capabilities, hosts and bundle checksum.
7. Exercise: configure → disable → enable → update (with a release that has a capability diff, if available) → uninstall preserving data → reinstall → uninstall deleting data on a disposable second pass.
8. Record exact source, Worker identity, app environment, package DID/slug/version/release CID, `_plugin_state` transitions, and storage-preservation results. Feed #11 and #369.

Do not do this on `composer.loftwah.com` first. Do not enable it on all generated sites.

### 7.3 Step 2 — local Node/workerd alternative (no paid entitlement)

This is the safe fallback if the Cloudflare entitlement or isolated target is unavailable. It is **not** equivalent evidence.

- New temporary project with `emdash@1.3.1`, `@emdash-cms/sandbox-workerd@0.9.5` (published metadata: depends on `emdash@1.3.1`), `workerd` (resolved and pinned in the lab lockfile), and the Astro/Node adapter versions compatible with `astro@7.4.2`.
- Config: local SQLite database, local storage, `sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox"`.
- Verify `./node_modules/.bin/workerd --version` runs on the host.
- Use a fictional/disposable database; no production data, credentials or service bindings.
- Use the native EmDash admin to install/disable/enable/update/uninstall one reviewed plugin.
- What it proves: the native admin journey, consent, `_plugin_state` transitions, storage preservation, and the plugin's actual admin/public effect on Node.
- What it does **not** prove: Worker Loader isolation, 50 ms CPU / 10 subrequest enforcement, D1 `PluginBridge` behaviour, Workers Paid, Cloudflare egress or production routing.
- Cleanup: one owned temp root, register cleanup at start, kill the server/workerd, remove the root on success and failure, keep only bounded JSON/Markdown receipts under ignored `output/`.

The repo already has a precedent for a bounded local EmDash admin lab: `labs/invited-members/run.mjs` uses one owned temp root, a local SQLite database and cleanup on failure. Reuse that pattern rather than inventing a second harness.

### 7.4 Step 3 — Composer opt-in (after Steps 1–2)

- Only after a lifecycle receipt exists, add an explicit owner opt-in to the relevant Composer site/environment.
- Recommendations from #363 (WordPress capability mapping) and #365 (dated trust evidence) should deep-link into the site's native EmDash Plugins area with a clear site/environment label; do not mirror the catalogue in Composer.
- Never propagate install state across apps, workspaces or environments.
- Keep native `plugins: []` unchanged; enabling the sandbox must not move existing native plugins into the sandbox.
- Show the Workers Paid / Dynamic Workers cost before enabling; no silent subscription or resource creation.
- Keep the public site independent of the registry: a discovery or Trust Centre outage must not affect published pages.

---

## 8. Lifecycle acceptance matrix (#369)

| Case | Expected | Evidence to capture |
| --- | --- | --- |
| Browse | Registry catalogue renders with publisher DID/slug/version | screenshot/DOM + exact URL, environment |
| Install | Consent shows CIDs, capabilities, hosts; install succeeds | request/response codes, `_plugin_state` row, R2 prefix |
| Configure | Settings persist; public/admin effect visible | before/after values, rendered output |
| Disable | Plugin stops loading; state `inactive`; data preserved | page/route behaviour, state row |
| Enable | Plugin resumes; state `active`; data preserved | same |
| Update (no expansion) | Version changes; consent as documented | old/new version, bundle hash |
| Update (expansion) | Requires fresh consent; refusal leaves old version | added capability/host/public route, old version still active |
| Uninstall (keep data) | State row/bundle removed; `_plugin_storage` preserved | row counts before/after, reinstall sees data |
| Uninstall (delete data) | Storage rows removed | row counts |
| Reinstall | Works; data behaviour matches choice | state/version/storage |
| Denied `plugins:manage` | Editor cannot install/update/uninstall | 403, no state change |
| Missing `LOADER` | `SANDBOX_NOT_AVAILABLE`; no state change | exact error/cause |
| Free plan | Deploy or runtime refuses Worker Loader; no install | provider error, no workaround |
| Withdrawn release | `RELEASE_YANKED`; no install/update | label state, error |
| Aggregator mismatch | `AGGREGATOR_RECORD_MISMATCH`; no install | CID mismatch fixture |
| Incompatible `requires` | `ENV_INCOMPATIBLE`; no install | range vs 1.3.1 |
| Public-route expansion | Update requires consent; refusal keeps old version | route diff |
| Registry offline | Admin shows UNKNOWN/upstream link; installed plugins still run | failure injection |
| Cross-site isolation | Site A cannot read Site B inventory | two app instances, denied request |

No row has been executed. This is the plan, not a receipt.

---

## 9. Costs and authority

- **Cloudflare:** Worker Loader requires Workers Paid. Dynamic Workers: 1,000 unique/month included, then $0.002/unique/day; requests/CPU at Workers Standard rates. The existing US$5 usage alert is an alert, not a cap.
- **Plugin price:** registry-wide "free for now" (2026-09-28) does not cover API keys, payment processing, email, AI or Pro tiers. Each plugin's external cost is UNKNOWN unless the publisher states it in a structured field (none exists today).
- **Authority:** no new paid resource, subscription, Worker, database, bucket, secret or Access policy was created or changed. A real test needs MP authorisation for the isolated target and any entitlement change; an agent must not infer that from this report.

---

## 10. Remaining gates

1. Provider-verified Workers Paid / Dynamic Workers entitlement.
2. A reviewed change adding `sandboxRunner` + `LOADER` to an isolated app (not production first).
3. An owner-administered lifecycle run with a #365-reviewed plugin.
4. A receipt covering install/configure/disable/enable/update/uninstall/reinstall and data-preservation choices.
5. A separate decision (and release) for generated content sites, including the EmDash 1.2.0 → 1.3.x upgrade and an explicit paid-plan opt-in.
6. #365 Trust Centre evidence linked to the exact lifecycle receipt.
7. A manual runbook and reproducible receipts covering desktop/mobile and error states, feeding #11, #365 and #363.
8. #11 canonical release identity for any Composer runtime change.

---

## 11. Sources

**Official documentation (fetched 2026-10-25 UTC)**

- [The plugin registry](https://docs.emdashcms.com/plugins/registry/)
- [Installing plugins](https://docs.emdashcms.com/plugins/installing/)
- [Plugin sandbox](https://docs.emdashcms.com/deployment/plugin-sandbox/)
- [Configuration reference — sandboxRunner / registry](https://docs.emdashcms.com/reference/configuration/#sandboxrunner)
- [Querying the registry](https://docs.emdashcms.com/plugins/registry-client/)
- [Capabilities and security](https://docs.emdashcms.com/plugins/creating-plugins/capabilities/)
- [Bundling and publishing](https://docs.emdashcms.com/plugins/creating-plugins/publishing/)
- [Admin panel](https://docs.emdashcms.com/concepts/admin-panel/)
- [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/)
- [Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/)
- [EmDash registry launch post, 2026-09-28](https://emdashcms.com/blog/emdash-plugin-registry)

**Live evidence**

- `output/parallel-run-20261025/research/evidence/registry-search.json`
- `output/parallel-run-20261025/research/evidence/registry-search-headers.txt`
- `output/parallel-run-20261025/research/evidence/resolve-*.json`
- `output/parallel-run-20261025/research/evidence/getLatestRelease-*.json`
- `output/parallel-run-20261025/research/evidence/listReleases-*.json`
- `output/parallel-run-20261025/research/evidence/probe-*.json`
- `output/parallel-run-20261025/research/evidence/bundle-inspection.json`
- `output/parallel-run-20261025/research/evidence/summary.json`

**Repository source**

- `package.json` — Composer pins
- `astro.config.mjs` — no `sandboxRunner`, no `registry`
- `wrangler.jsonc` — no `worker_loaders`; root/preview bindings
- `src/worker.ts` — `PluginBridge` export and wrapper
- `src/lib/access-boundary.mjs` — `/_emdash` Access gate
- `lib/content-model/site-template/package.json` — generated-site pins 1.2.0/7.3.5
- `lib/content-model/site-template/wrangler.jsonc` — no `worker_loaders`
- `lib/content-model/site-template/src/worker.ts` — `PluginBridge` exported
- `docs/operator-reference.md:27` — supported versions
- `docs/operator-reference.md:199` — preview has no audience and remains closed
- `docs/operator-reference.md:217` — existing paid Workers/R2 account (documentary, not provider-verified)
- `docs/platform/field-guide.md:154` — Node vs Worker Loader limits and D1 caveat
- `docs/platform/runtime-qualification.md:48` — "Worker Loader support and budgets need independent tests"
- `node_modules/emdash/src/registry/config.ts` — default aggregator and sandbox gating
- `node_modules/emdash/src/api/handlers/registry.ts` — install/update/uninstall gates and update-check limitation
- `node_modules/emdash/src/registry/authoritative-records.ts` — signed-record verification path
- `node_modules/@emdash-cms/cloudflare/src/index.ts:557` — `sandbox()` build-time check
- `node_modules/@emdash-cms/cloudflare/src/sandbox/runner.ts:200` — availability causes
- `node_modules/wrangler/config-schema.json` — `worker_loaders` non-inheritance
- `pnpm-lock.yaml` — `@emdash-cms/registry-client@0.7.1`
- `labs/invited-members/run.mjs` — bounded local EmDash lab precedent
