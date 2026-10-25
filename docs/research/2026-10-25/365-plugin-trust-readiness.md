# EmDash Plugin Trust Centre — readiness report

**Issue:** [#365](https://github.com/loftwah/app-composer/issues/365) — EmDash Plugin Trust Centre
**Dated:** 2026-10-25 UTC (observed 06:01–06:10 UTC)
**Lane:** parallel run R5 (ledger lane E/F), read-only research
**Repository inspected:** `loftwah/app-composer`, HEAD `d9f4dfd1456da10ead2d65951079f1e9606e9fc0` at inspection. The worktree also contains uncommitted work from other lanes; the files this report relies on (`package.json`, `wrangler.jsonc`, `astro.config.mjs`, `src/worker.ts`, `src/lib/creator-plugin.ts`) are unmodified in `git status`.
**Report path:** `output/parallel-run-20261025/research/365-plugin-trust-readiness.md`
**Companion report:** `output/parallel-run-20261025/research/369-registry-lifecycle-readiness.md`

## Evidence boundary

This report separates four kinds of evidence and labels them throughout:

1. **Official documentation** — current EmDash and Cloudflare pages fetched 2026-10-25 UTC.
2. **Live unauthenticated registry evidence** — real `GET` requests to the public aggregator and two artifact downloads, recorded under `output/parallel-run-20261025/research/evidence/`. No credentials, cookies, tokens or provider writes were used.
3. **Repository source evidence** — exact files and lines in this checkout.
4. **Inference** — reasoning from the above, explicitly marked.

What was **not** done, and is therefore not claimed:

- No plugin was installed, updated, enabled, disabled or uninstalled anywhere.
- No production or preview D1/R2/KV was read or written. `_plugin_state` contents for the live Composer site are **unknown**.
- No EmDash admin session or Cloudflare Access session was used.
- No advisory database, CVE feed, GitHub API call or SBOM service was queried.
- No new EmDash plugin was created. #366 remains conditional.
- No marketplace, installer, auto-update path or privileged execution route was built.

Registry responses are untrusted data. Package descriptions, URLs, labels and error text are publisher- or aggregator-supplied; this report reads only structural fields, identifiers, versions, declared access and hashes.

---

## 1. Verdict

1. **The official registry is real, public and readable without authentication.** The catalog is `https://plugins.emdashcms.com`; the default aggregator is `https://registry.emdashcms.com`; discovery is AT Protocol XRPC under `com.emdashcms.experimental.aggregator.*`. Live `searchPackages`, `resolvePackage`, `getLatestRelease` and `listReleases` calls returned `200` with the documented shapes.
2. **Discovery evidence is enough for an honest inventory and a useful first risk screen, not for a security guarantee.** Publisher DID, slug, version, release CID, bundle SHA-256 multihash, declared-access categories, `requires`, history completeness and moderation labels are available. Signatures, exact capability lists, advisories, publisher verification and install results are **not** available from discovery.
3. **The exact permission list is only in the bundle manifest.** The release record's `declaredAccess` is a coarse projection. For Freeform 0.1.4, discovery shows `network.request: {}`; the bundle manifest shows `network:request:unrestricted` with an empty host list plus `email:send`. A Trust Centre that reads only registry metadata would understate this. This is the single most important design constraint in this report.
4. **This repository has no plugin-inventory read path today.** EmDash owns `_plugin_state`; no authored Composer source reads it. `creator_*` tables are Composer app/workspace data, not plugin inventory. The only installed plugins are four **native** plugins declared statically in `astro.config.mjs`.
5. **A small read-only slice can ship now without becoming a marketplace.** Recommended: a dated, committed discovery snapshot + a pure evaluator + one native admin page on the existing `composer-stacks` plugin, behind `plugins:manage` / role 50, reading `_plugin_state` read-only and linking to EmDash's native installer. No install buttons, no runtime registry dependency for public pages, no new plugin.
6. **Under the proposed policy, Freeform is RED and Stripe Checkout is AMBER today.** RED here means "not acceptable under this policy without an owner exception", not "malicious". No package can be overall GREEN in policy v1 because there is no advisory feed and no completed native install receipt; dimension-level greens are still shown.
7. **The Trust Centre must not replace EmDash verification.** EmDash verifies the publisher's signed records directly from the PDS, the bundle checksum, name/version and permissions at install time. The Trust Centre is a dated curation overlay over the public index; it must say so on every screen.

---

## 2. The real registry and its read-only discovery API

### 2.1 Identity of the service

| Fact | Evidence |
| --- | --- |
| Public catalog | `https://plugins.emdashcms.com/search` — official page, live, "All plugins 100+ in the registry" (fetched 2026-10-25) |
| Default aggregator | `https://registry.emdashcms.com` — EmDash docs and `node_modules/emdash/src/registry/config.ts` (`DEFAULT_REGISTRY_AGGREGATOR_URL`) |
| Protocol | AT Protocol records published in the publisher's own Atmosphere account; aggregator indexes the firehose for `pm.fair.package.*` and `com.emdashcms.*` (`node_modules/emdash/src/registry/types.ts:19`) |
| Record collections | `com.emdashcms.experimental.package.profile`, `...package.release`, `...publisher.profile`, `...publisher.verification` (`@emdash-cms/registry-lexicons@0.7.0`, `RECORD_NSIDS`) |
| Discovery methods | `com.emdashcms.experimental.aggregator.searchPackages`, `getPackage`, `resolvePackage`, `listReleases`, `getLatestRelease` (`QUERY_NSIDS`) |
| Authentication | None for discovery. Live responses carried `access-control-allow-origin: *`, `cache-control: private, no-store`; no `authorization` header was sent |
| Client | `@emdash-cms/registry-client@0.7.1` is already in this repo's lockfile as a transitive dependency of `emdash@1.3.1` |

Docs: [plugin registry](https://docs.emdashcms.com/plugins/registry/), [querying the registry](https://docs.emdashcms.com/plugins/registry-client/), [configuration reference](https://docs.emdashcms.com/reference/configuration/#registry).

### 2.2 Live probes (unauthenticated, 2026-10-25)

All requests used `https://registry.emdashcms.com/xrpc/<nsid>` with a bounded timeout and a research user agent. Raw responses are in `output/parallel-run-20261025/research/evidence/`.

| Probe | Status | Observed shape / size |
| --- | --- | --- |
| `searchPackages?limit=5` | `200` | `{ packages: PackageView[5], cursor }`, 8,076 bytes |
| `searchPackages?limit=100` | `200` | `{ packages: PackageView[100], cursor }`, ≈383 KB JSON |
| `searchPackages?q=@solspace.com/freeform&limit=5` | `200` | exact package selected, 6,180 bytes |
| `searchPackages?limit=101` | `400` | `InvalidRequest`; limit must be 1–100 |
| `resolvePackage?handle=solspace.com&slug=freeform` | `200` | `PackageView`, 6,239 bytes |
| `getLatestRelease?did=did:plc:tsp7…&package=freeform` | `200` | `ReleaseView`, 1,598 bytes |
| `listReleases?did=did:plc:tsp7…&package=freeform&limit=5` | `200` | `{ releases: ReleaseView[2] }`, no cursor |
| `resolvePackage?handle=ecommerceave.com&slug=emdash-stripe-checkout` | `200` | `PackageView`, 3,204 bytes |
| `getLatestRelease?did=did:plc:wlshat…&package=emdash-stripe-checkout` | `200` | `ReleaseView`, 1,501 bytes |
| `listReleases?did=did:plc:wlshat…&package=emdash-stripe-checkout&limit=5` | `200` | `{ releases: ReleaseView[5], cursor }`, 7,626 bytes |
| `getPackage` with unknown slug | `404` | `{ error: "NotFound", message }` |
| `resolvePackage` with unknown handle | `404` | `{ error: "HandleNotFound", message }` |
| `searchPackages` with `atproto-accept-labelers: did:web:labels.emdashcms.com` | `200` | accepted; same shape |
| `labeler.getPolicy` on the aggregator host | `404` | not exposed at that path; not needed for this slice |

Budget note: one full page of 100 packages is ~383 KB. The Trust Centre must query the pinned curated set directly (`resolvePackage` ≈ 3–6 KB each), not paginate the whole registry on every page view.

Reproduction (no auth header, bounded timeout):

```sh
curl -sS --max-time 20 -D headers.txt -o body.json \
  'https://registry.emdashcms.com/xrpc/com.emdashcms.experimental.aggregator.searchPackages?limit=5'

curl -sS --max-time 20 -o freeform.json \
  'https://registry.emdashcms.com/xrpc/com.emdashcms.experimental.aggregator.resolvePackage?handle=solspace.com&slug=freeform'

curl -sS --max-time 20 -o latest.json \
  'https://registry.emdashcms.com/xrpc/com.emdashcms.experimental.aggregator.getLatestRelease?did=did:plc:tsp7az5h6qsqjzqsgz37wonx&package=freeform'
```

Parameter values must be URL-encoded in code; the shell examples are the literal public identifiers.

### 2.3 Response shapes that matter

**PackageView** (from `@emdash-cms/registry-lexicons@0.7.0`, `aggregator/defs`):

```
uri, cid, did, slug,
handle?, latestVersion?, historicalReleaseCount?, releaseHistoryComplete?,
indexedAt, labels?, profile (untrusted record)
```

**ReleaseView**:

```
uri, cid, did, package, version,
release (untrusted record),
artifactCaches?, indexedAt, labels?
```

**Release record** (validated fields used here):

```
$type, package, version,
artifacts.package.{url|blob, checksum, contentType, size?},
requires? { "env:emdash": ">=1.0.0", ... },
repo?,
extensions["com.emdashcms.experimental.package.releaseExtension"].declaredAccess?
```

**Checksum encoding:** the checksum is a multibase base32 CIDv1 containing a SHA-256 multihash (`0x12 0x20` + 32 bytes). It is a digest of the **bundle bytes**, not of the signed record. It can be checked without trusting the aggregator, provided the bytes come from a source the client accepts. For the two examples below it matched exactly.

**Trust boundary:** EmDash treats the aggregator as an untrusted index. At install it re-reads the publisher's signed profile and release records directly from the publisher's PDS, compares the aggregator's `uri`/`cid` with the authoritative records, and rejects `AGGREGATOR_RECORD_MISMATCH` (`node_modules/emdash/src/api/handlers/registry.ts:737`). Discovery CIDs are useful evidence, but they are **not** a substitute for that check.

### 2.4 Error handling rules for the Trust Centre

- A `null` profile or `null` release (the client surfaces a relayed record that fails lexicon validation as `null`) is **UNKNOWN**, not an empty package.
- `400` / `404` / `5xx` and malformed JSON must become **UNKNOWN** for that package, with the last successful observation retained.
- Raw aggregator or publisher error text must never be rendered. It can echo the requested handle (observed: `Could not resolve handle 'nonexistent.invalid'…`), so it is attacker-influenced text.
- URL fields from profiles/releases must be scheme-checked (`https:` only) before rendering, per the registry-client docs' explicit "validate URL schemes yourself" warning.
- A stale snapshot (older than 14 days) is **UNKNOWN**, not the last colour.

---

## 3. What evidence is actually available

| Evidence | Available from discovery? | Verified in this run? | Trust Centre treatment |
| --- | --- | --- | --- |
| Publisher DID | Yes — part of the AT URI and `did` field | Structural only | Stable identity; never display a handle as authoritative |
| Handle | Yes, best-effort | No handle→DID resolution performed | Display as mutable; `Handle unavailable` when absent |
| Package slug | Yes | Yes | Stable identity with DID |
| Latest non-yanked version | Yes (`getLatestRelease`) | Yes | Show version and `indexedAt` |
| Release CID / profile CID | Yes | Yes | Show as record identity; not a signature |
| Bundle checksum | Yes | **Yes for two bundles** — downloaded, SHA-256 recomputed, matched | Show `digest present`; `verified at <time>` only with a bundle receipt |
| Publisher signature / signed commit proof | No — not in the discovery view | No | **UNKNOWN**; EmDash verifies at install |
| Exact capabilities / allowed hosts | No — only in the bundle manifest | **Yes for two bundles** (read-only manifest inspection) | `UNKNOWN` unless an inspection receipt exists |
| Declared-access categories | Yes — release extension | Yes | Show verbatim; coarse, publisher-declared |
| Compatibility (`requires`) | Yes when declared | Evaluated against EmDash 1.3.1 / Astro 7.4.2 | Absence is **UNKNOWN**, not compatible |
| Release history | Yes (`listReleases`, `historicalReleaseCount`, `releaseHistoryComplete`) | Yes | Incomplete history is AMBER; never infer abandonment from low churn alone |
| Yank / withdrawal | Yes via labels; evaluated by `evaluateRegistryReleaseWithdrawal` | Both examples not withdrawn | Withdrawn/malformed is RED |
| Advisories / CVE / SBOM | **No API or field** | No | **UNKNOWN**; overall GREEN is unreachable in v1 |
| Publisher verification | Not in discovery; verified at install | No | **UNKNOWN** |
| Price / paid tier | No field. Registry-wide "free for now" statement dated 2026-09-28 | No | `free-for-now` + `external cost UNKNOWN` |
| Source repository / licence / security contact | Yes, publisher-supplied profile fields | Presence only, not verified | Show as claims; missing is AMBER |
| Maintainer responsiveness | No | No | **UNKNOWN** |
| Installed / tested on this site | No | No | **UNKNOWN** until #369 receipt |

---

## 4. Worked examples (live data, 2026-10-25)

### 4.1 Freeform — `@solspace.com/freeform`

| Field | Value |
| --- | --- |
| DID | `did:plc:tsp7az5h6qsqjzqsgz37wonx` |
| Latest version | `0.1.4` |
| Release CID | `bafyreidigbuiafcrujs3c6vzlcdripd5fzyon57ujycvu7telfgjq6nl6e` |
| Package labels | `listing-overridden`, `listing-review`, `listing-passed` (package level; the 0.1.4 release label is `listing-passed`) |
| `requires` | `{ "env:emdash": ">=1.0.0" }` |
| History | `historicalReleaseCount: 2`, `releaseHistoryComplete: false` |
| Licence / repo | MIT; `https://github.com/solspace/emdash-freeform` (publisher claim) |
| Release `declaredAccess` | `network.request: {}`, `email.send: {}` |
| Bundle manifest (inspected) | `network:request:unrestricted`, `network:request`, `email:send`; `allowedHosts: []` |
| Artifact | `https://cdn.jsdelivr.net/npm/@solspace/freeform-plugin-dist@0.1.4/freeform-0.1.4.tar.gz`, 52,597 bytes |
| SHA-256 | `39f94fa80e6942474baa1e416f5cf73f2c08b23059d87a2399429bc9cae6c61c` — matches the release checksum |
| Withdrawal evaluation | `{ withdrawn: false, malformed: false }` |
| Compatibility | Range satisfied by EmDash 1.3.1 → dimension GREEN |
| Policy result | **RED** — unrestricted egress under policy v1; AMBER on incomplete history, optional provenance and recent index time |

The important lesson: discovery alone would have shown only "network + email". The bundle shows **unrestricted** network access with no host allowlist. Freeform is a legitimate forms plugin and may need user-configured webhooks; RED is a policy state that requires an explicit owner exception, not an accusation. The UI must phrase it as "policy-blocked: unrestricted egress; owner exception required".

Label scope: the policy evaluates the **selected release's** labels through `evaluateRegistryReleaseWithdrawal()`. Package-level labels are shown as context (Freeform's package view carries `listing-review` and `listing-overridden`, while its 0.1.4 release view is `listing-passed`) and never override a release-level pass/fail. A package-level review label should still be visible in the detail view, because it is useful context, but it is not silently treated as a release failure.

### 4.2 Stripe Checkout — `@ecommerceave.com/emdash-stripe-checkout`

| Field | Value |
| --- | --- |
| DID | `did:plc:wlshattmcjplayfxlgzbhxvk` |
| Latest version | `0.10.3` |
| Release CID | `bafyreidqkabnn2a3geylff3qjk7jn4p7kcckxwhiav4eregsp5x2rdubvi` |
| Package/release labels | `listing-passed` |
| `requires` | absent |
| History | `historicalReleaseCount: 16`, `releaseHistoryComplete: true` |
| Licence / repo | MIT; `https://github.com/ecommerceave/emdash-stripe-checkout` (publisher claim) |
| Release `declaredAccess` | `content.read`, `content.write`, `schema.read`, `media.read`, `network.request.allowedHosts: ["api.stripe.com"]` |
| Bundle manifest (inspected) | `content:read`, `content:write`, `schema:read`, `media:read`, `network:request`; hosts `["api.stripe.com"]` |
| Artifact | record-scoped blob cache `https://cdn.em-da.sh` (publisher PDS fallback), 17,509 bytes (declared size 17,509) |
| SHA-256 | `284fbb37df6e74a6b54b68efcbb9d030aef9e97c20ca47dfaf6f0af774411037` — matches the release checksum |
| Withdrawal evaluation | `{ withdrawn: false, malformed: false }` |
| Compatibility | No `requires` → **UNKNOWN**, not "compatible" |
| Policy result | **AMBER** — broad content write plus restricted egress need owner review; no declared compatibility; latest record indexed < 7 days ago |

Financial note: the plugin is MIT and free-for-now, but Stripe charges transaction fees. The registry exposes no price field, so the Trust Centre shows `external cost: UNKNOWN` and links to Stripe's own pricing; it must not infer "free".

---

## 5. This repository's installed-plugin inventory read path

### 5.1 What exists

| Layer | Location | Owner | Private? | Used by Trust Centre? |
| --- | --- | --- | --- | --- |
| EmDash plugin state | D1 table `_plugin_state` | EmDash core migrations (`004_plugins`, `022_marketplace_plugin_state`, `038_registry_plugin_state`, `053_plugin_mcp_tools`) | Yes — only behind `/_emdash` auth | Yes, read-only columns |
| EmDash plugin data | D1 table `_plugin_storage` | EmDash core / individual plugin | Yes | **No** — never read another plugin's data |
| EmDash plugin indexes | `_plugin_indexes` | EmDash core | Yes | No |
| Configured native plugins | `astro.config.mjs` `plugins: [...]` | This repo | Build config, not public | Yes, static list only |
| Composer workspaces/stacks | `creator_workspaces`, `creator_members`, `creator_stacks`, `creator_stack_publications` | This repo migrations `0003`/`0004` | Yes; published stack documents are public by design | No |
| Composer resources/outcomes | `creator_app_resources`, `creator_stack_resource_bindings`, `creator_resource_operations`, `creator_outcome_*` | This repo migrations `0006`/`0009` | Yes | No |
| Composer provider inventory | `src/lib/resource-inventory.ts`, `src/lib/provider-read.ts` | This repo | Yes | No — Cloudflare resources, not EmDash plugins |

**Authored-source finding:** `grep -rn "_plugin_state" --exclude-dir=node_modules --exclude-dir=dist` returns only generated `dist/` chunks and documentation/test references. No authored Composer module reads the table today. The live table's contents are therefore unknown to this report.

`_plugin_state` shape (EmDash 1.3.1, `node_modules/emdash/src/database/types.ts:530`):

```
plugin_id, version, status, installed_at, activated_at, deactivated_at,
data, source ('config'|'marketplace'|'registry'),
marketplace_version, display_name, description,
registry_publisher_did, registry_slug, mcp_tools_enabled, mcp_tools_consent
```

Registry installs are keyed by an opaque `r_` + truncated SHA-256(publisher DID + "\n" + slug) id; the DID and slug are retained in the two registry columns, which is how a Trust Centre should join inventory to discovery (`node_modules/emdash/src/registry/plugin-id.ts`).

### 5.2 Configured plugins in this repo

`astro.config.mjs` declares four **native, in-process** plugins at version `1.0.0`:

| Plugin id | Entry | Admin page | Permission |
| --- | --- | --- | --- |
| `composer-members` | `src/plugins/members.ts` | none | native plugin routes |
| `composer-miniapps` | `src/plugins/miniapps.ts` | `/apps` → "Manage mini-apps" | `plugins:manage` on read/write routes; `src/lib/miniapp-admin.mjs:95` also requires role `50` |
| `composer-stacks` | `src/plugins/stacks.ts` → `src/lib/creator-plugin.ts` | 12 pages incl. `/stacks`, `/resources`, `/proposals` | `content:read_drafts` plus workspace capability checks |
| `composer-resend` | `src/plugins/resend.ts` | none | email-transport hook |

None of these is a registry plugin, none has a `sandboxRunner`, and none is installed from the registry. `PluginBridge` is exported from `src/worker.ts:16`, so the entry-point prerequisite for a future sandbox exists, but no sandbox is configured.

### 5.3 Private vs public surfaces

**Private (Access + EmDash auth):**

- Every path beginning `/_emdash` is gated by `src/lib/access-boundary.mjs:12-19`: a valid Cloudflare Access JWT with the configured team domain and audience is required. `/_emdash/admin/*` and `/_emdash/api/admin/*` are therefore not public.
- `GET /_emdash/api/admin/plugins` requires `plugins:read` (EmDash role 40 / Editor) (`node_modules/emdash/src/astro/routes/api/admin/plugins/index.ts`).
- Install/update/enable/disable/uninstall require `plugins:manage` (role 50 / Admin), e.g. `registry/install.ts:77`, `[id]/enable.ts:25`, `[id]/uninstall.ts:31`.
- `composer-miniapps` read/write routes require `plugins:manage` plus role 50 (`src/plugins/miniapps.ts:8-10`, `src/lib/miniapp-admin.mjs:95`).
- `composer-stacks` routes require `content:read_drafts` plus a workspace membership/capability check (`src/lib/creator-plugin.ts:28-110`, `src/lib/creator-access.ts:1-6`).

**Public:**

- `/apps`, `/discover`, `/catalogue`, `/catalogue/<slug>`, `/s/<slug>`, `/manage`, `/ready`, `/init` — product pages and published content. None exposes `_plugin_state`, plugin versions, installed inventory, security findings or registry data.
- Published stack documents (`published_json`) are intentionally public. They are Composer content, not plugin inventory.

**Consequence:** the Trust Centre's installed inventory and any security judgement must stay behind `plugins:manage` + role 50. EmDash's core plugin-list API allows `plugins:read` (role 40), so the Trust Centre should not widen that and should not describe its findings as visible to "administrators only" unless it enforces role 50 itself.

---

## 6. The smallest source-backed read-only slice

### 6.1 Recommendation

Ship a **private native admin view** over a **dated, committed discovery snapshot**, plus a **pure evaluator**. Do not add a plugin, do not add an installer, and do not call the registry at request time.

| Piece | Path (proposed) | Responsibility |
| --- | --- | --- |
| Curated package list | `src/lib/trust-centre-packages.json` | Pinned `{did, slug, category}` entries; no handles as identity. Categories follow the WordPress capability mapping in #363 so operators can filter by job (forms, SEO, email, analytics, commerce) rather than by plugin name |
| Refresh command | `scripts/trust-centre.mjs --refresh` | Reads official aggregator with `@emdash-cms/registry-client@0.7.1`; writes snapshot; bounded; no credentials |
| Snapshot check | `scripts/trust-centre.mjs --check` | Schema/policy validation and age warning; **no network**; safe for `pnpm check` |
| Snapshot | `src/lib/trust-centre.json` | `composer.plugin-trust/1`, policy `2026-10-25.1`, host versions, `observedAt`, per-package facts |
| Evaluator | `src/lib/trust-centre.mjs` | Pure functions: facts + optional receipts + policy → dimensions, colour, reason codes, next action |
| Native page | `src/plugins/trust-page.tsx` | Read-only table/detail; "why this colour"; links to native EmDash Plugins area |
| Native route | `trustRead` on existing `composer-stacks` plugin | `GET`, permission `plugins:manage`, role 50, origin check, no writes |
| Docs | `docs/plugin-trust.md` | Policy, refresh, stale/UNKNOWN rules, exception process |
| Tests | `tests/trust-centre.test.mjs` | Pure fixtures + route boundary; no network |

### 6.2 What the admin route may read

```sql
SELECT plugin_id, version, status, source,
       registry_publisher_did, registry_slug, installed_at
FROM _plugin_state
ORDER BY plugin_id
LIMIT 100
```

Rules:

- Read only those columns. Never select `_plugin_storage.data`, `data`, or `mcp_tools_consent`.
- Join curated packages on `(registry_publisher_did, registry_slug)`, not on plugin id.
- Rows with `source='config'` are the four native plugins; show them separately as "native / build-time", not as registry installs.
- This read is acceptable only because `composer-stacks` is a **native, trusted** plugin. A sandboxed plugin must never receive `DB` access or a route that exposes `_plugin_state`; EmDash's sandbox deliberately withholds host bindings and scopes storage per plugin.
- Rows with `source='registry'` but no curated match are "uncurated — unknown", never green.
- If the table is missing or the query fails, return `inventory: unavailable`; do not fail the page or infer an empty inventory.
- No write path, no CSRF surface, no install/update/disable/uninstall action.
- The page link may be visible to Editors because EmDash admin navigation is not per-route; the route still returns `403` for role < 50. The page must render an explicit "owner-only" state for that case, not a broken panel, and must not fetch the data first.

Inventory fields the issue asks for, and what v1 can honestly provide:

| Field | v1 source | State |
| --- | --- | --- |
| Application / environment | Explicit site label in the page; environment from the deployed build | Known per page instance |
| Installed package / version | `_plugin_state.version`, `plugin_id` | Known |
| Publisher DID + slug | `_plugin_state.registry_publisher_did`, `registry_slug` | Known for registry rows |
| Permissions granted | Installed bundle manifest in R2 | **Unknown in v1** — requires a #369 install receipt; do not infer from `declaredAccess` |
| Latest safe candidate | Dated snapshot + policy v1 | Known, with UNKNOWN where evidence is missing |
| Owner | EmDash user record / exception record | **Unknown in v1** unless an exception record supplies it; do not invent |
| Exposure | Route visibility diff | **Unknown in v1** — requires installed/candidate manifests |
| Evidence timestamps | Snapshot `observedAt`, receipt `observedAt`, `indexedAt` | Known |

### 6.3 Refresh behaviour

- Curated list only (start with 5–8 packages), not the full 100+ catalog. One `resolvePackage` + one `getLatestRelease` + one `listReleases(limit=20)` per package.
- Total budget 30 s; per-request 8 s; at most 2 retries; stop and preserve the previous snapshot on failure.
- Persist only allowlisted fields: DID, slug, handle, latest version, release CID, profile CID, checksum, `requires`, `declaredAccess`, repo URL, licence, security contact presence, labels, `indexedAt`, history flags. Do not persist descriptions, screenshots or arbitrary URLs.
- `observedAt` is the snapshot time, not the publisher's publish time. The release record has no publication timestamp; `indexedAt` is aggregator index time and must be labelled as such.
- Refresh is explicit. No cron, no watch mode in v1. #365's watch-mode acceptance remains a later, separately authorised slice.
- Bundle inspection is a **separate explicit** command (`--inspect <did>/<slug>@<version>`), because it downloads third-party bytes. It writes a receipt with SHA-256, manifest id/version, capabilities and hosts; it never executes the bundle.
- The snapshot is committed so builds are reproducible and a public page can read it without a runtime dependency.

### 6.4 What not to build

- No second marketplace, catalog mirror, search index or installer.
- No install/update/enable/disable/uninstall controls.
- No automatic acceptance of permissions, no silent upgrades, no auto-fork.
- No runtime call to `registry.emdashcms.com` from public pages or from every admin page load.
- No reading another plugin's storage or secrets.
- No claim that a green colour means "secure".

---

## 7. Rating policy v1 (dated and versioned)

**Policy id:** `2026-10-25.1`
**Host evaluated:** EmDash `1.3.1`, Astro `7.4.2`, `@emdash-cms/cloudflare` `1.3.1`
**Applies to:** curated registry packages only; native/build-time plugins are shown as unrated inventory.

### 7.1 Dimensions and precedence

Three visible dimensions plus a separate financial row:

1. **Security/trust** — identity, withdrawal, digest, declared/inspected access.
2. **Maintenance/compatibility** — declared version range, history completeness, label state, release recency, source/contact presence.
3. **Advisory coverage** — whether a known-advisory source was checked. v1 has none → UNKNOWN.
4. **Financial** — plugin price and external service cost, shown separately; never folded into a colour.

Overall precedence: **RED > AMBER > UNKNOWN > GREEN**. UNKNOWN is never silently promoted to GREEN. An overall GREEN requires every dimension GREEN, including advisory coverage and a matching native install receipt; under v1 that is intentionally unreachable.

### 7.2 Rules

| State | Reason code | Exact condition | Why this state |
| --- | --- | --- | --- |
| RED | `IDENTITY_MISMATCH` | Requested DID/slug differs from the view, or profile/release URI/CID is missing or inconsistent within the snapshot | Identity is the trust root |
| RED | `RELEASE_WITHDRAWN` | `evaluateRegistryReleaseWithdrawal()` returns `withdrawn: true` or `malformed: true` | Yank/withdrawal and malformed labels fail closed |
| RED | `ARTIFACT_MISSING` | No package artifact or no checksum in the release record | Nothing to verify |
| RED | `DIGEST_MISMATCH` | Bundle inspection receipt's SHA-256 ≠ release checksum | Bytes do not match the signed record |
| RED | `EGRESS_UNRESTRICTED` | Inspected manifest declares `network:request:unrestricted`, or declares `network:request` with an empty `allowedHosts` list, and no unexpired owner exception | Policy-disallowed egress; exception requires named owner and expiry |
| RED | `CAPABILITY_ESCALATION` | Candidate capabilities are not a subset of the installed version's capabilities (both receipts required) | Silent permission expansion |
| RED | `COMPAT_INCOMPATIBLE` | `requires["env:emdash"]` excludes `1.3.1` | Will not run on this host |
| RED | `PUBLIC_ROUTE_ESCALATION` | Candidate adds a public/unauthenticated route vs the installed version | New anonymous surface |
| AMBER | `EGRESS_REVIEW` | Restricted network hosts are declared and not owner-approved | Real capability, needs a review |
| AMBER | `EGRESS_HOSTS_UNDECLARED` | Release `declaredAccess` declares network access with no host list, and no bundle inspection receipt exists | Discovery cannot tell restricted from unrestricted; inspect before install |
| AMBER | `WRITE_SCOPE_REVIEW` | Any of `content:write`, `content:publish`, `content:restore`, `media:write`, `media:metadata:write`, `redirects:write`, `users:read`, `comments:moderate`, `taxonomies:write`, `email:send` is declared and not owner-approved | Broad authority within a coarse capability |
| AMBER | `PROVENANCE_OPTIONAL` | `releasePolicy.requireProvenance !== true` | Build provenance is not required |
| AMBER | `LABEL_REVIEW` | The selected record has an active `listing-review` label | Aggregator review state |
| AMBER | `HISTORY_INCOMPLETE` | `releaseHistoryComplete !== true` | History may be missing, so age/churn is unreliable |
| AMBER | `RELEASE_RECENT` | `observedAt − indexedAt < 7 days` | No soak window; label as index time, not publish time |
| AMBER | `SECURITY_CONTACT_MISSING` | No `security`/`securityContacts` in the profile | No stated disclosure route |
| AMBER | `REPO_MISSING` | No canonical repository in the profile | Source cannot be inspected |
| AMBER | `LICENSE_MISSING` | No licence in the profile | Reuse/fork terms unknown |
| AMBER | `HANDLE_UNAVAILABLE` | No current handle | Display DID only; contact path unclear |
| UNKNOWN | `NO_COMPAT_DECLARATION` | `requires` absent | Absence is not compatibility |
| UNKNOWN | `CAPABILITIES_UNINSPECTED` | No bundle inspection receipt | Exact capabilities/hosts unknown |
| UNKNOWN | `ADVISORY_SOURCE_NONE` | No advisory source selected/tested | No CVE/vulnerability coverage |
| UNKNOWN | `INSTALL_NOT_TESTED` | No native install receipt for this exact release CID | No lifecycle evidence |
| UNKNOWN | `STALE_SNAPSHOT` | Snapshot older than 14 days, or refresh failed | Freshness is part of the claim |
| UNKNOWN | `LABELS_ABSENT` | No labels on the selected record | Aggregator state not established |
| GREEN | `POLICY_CHECKS_PASSED` | All required facts present; no RED/AMBER/UNKNOWN reason above | "Reviewed against stated checks", never "secure" |

`CAPABILITY_ESCALATION` and `PUBLIC_ROUTE_ESCALATION` are defined now but cannot be evaluated from discovery alone. They stay **UNKNOWN** until an install receipt records the installed manifest. Do not render them as "no change" when there is no installed baseline.

### 7.3 Applying the rules to the two examples

| Package | Security/trust | Maintenance | Advisory | Financial | Overall |
| --- | --- | --- | --- | --- | --- |
| Freeform 0.1.4 | RED — `EGRESS_UNRESTRICTED`; digest verified | AMBER — history incomplete, provenance optional, release recent; compatibility GREEN | UNKNOWN — no feed | free-for-now; external cost UNKNOWN | **RED** |
| Stripe Checkout 0.10.3 | AMBER — `WRITE_SCOPE_REVIEW`, `EGRESS_REVIEW`; digest verified | AMBER — no `requires`, release recent; history complete | UNKNOWN — no feed | free-for-now; Stripe fees UNKNOWN | **AMBER** |

No overall GREEN exists in the current snapshot. That is the correct result, not a gap in the UI.

### 7.4 Exceptions

An owner exception is a separate record with:

- package DID + slug + exact release CID (not a version range),
- reason code(s) waived,
- owner identity and date,
- expiry (maximum 90 days),
- compensating control (e.g. staging install + egress monitoring).

An exception changes RED → AMBER for that exact release, never RED → GREEN. A new release re-evaluates from scratch. Exceptions are private and never appear on a public page.

### 7.5 Financial dimension

- `plugin_price`: `free-for-now` only because the official 2026-09-28 registry announcement says all registry plugins are free for now; the registry has no price field. Record the statement date and re-check it.
- `external_cost`: `UNKNOWN` unless the publisher declares it in a structured field (none exists today). Stripe fees, Anthropic keys, email providers and similar are external contracts; link to the vendor, never estimate.
- `hosting_cost`: site-level, not per plugin. Worker Loader needs Workers Paid; Dynamic Workers include 1,000 unique workers/month then $0.002 per unique worker per day, plus Workers Standard request/CPU rates. Show this once on the page, not as a per-package badge.

---

## 8. Acceptance tests for the slice

Pure evaluator fixtures (no network, no real plugin execution):

1. `EGRESS_UNRESTRICTED` fixture → RED, reason names the inspected capability.
2. `DIGEST_MISMATCH` fixture → RED, even when labels say `listing-passed`.
3. `RELEASE_WITHDRAWN` + `malformed: true` → RED.
4. `COMPAT_INCOMPATIBLE` (`>=2.0.0` vs 1.3.1) → RED.
5. `NO_COMPAT_DECLARATION` → UNKNOWN, not GREEN.
6. `HISTORY_INCOMPLETE` + one release → AMBER, not "abandoned".
7. `STALE_SNAPSHOT` (15 days) → UNKNOWN.
8. `ADVISORY_SOURCE_NONE` + everything else green → overall UNKNOWN (proves GREEN is gated).
9. `CAPABILITIES_UNINSPECTED` → UNKNOWN.
10. Exception record changes RED→AMBER for the exact CID and expires; a new CID returns RED.
11. Candidate release adds a new allowed host → `EGRESS_REVIEW` and requires re-review; adding `network:request:unrestricted` → RED.
12. Aggregator 500/timeout → previous snapshot retained, package UNKNOWN.
13. Registry error text containing `<script>` or the requested handle is escaped and never rendered raw.
14. `http://` or `javascript:` profile URL is not rendered as a link.
15. Malformed/oversize snapshot is refused; previous page state remains.
16. Route: Editor (role 40, `plugins:read`) receives 403; Admin (role 50, `plugins:manage`) receives 200; wrong Origin is refused; no POST route exists.
17. `_plugin_state` query failure returns `inventory: unavailable`, not an empty list.
18. Native plugin rows (`source='config'`) are labelled build-time and never evaluated as registry packages.
19. `pnpm check` performs no network call; `--refresh` is the only network path.

Operational acceptance:

- Snapshot schema and policy version are visible on the page.
- Every colour has a "why" panel with reason codes, evidence timestamps, policy id and the next safe action.
- A plain upstream link (`https://plugins.emdashcms.com/plugins/@handle/slug`) is always available as a fallback.
- Mobile and desktop are usable; no alarmist badge for ordinary metadata; RED says "policy-blocked", not "malware".
- No install/update control exists on the page.

---

## 9. Non-goals and remaining gates

**Non-goals**

- No marketplace, catalog mirror, arbitrary installer, auto-update or privileged execution path.
- No reimplementation of EmDash's record/checksum/consent verification.
- No new EmDash plugin (#366 stays conditional).
- No public disclosure of installed inventory, exceptions or security findings.
- No claim of advisory coverage, publisher verification or "secure" status from discovery data.

**Remaining gates**

- Advisory source selection and testing (e.g. a licensed feed or a maintained GitHub advisory query). Until then, `ADVISORY_SOURCE_NONE` blocks overall GREEN.
- #369 native lifecycle receipt for at least one exact release CID; without it, `INSTALL_NOT_TESTED` blocks overall GREEN.
- Owner decisions on egress policy, write-scope approvals and exception ownership.
- A repeatable refresh with failure handling and a bounded cache; watch mode is a later slice.
- Public view (if any) with sanitised fields, no inventory and no security findings.
- Accessibility and mobile acceptance of the native page (#198/#118).
- Cross-site isolation: Site A must not read Site B inventory (#310/#314).

---

## 10. Sources

**Official documentation (fetched 2026-10-25 UTC)**

- [The plugin registry](https://docs.emdashcms.com/plugins/registry/)
- [Querying the registry](https://docs.emdashcms.com/plugins/registry-client/)
- [Installing plugins](https://docs.emdashcms.com/plugins/installing/)
- [Capabilities and security](https://docs.emdashcms.com/plugins/creating-plugins/capabilities/)
- [Bundling and publishing](https://docs.emdashcms.com/plugins/creating-plugins/publishing/)
- [Configuration reference — registry](https://docs.emdashcms.com/reference/configuration/#registry)
- [Plugin sandbox](https://docs.emdashcms.com/deployment/plugin-sandbox/)
- [Admin panel](https://docs.emdashcms.com/concepts/admin-panel/)
- [EmDash plugin registry launch post, 2026-09-28](https://emdashcms.com/blog/emdash-plugin-registry)
- [Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/)

**Live evidence**

- `output/parallel-run-20261025/research/evidence/registry-search.json`
- `output/parallel-run-20261025/research/evidence/registry-search-headers.txt`
- `output/parallel-run-20261025/research/evidence/resolve-solspace.com-freeform.json`
- `output/parallel-run-20261025/research/evidence/resolve-ecommerceave.com-emdash-stripe-checkout.json`
- `output/parallel-run-20261025/research/evidence/getLatestRelease-solspace.json`
- `output/parallel-run-20261025/research/evidence/getLatestRelease-stripe.json`
- `output/parallel-run-20261025/research/evidence/listReleases-solspace.json`
- `output/parallel-run-20261025/research/evidence/listReleases-stripe.json`
- `output/parallel-run-20261025/research/evidence/probe-*.json`
- `output/parallel-run-20261025/research/evidence/bundle-inspection.json`
- `output/parallel-run-20261025/research/evidence/summary.json`

**Repository source**

- `package.json` — `emdash@1.3.1`, `@emdash-cms/cloudflare@1.3.1`, Astro `7.4.2`, Wrangler `4.152.0`
- `astro.config.mjs` — four native plugins; no `sandboxRunner`, no `registry`
- `wrangler.jsonc` — `DB`, `MEDIA`, `SESSION`; no `worker_loaders`
- `src/worker.ts` — `PluginBridge` exported
- `src/lib/access-boundary.mjs` — `/_emdash` Access gate
- `src/lib/creator-plugin.ts`, `src/lib/creator-access.ts` — native admin pages/permissions
- `src/plugins/miniapps.ts`, `src/lib/miniapp-admin.mjs` — `plugins:manage` + role 50 precedent
- `migrations/0003_stacks.sql`, `0004_stack_publications.sql`, `0006_stack_resources.sql`, `0009_private_outcomes.sql` — Composer-owned `creator_*` tables
- `node_modules/emdash/src/database/types.ts:530` — `_plugin_state` shape
- `node_modules/emdash/src/plugins/state.ts` — state repository
- `node_modules/emdash/src/registry/plugin-id.ts` — registry plugin id derivation
- `node_modules/emdash/src/api/handlers/registry.ts` — install/update/uninstall and verification gates
- `node_modules/emdash/src/astro/routes/api/admin/plugins/index.ts` — `plugins:read`
- `docs/operator-reference.md` — supported versions and private admin boundary
