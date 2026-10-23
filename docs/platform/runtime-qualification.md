# Runtime qualification

Reviewed 23 October 2026, Australia/Melbourne. Owners: [#252](https://github.com/loftwah/app-composer/issues/252), [#253](https://github.com/loftwah/app-composer/issues/253), alternate host [#179](https://github.com/loftwah/app-composer/issues/179) and recovery [#118](https://github.com/loftwah/app-composer/issues/118). The [field guide](field-guide.md) describes placement; this record separates observed local behaviour from candidate designs.

## What was exercised

Baseline `29fc65c2983769f140bad3bdef298a20c0185b0e`, macOS arm64, Node **22.23.1**, pnpm **12.8.1**. Existing installed dependencies were inspected and reused from the owner's Composer checkout without changing them: EmDash **1.2.0**, `@emdash-cms/cloudflare` **1.2.0**, Astro **7.3.5**, `@astrojs/cloudflare` **14.3.3**, Wrangler **4.143.1**, workerd package **1.20261013.1** (binary reports `2026-10-13`). `@astrojs/node` and `celld` were absent from the selected dependency tree/PATH. No dependency was installed.

| Scope | Observed outcome | Qualification boundary |
| --- | --- | --- |
| Existing EmDash Node SQLite adapter | `emdash/db/sqlite` 1.2.0 opened an owned fictional database; create/read, interrupted transaction rollback and scoped export/restore passed. Team B's later record survived team A's restoration. | A direct database-adapter fixture. No full Composer schema migration, media recovery, app server, HA or tenant-isolation acceptance. Node marks SQLite experimental. |
| Unchanged Composer on native Node | `import('cloudflare:workers')` returns `ERR_UNSUPPORTED_ESM_URL_SCHEME`. The source contains direct imports of that module. | Demonstrates one concrete incompatibility, not an exhaustive port failure analysis. A Node build/runtime adapter is required. |
| Operational adapter | Real loopback HTTP receiver durably recorded separate change, alert trigger and recovery resolve payloads. A fourth request was recorded before its socket closed; result stayed `unknown` with one received attempt. | Local PagerDuty-shaped fixture only. No vendor account, escalation, notification, actual incident or remediation. |
| celld | Current official compatibility/guarantee/security documentation inspected; v0.6.3 release identified. Existing Composer config contains unsupported top-level keys. | Not executed. No selected fleet, image digest, object store or durability/failure test. |
| AWS/EKS, Azure/AKS, Google Cloud/GKE | Mapping below is documented architecture. | None exercised. Installed CLIs do not establish a cluster, entitlement, identity or Composer support. |

The programme's first platform path uses scoped resources and published stacks on existing independent app Workers and their app-owned D1/R2. Two team records do not imply two infrastructure deployments or physically separate team databases.

Run the bounded fixture from the repository:

```sh
node --test tests/platform-integrations.test.mjs
node scripts/platform-qualification.mjs
```

For a worktree without its own dependencies, select an **existing reviewed** installation explicitly:

```sh
node scripts/platform-qualification.mjs --dependencies /absolute/existing/node_modules
```

The script never installs packages or discovers credentials. It emits JSON containing source SHA, actual dependency versions, binding names, bounded redacted receiver payloads and cleanup result. One `composer-platform-qualification-*` root contains its fictional SQLite database and receiver log. `finally` closes owned handles, removes only that root and verifies its absence, including on a failed check. Save useful JSON under ignored `output/`; do not retain the temporary database/project. Initial run evidence: `output/platform-qualification-20261023.json`. Rerun after integration/source advance; an old receipt is not release evidence.

## Dependencies that must move together

Source facts below come from `astro.config.mjs`, `wrangler.jsonc`, `src/worker.ts`, `src/middleware.ts`, the native plugins and `src/lib`/`lib/usage`. Preview currently has separate D1/R2/KV, no service bindings, no rate-limit bindings and no cron; a successful preview is not the production dependency graph.

| Actual dependency | celld candidate | Node/container candidate | Required acceptance |
| --- | --- | --- | --- |
| Worker bundle, `cloudflare:workers` imports, Astro Cloudflare adapter | Translate config for a pinned celld release and run the generated Worker with actual dependency calls. Partial Node compatibility is relevant to bundled packages. | Replace the adapter/imports with a maintained runtime abstraction; `@astrojs/node` is not installed here. | Public pages, native administration, all API routes, assets, streaming and errors on exact build. |
| EmDash D1 `DB` and direct `.prepare/.bind/.batch` SQL | D1-compatible service requires explicit schema/data import. Its documented replicas/Time Travel/API differences remain. | EmDash has SQL adapters; Composer's direct D1 calls still need deliberate porting and transaction semantics. | Actual migrations, constraints, atomicity, concurrent writes and isolated restore preserving newer records/revocations. |
| R2 `MEDIA`, public/private media and raster rendering | celld maps R2 to fleet object storage; qualify metadata, conditional writes, range/multipart operations and public delivery. | Select EmDash's supported storage adapter plus Composer/app-owned access rules. | Bytes, MIME, dimensions, moderation, denial after hide/delete, export and restore on the destination. |
| KV `SESSION` | Qualify expiry, consistency and deployment/session behaviour. | Shared session backend, not per-pod memory. | Login, expiry, restart, concurrent replicas and revocation, including alternate login paths. |
| `GUESTBOOK` / `SHOWCASE` service bindings, exact independent source pins, owner-secret client | Prove service routing and separate fleet/application boundaries with target-specific config. | Explicit authenticated service clients replace binding fetch; no browser-selected destination. | Mounted and standalone journeys, source/version identity, denied owner calls and app-owned eligibility/data. |
| Access JWT admission and EmDash access adapter | External ingress/TLS and actual Access or equivalent identity verification must remain. Fleet private network is another boundary. | Choose supported authentication; retain audience/issuer/signature checks, application roles and secure proxy configuration. | New-person admission, active session revocation, direct API denial, forwarded-header spoofing and cross-team access. |
| `USAGE_LIMIT` rate-limit binding | Not a service in the inspected celld compatibility list; design and test an equivalent. | Shared limiter or controlled ingress; per-process limits change behaviour. | Concurrent quota enforcement, unavailable limiter, deliberate failure mode and preview isolation. |
| Per-minute scheduled EmDash work plus daily usage/outcome purges | Cron is documented, with its own catch-up/retry semantics. Qualify idempotence and `waitUntil`. | External scheduler or one coordinated runner using EmDash's documented scheduled endpoint, not all replicas independently. | Missed schedules, concurrent execution, crash/restart, duplicate effects and retention correctness. |
| Native EmDash plugins and optional sandboxed plugins | Current Composer plugins are trusted native code. Worker Loader support and budgets need independent tests if used. | Native plugins remain in-process; sandboxed plugins use a workerd child process. | Required hooks/admin routes, process failure and actual enforced budgets; a Node wall-time limit is not a Cloudflare CPU/subrequest budget. |
| Build/release, source pins, routing/domain and health | Target-specific config cannot be promoted as the existing Workers profile. | Container image, dependencies, proxy and migrations become release inputs. | Exact artifact/source, current authority, independent health, safe rollback and separate data-restoration evidence. |

Official EmDash sources: [Node/Docker deployment](https://docs.emdashcms.com/deployment/nodejs/), [database adapters](https://docs.emdashcms.com/deployment/database/), [storage](https://docs.emdashcms.com/deployment/storage/) and [plugin sandbox](https://docs.emdashcms.com/deployment/plugin-sandbox/). These were rechecked on the review date and compared with installed EmDash 1.2.0 exports. They document capabilities; they do not certify a Composer port. The documented Cloudflare sandbox database bridge directly requires D1; a Hyperdrive selection does not establish sandboxed-plugin compatibility.

## celld's concrete configuration and recovery gate

The [current compatibility matrix](https://celld.dev/docs/cloudflare-compat/) permits a restricted set of Wrangler keys. Composer currently includes `account_id`, `routes`, `workers_dev`, `observability`, `env`, `preview_urls`, `limits` and `ratelimits` outside that documented set. Passing this file unchanged is therefore an unsupported candidate according to the provider; no deployment was attempted. Accepted compatibility flags can also have no effect. A bundle that loads must still execute the required APIs.

The [release list](https://github.com/denoland/celld/releases) identifies **v0.6.3**, while [security](https://celld.dev/docs/security/) and [limitations](https://celld.dev/docs/limitations/) retain **v0.6.2 beta** wording. Resolve this documentation/release boundary with the exact release and image digest before qualification. celld trusts application code, nodes and operators within a fleet. It does not establish hostile customer tenancy. Keep peer/operator listeners private and provide TLS externally.

The [guarantees](https://celld.dev/docs/guarantees/) require qualified conditional/ranged object-store operations and a restarting supervisor. The documented default fleet durability needs at least two running nodes; bucket durability and fleet durability have different operational proofs. Before choosing either, test the selected version's storage diagnosis, acknowledged writes during process/node loss, follower loss, storage interruption, takeover and restoration. Do not delete follower/log state during a rollout merely because a response was acknowledged. [D1](https://celld.dev/docs/services/d1/), [R2](https://celld.dev/docs/services/r2/) and [cron](https://celld.dev/docs/services/cron-triggers/) each retain their own compatibility differences.

## Public cloud mappings awaiting execution

| Provider | Candidate runtime and identity | State/network/operations to qualify | Status |
| --- | --- | --- | --- |
| AWS / [EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html) | Pinned celld fleet or deliberately ported Node service; EKS workload identity scoped to selected resources. | celld S3 fleet bucket, or selected SQL/object/session services for Node; private peers, ingress/TLS, logs and backup ownership. | Architecture only; no AWS account, region, cluster, Pod Identity, bucket or restore exercised. |
| Azure / [AKS](https://learn.microsoft.com/en-us/azure/aks/what-is-aks) | Same distinct candidates; Azure workload identity scoped to selected storage/services. | celld documented Azure Blob path, or supported Node services; verify actual identity mode, private endpoints, storage conditional operations and retention. | Architecture only; no Azure account, region, cluster, identity, container or restore exercised. |
| Google Cloud / [GKE](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview) | Same distinct candidates; GKE workload identity/application credentials selected by operator. | celld GCS XML/conditional-write path, or supported Node services; qualify ingress, private peers, logs, backups and exit. | Architecture only; no GCP project, region, cluster, identity, bucket or restore exercised. |

Provider support for a primitive is distinct from Composer interoperability. Hybrid API connectivity, redeployment, provider-loss recovery and active-active state require different evidence. The local scoped-row restore does not establish configuration/data/media exit from Workers or measured customer RPO/RTO. Those gates remain #118/#252/#253.
