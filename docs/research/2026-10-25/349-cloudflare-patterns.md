# Cloudflare-first app patterns: what local-PaaS lessons actually transfer

**Issue:** [#349](https://github.com/loftwah/app-composer/issues/349) · **Companion report:** [359-platform-buyers.md](359-platform-buyers.md)
**Research date:** 2026-10-25 Australia/Melbourne (AEDT, UTC+11) / 2026-10-25 UTC
**Composer baseline inspected:** production `5e012f98e15dceb009e98468d0e541e00401d918` / Worker `57c5873f-77a9-4c0c-a413-bd1d1ad4b2b4` (#11, 2026-10-25); local tree `d9f4dfd1456da10ead2d65951079f1e9606e9fc0`.
**Reference inspected:** `ImLunaHey/local-paas` at `82c7fe0d217cee8f9b4216b8801a2cd741b429bc` (2026-10-24), README plus `docs/architecture.md`, `runtime.md`, `storage.md`, `backups.md`, `install.md`. Source-inspected only; **nothing was installed, built or run.**
**Boundaries honoured:** no fork, no Nix, no provider writes, no purchases, no new runtime, no implementation tickets. Report first.

Labels: **[F] fact** (repo source or quoted primary doc) · **[V] vendor claim** · **[I] inference**. Capability levels as in the companion report: L1 live-verified, L2 locally qualified, L3 implemented/unqualified, L4 provider-documented only, L5 proposed, L6 absent.

All pages below were retrieved **2026-10-25**; bracketed dates are the page's own last-updated marker.

---

## 1. Executive answer

**Retain six ideas as guidance, not as platform code.**

1. **Release identity beats "it deployed".** local-paas: "A registered Git commit is not a built image." Cloudflare draws the same line in three places — an uploaded version, a deployment, and what a given URL actually serves. Composer already enforces it; the gap is user-facing explanation (#310/#319/#286).
2. **Desired state ≠ observed state.** local-paas reconciles assignments after restart, fences stale generations and keeps healthy containers when the controller is down. Cloudflare's equivalent is deliberate reads and comparison, not magic; #318 already owns it. No new reconciler.
3. **A failed candidate must never replace the last good release.** local-paas gates on readiness and retains the previous revision. Cloudflare: versions, gradual deployments, rollback. Already #219/#310.
4. **Persistence is not backup.** Coolify says it plainly: "Persistent storage is not a backup" and it "does not prove that a backup can be restored." local-paas only writes a backup manifest after *every* component succeeds, and verifies by restoring into disposable PostgreSQL/Redis/OpenBao. Composer has no restore drill (#118). This is the single most valuable lesson in the whole review.
5. **Preview/preview-URL/environment are three different things.** Version URLs ("previously preview URLs") reuse the Worker's existing configuration and resources. Previews create per-branch settings but service bindings still call production. Wrangler environments are separate Workers with **non-inheritable** bindings. Most teams get this wrong; guidance is cheap and prevents production writes.
6. **Honesty is a feature.** local-paas refuses to adopt an existing conflicting install, states "unavailable infrastructure does not become fake successful builds", and documents that its three VMs share one failure domain. Composer already behaves this way (readiness, "not-performed", inventory unknowns). Keep it and publish it.

**Reject five ideas outright.** Long-running containers, arbitrary binaries, persistent local volumes, root/host access, and "self-host the whole PaaS on one box" are all anti-goals for a Cloudflare-first studio. Cloudflare has documented answers (Containers, D1/R2/DO, Workflows) but they are different products with different guarantees; the honest response is "this is not the workload for Workers" plus a pointer to #252/#253.

**Do nothing structural.** No new guide engine, catalogue, vault, workflow engine, runtime or abstraction layer. The only justified outputs are: four short guidance additions owned by #286/#218/#310/#118, and one table (below) that #218 can reuse verbatim.

---

## 2. Verified snapshot

| Item | Value | Level |
| --- | --- | --- |
| Composer production source / Worker | `5e012f98…` / `57c5873f-77a9-4c0c-a413-bd1d1ad4b2b4`, 1,148 tests, 1,252-file guard (#11, 2026-10-25T03:04Z) | L1 |
| Composer bindings | D1 `DB`, R2 `MEDIA`, KV `SESSION`, services `GUESTBOOK`/`SHOWCASE`/`GUESTBOOK_MEMBERS`, cron `* * * * *`, `USAGE_LIMIT`, `limits.cpu_ms: 1000`, 10% log sampling | L1 (`wrangler.jsonc`) |
| Preview model in use | Wrangler `env.preview` with separate D1/R2/KV; **no** services, cron or rate limits; `preview_urls:false`; no `wrangler preview` usage | L1 (config) / L3 (isolation) |
| Governed team path | local `workerd` two-team run at `25dc7589`; no dedicated team infrastructure, no new-person admission | L2 |
| Restore | Not drilled; data/media portability open | L6 (#117/#118) |
| local-paas | Rust control plane + 3 KVM worker VMs + BuildKit VM, systemd/cgroup v2/Nix, 16 GiB RAM / 100 GiB SSD minimum, single-operator alpha, no admin login | [F] source-inspected |
| local-paas self-report | fresh Ubuntu 24.04 install, two-replica deployment, reboot recovery verified 2026-10-24; ARM64 and off-site backups pending | [V] its own docs |

Cloudflare doc dates used for every claim in §7: Workers limits 2026-10-12; Workers pricing 2026-10-02; D1 limits 2026-10-24; D1 Time Travel 2026-04-21; D1 data location 2026-10-02; R2 consistency 2026-10-14; R2 location 2026-08-19; R2 pricing 2026-10-01; KV 2026-04-21; Queues 2026-04-21; Workflows 2026-09-21; Previews 2026-09-24; Version URLs 2026-09-22; Wrangler environments 2026-10-18; WfP limits 2026-10-13; WfP pricing 2026-04-21; Workers Logs 2026-10-12; Containers 2026-10-12; local development 2026-10-22; Node.js compat 2026-08-12.

---

## 3. What local-paas actually is (and what it admits)

**[F] From its README and docs:**

- **Shape:** Rust control plane + node agents; React/Vite dashboard; PostgreSQL for control-plane state; OCI images built in an isolated BuildKit VM; containerd inside three KVM worker VMs; management services outside the cluster they control.
- **Prerequisites:** x86-64/ARM64 with `/dev/kvm`, **16 GiB RAM**, **100 GiB SSD**, systemd, cgroup v2, Nix. Builder 2 vCPU/3 GiB, workers 1 vCPU/2 GiB, 16 GiB virtual disks each.
- **Scope it claims:** projects and per-project environments with shadowed config and secrets; Dockerfile/Node/Bun builds; health-gated deployments; retained revisions; failed-candidate rollback; cordon/drain; opt-in stateless relocation; singleton workers, jobs, interval schedules; OpenBao workload secrets; ClickHouse log retention; managed PostgreSQL/Redis/RustFS; node-pinned volumes; encrypted backups with restore drills.
- **Scope it *refuses* to claim:** "private, single-operator alpha, not a public multi-user PaaS"; "no application-level administrator login yet"; three VMs on one host are "three scheduling nodes, not three physical failure domains"; storage is node-pinned; off-site backup automation is not implemented; celld fleet execution is not implemented; `setup-install` "refuses detected conflicts" and must never adopt an existing manual install.

**Why that matters for Composer:** the reference's own value is not its container runtime. It is the *discipline* around releases, readiness, reconciliation, secret delivery and restore verification — all of which have Cloudflare-native equivalents. Its container machinery is precisely the part that does **not** transfer.

### Peer comparison (primary vendor docs only)

| Platform | Deployment unit | Environment model | Persistent state | Backup/restore claim | Relevant primary source |
| --- | --- | --- | --- | --- | --- |
| **local-paas** | OCI image in containerd/KVM | per-project environments, shadowed config/secrets | node-pinned volumes; single-writer fence | encrypted Restic sets; manifest only when all components succeed; restores into disposable clusters and re-checks secret versions | repo `docs/architecture.md`, `backups.md` |
| **Coolify** | Docker container on a connected server | per-resource env vars; preview deployments | named volume / bind mount / file mount | "Persistent storage is not a backup"; scheduled DB dumps to S3; "does not … prove that a backup can be restored" | [applications](https://coolify.io/docs/applications/), [persistent storage](https://coolify.io/docs/knowledge-base/persistent-storage/), [databases](https://coolify.io/docs/databases/) |
| **Dokploy** | container on a server (Swarm options) | per-application environment variables | volumes/binds/file mounts; replicas configurable | whole-file-system + DB backup to an S3 destination, cron schedule | [applications](https://docs.dokploy.com/docs/core/applications), [backups](https://docs.dokploy.com/docs/core/backups) |
| **CapRover** | container on Docker Swarm | app-level env vars | persistent apps locked to one server; one instance by default | not a backup product; volume deletion is a separate reviewed step | [persistent apps](https://caprover.com/docs/persistent-apps.html), [app configuration](https://caprover.com/docs/app-configuration.html) |
| **Railway** | service/container | isolated environments; PR envs deleted on merge/close; env RBAC is Enterprise-only | **one volume per service; replicas cannot use volumes; redeploy causes downtime** | manual + automated volume backups | [environments](https://docs.railway.com/guides/environments), [volumes](https://docs.railway.com/reference/volumes) |
| **Render** | service/container | Blueprint YAML; preview environments clone services/datastores **without data** | disk is single-instance, no zero-downtime deploy, unavailable to builds/jobs | disk snapshots | [disks](https://render.com/docs/disks), [preview environments](https://render.com/docs/preview-environments), [Blueprint spec](https://render.com/docs/blueprint-spec) |

**Reading:** every peer that offers persistent local state pays for it with single-instance placement and deploy downtime (Railway, Render, CapRover all say so explicitly). Cloudflare avoids that trade by removing the local disk entirely and substituting D1/R2/KV/DO. That is a **different architecture**, not a missing feature — and it is the strongest argument for keeping Composer Cloudflare-first.

---

## 4. Lessons that transfer

For each: the lesson, its evidence, the Cloudflare mechanism, the Composer owner and current state, and what I recommend.

### T1 — Immutable release identity, with the build separable from the source

- **Evidence [F]:** local-paas records a credential-free HTTPS Git URL + full commit SHA, resolves mutable refs **once per build**, and states "BuildKit will produce an immutable digest before a runtime revision exists. A registered Git commit is not a built image." Retry operation IDs return the original deployment.
- **Cloudflare [F]:** a Worker *version* is created by `wrangler deploy` or `wrangler versions upload`; deployments point at versions; Version URLs are per-version; gradual deployments split traffic by percentage.
- **Composer:** source→artifact→deployment→live check is already enforced (`pnpm deploy` guard, #11 receipts). **L1.**
- **Recommendation:** keep. Add one plain sentence to user guidance: *a pushed commit is not a release; the receipt names the exact uploaded bytes.* No code change. (#319, #11)

### T2 — Desired state, observed state, and reconciliation after restart

- **Evidence [F]:** local-paas persists desired assignments and generations; "Node reports are accepted only for allocations owned by that node at the current generation"; "Agents retain healthy containers if the controller becomes unavailable"; reservations are fsynced so a restart does not refund attempts.
- **Cloudflare [F/I]:** Wrangler/Terraform apply declarative configuration at deploy time; Cloudflare does not publish a continuous desired-state reconciler for Worker configuration. Detecting drift means reading provider state and comparing it — exactly what Composer's inventory does (109 resources via 36 GETs, 0 drift, 88 undeclared scripts) and what #318 designs.
- **Composer:** read-only inventory **L1** for its own account; native panel unconfigured (no `PROVIDER_READ_*`); drift proposals **L3/L4** (#318).
- **Recommendation:** no new reconciler. Guidance should say "a deploy is a desired-state write, not a guarantee it stayed that way; drift checks are a separate, deliberate read." (#318, #219)

### T3 — Readiness gate before traffic, and never lose the last good release

- **Evidence [F]:** local-paas: "Candidates must all report stabilized readiness before promotion"; "A failed candidate is stopped while the previous active deployment remains"; readiness ≠ liveness; a crash-looping candidate needs a new deployment.
- **Cloudflare [F]:** versions + deployments; gradual deployments with percentages; rollback to a previous version; a Preview can validate a branch before production.
- **Composer:** guarded deploy with post-deploy verification **L1**; version-level rollback exists via provider, not yet a first-class owner surface. Multi-environment promotion **L2** (#310).
- **Recommendation:** guidance: *test on a Preview or staging Worker, then promote the same reviewed bytes; a rebuild is a new candidate.* (#310, #319)

### T4 — Persistence is not backup; only a restore proves a backup

- **Evidence [F]:** Coolify — "Persistent storage is not a backup… Keep at least one backup outside the deployment server and test how you will restore it"; Coolify "does not … prove that a backup can be restored". local-paas — the manifest is written only after every component succeeds, "a partial run is not a complete set"; verification restores into disposable PostgreSQL/Redis/OpenBao, proves catalog usability, checks recorded secret versions, and never targets the original databases.
- **Cloudflare [F]:** D1 Time Travel restores to any minute in the last 30 days (paid; 7 free), always on, no extra cost — but it **cannot yet clone/fork**, and it is provider-internal, not an export. Cloudflare documents exporting D1 to R2 via Workflows for retention beyond 30 days. R2 has strong consistency but no point-in-time restore documented on the consistency page. There is no managed Postgres to snapshot here.
- **Composer:** **L6** — `docs/STATUS.md` lists content/media portability and isolated restore as open (#117/#118); the governed path explicitly says "full data restoration … not implemented".
- **Recommendation:** highest-value gap in the whole review, and it is *already owned*. Add to `/learn` and Init: "backup, redundancy and code rollback are separate claims; a D1 restore does not bring back R2 objects, and neither restores revoked access." Do not write a backup tool. (#118/#9, drill protocol in the companion report E3)

### T5 — Environment separation is configuration, not a name

- **Evidence [F]:** local-paas: "Shadowing an environment does not copy volume attachments or contents"; environment identity comes from the workspace breadcrumb, not a creation form. Railway: services and variables are scoped to one environment; duplicating an environment copies services/variables/config for review. Render previews clone datastores **without data**.
- **Cloudflare [F]:** Wrangler environments are separate Workers, and **bindings and environment variables are non-inheritable** — each environment must declare them. Previews have their own variables/secrets/bindings but service bindings still call production. Version URLs reuse the existing config and resources.
- **Composer:** `env.preview` with separate D1/R2/KV and **absent** services/cron/rate limits — a real, deliberate boundary; but no user-facing explanation of which preview mechanism is which. **L1 config / L5 guidance.**
- **Recommendation:** publish the three-way distinction (Version URL vs Preview vs Wrangler environment) in #286/#310. It is the cheapest production-safety win available. (#310, #291)

### T6 — Secrets are delivered, not copied into build output or prompts

- **Evidence [F]:** local-paas versions workload secrets in OpenBao, delivers them into workload-private tmpfs, snapshots resolved values per deployment, and never lets the controller load application dotenv files.
- **Cloudflare [F]:** Worker secrets are per-Worker and non-inheritable across environments; bindings expose resources directly. Cloudflare's enterprise reference architecture goes further: user Workers never hold credentials; an outbound worker injects them.
- **Composer:** credentials live in Cloudflare secrets/bindings; agent work uses scoped, expiring, revocable grants with only a credential hash stored (migration `0018`). #291 owns connections. **L1/L2.**
- **Recommendation:** keep. Explicitly reject introducing a vault (OpenBao or otherwise) — #291 already owns the boundary and Cloudflare secrets are the default. Guidance sentence: *a spec never contains a secret; a grant is not a secret.* (#291, #10)

### T7 — Bounded, honest observability with a stated retention

- **Evidence [F]:** local-paas retains structured logs in ClickHouse with search, retained instance logs, metrics and audit events — its own bounded stack, not "all telemetry forever".
- **Cloudflare [F]:** Workers Logs are capped at **7 days' retention**, 256 KB per log, 5B/account/day, with head sampling; this deployment samples at 10%. OTLP export exists but the repo already records that it does not cover infrastructure/custom metrics (`docs/platform/public-reference.md`).
- **Composer:** logs enabled with sampling; no metrics product, no alert routing, no on-call (#215/#266). **L1 logs / L6 suite.**
- **Recommendation:** say "Composer is not your observability stack" and name the route (Logpush/OTLP to the customer's tool). Do not build collectors. (#266, #118)

### T8 — One command to check, an explicit step to install or release; local first

- **Evidence [F]:** local-paas separates a read-only `make setup-check` from the effectful `make setup-install`, and runs the full `make check` suite (format, clippy with warnings denied, tests, oxlint, typecheck, vitest, build) as the routine gate. Application releases are made through the dashboard/git flow, not by a single CLI verb — the transferable idea is a *deterministic check command plus a deliberate, separate release step*, not "one command does everything". Coolify/Dokploy/Railway/Render reduce release to a reviewed git push plus a build. DHH's local-CI argument is already cited by #319.
- **Cloudflare [F]:** `wrangler dev` runs the same `workerd` locally with simulated bindings; `wrangler deploy` is the release. Miniflare is explicitly **not** a security boundary.
- **Composer:** `pnpm dev`, `pnpm check`, `pnpm build`, `pnpm deploy` — and `pnpm check:fast -- <tests>` for iteration. **L1.**
- **Recommendation:** keep local-first; do not add a hosted CI requirement. The one gap is that `wrangler preview` is not wired into the scripts, so the docs must not imply Previews are exercised. (#319, #310)

### T9 — Recipes/one-click apps are catalogues of *reviewed* intent

- **Evidence [F]:** CapRover one-click apps; Coolify services; Render Blueprints (`render.yaml` defines the estate); local-paas "managed PostgreSQL/Redis" as first-class resources.
- **Cloudflare:** no direct analogue — the equivalent is a versioned Wrangler config plus bindings.
- **Composer:** Init specs, eight pinned apps, composition revisions, role packs. **L1/L2.**
- **Recommendation:** reuse the existing catalogue (#218). Do not build a template marketplace; a recipe is a reviewed config with an owner, not a marketplace listing.

---

## 5. Lessons that do **not** transfer

| Local-PaaS expectation | Why it does not transfer | Honest alternative |
| --- | --- | --- |
| **Long-running container / daemon** (local-paas: containerd, restarts, 5/10/20/40/60 s backoff) | Workers run in V8 isolates, are evicted, and have no durable process; HTTP duration is unlimited only while the client stays connected, `waitUntil` adds 30 s, and CPU is capped (30 s default, 5 min max paid). Long work belongs in Queues/Workflows/DO alarms (15 min wall each). | Queues + Workflows for durable multi-step work; Cron for schedules; Durable Objects for coordination. Cloudflare Containers exist on Workers Paid but are not used by Composer and are not a K8s substitute. |
| **Arbitrary binaries / any language** | Workers execute JS/Wasm only; Node is a *subset* of APIs with polyfill stubs that throw; there is no process spawning and native modules only work if compiled to Wasm. | Wasm modules where genuinely needed; otherwise this is a container/K8s workload (#252/#253) and Composer should say no. |
| **Persistent local volume / POSIX filesystem** | No durable local disk. State must go to D1 (relational, 10 GB/db, single-threaded per DB), R2 (objects, strong consistency), KV (eventually consistent cache), or DO (coordination). Railway/Render/CapRover only make volumes work by pinning one instance and accepting deploy downtime — a trade Workers rejects by design. | D1 + R2 as the default pair; DO for counters/locks; document the per-database write ceiling. |
| **Root access / SSH / host control** | There is no host. No docker socket, no systemd, no `sudo`, no package installs at runtime. | This is the product's security property, not a gap. If a customer needs root, they need a different platform. |
| **Self-hosting the PaaS itself** (one box, Nix, 16 GiB) | Composer is a Cloudflare Worker; the celld/Node/K8s routes are unqualified research (#252, #179) and celld's own docs keep beta/trusted-tenancy caveats. | Keep Cloudflare-first. Offer exit via source + data export (#253), not via a second control plane. |
| **Replica/scale-out semantics** | No replicas or DaemonSets; scaling is automatic and stateless by default. | Design idempotent handlers; move state to bindings; use DO when a single writer is required. |
| **ClickHouse-style local log retention** | Workers Logs max out at 7 days; there is no local log store. | Logpush/OTLP to the customer's SIEM; keep the provider's retention as a debugging window only. |

Two of these deserve a sentence in user guidance because they cause real incidents: **"preview is not a sandbox"** and **"a local disk does not exist"**.

---

## 6. What to guide a user to make (for #218/#286)

Minimum useful stack per job. "Agent" = what Composer's existing agent path can do; "Human" = authority that must stay human.

| Job | What the user gets | Simplest credible stack | Required bindings / security | Operational expectation | When not to use | Complexity / cost driver | Agent | Human |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Editable content site | Pages, media, admin | Astro + EmDash on one Worker; D1 + R2; Access on `/_emdash` | `DB`, `MEDIA`, Access JWT | D1 Time Travel 30 d; R2 objects need copying out | Needs plugins/extensions beyond supported set | D1 size, R2 storage, requests | Draft, implement, verify | Publish; access changes |
| Form + admin inbox | Validated form, private review, notifications | Same Worker + D1 table + optional email provider | D1, rate limit, secret | No unbounded anonymous upload; notification delivery is separate | Regulated personal data | Email provider, storage | Build, test, replay | Data classification; retention |
| Small API / mini-app | HTTP API with owned data | Worker + D1; KV only for cache | D1, optional KV | 10 GB/db, single-threaded writes | High write throughput on one key/db | Requests, D1 rows read/written | Implement, test | Exposure choice |
| Background job / automation | Retries, waits, multi-step | Queues (buffering) and/or Workflows (durable steps) | Queue/Workflow binding, DLQ | 15 min wall per consumer; 1 GB state per Workflow; **no Workflows in WfP** | Sustained >5,000 messages/s on one queue | Messages, steps, storage | Author workflow, test failure paths | Destructive/external side effects |
| Per-user / collaborative state | Counters, presence, ordering | Durable Objects (+ D1 for records) | DO binding | Single-writer per object; alarms ≤15 min | Analytics/aggregate reporting | DO duration + storage | Implement, load-test | Cost ceiling |
| Agent-operated app | Agent reads/writes app data within scope | Worker API + scoped expiring grants (existing proposal flow) | Access + grant hashes, no secrets in prompts | Agent proposes; execution is separate and recorded | Unattended production authority | Model calls, review time | Everything bounded | Accept/reject; production |
| Isolated generated code | Run untrusted code without leaking prod | **Not supported today.** WfP untrusted namespace or Containers are provider options (L4) | Isolated bindings, egress control, per-tenant data | Needs abuse/quota/egress story | Any hostile-tenant scenario today | WfP $25/mo + usage; Containers | Nothing yet | Architecture decision |
| Genuine Linux need | A real container/VM | Out of scope: containers/K8s (#252/#253) | n/a | Different platform | n/a | n/a | Advise only | Choose platform |

The last two rows are the important ones. A guidance page that admits "we cannot host that" is more useful than one that lists a fake option.

---

## 7. Cloudflare limits we must state honestly

Everything here is provider documentation, not Composer evidence. Where two vendor pages disagree, I say so rather than picking the friendlier number.

### 7.1 Compute and runtime

| Limit | Value | Source |
| --- | --- | --- |
| CPU per HTTP request | Free 10 ms; Paid **5 min max, default 30 s** | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (2026-10-12) |
| CPU per Cron Trigger | 30 s for intervals <1 h; 15 min for ≥1 h | same — **but** [pricing](https://developers.cloudflare.com/workers/platform/pricing/) (2026-10-02) states "max of 15 minutes of CPU time per Cron Trigger or Queue Consumer invocation". **Docs disagree; verify per trigger in the account.** |
| Memory | 128 MB per isolate | Workers limits |
| Worker size / startup | 64 MiB / 1 s | Workers limits |
| HTTP wall time | No hard limit while the client is connected; `waitUntil` +30 s; runtime-update grace up to 20 min | Workers limits |
| Cron / Queue consumer / DO alarm wall time | 15 min | Workers limits |
| Subrequests | 50 free / 10,000 paid (configurable to 10M); 1,000 to internal services free | Workers limits |
| Simultaneous connections awaiting headers | 6 per invocation | Workers limits |
| Runtime model | V8 isolates, no durable process, no local disk, no arbitrary native binaries; Node is a subset with throwing stubs | [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/) (2026-09-18); [Node compat](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) (2026-08-12) |
| Local dev | `wrangler dev` runs `workerd`; simulated bindings; **Miniflare is not a security boundary** | [Local development](https://developers.cloudflare.com/workers/development-testing/) (2026-10-22) |

### 7.2 Data

| Limit | Value | Source |
| --- | --- | --- |
| D1 database size | **10 GB per database, cannot be increased**; 1 TB/account paid (increase by request); 50,000 DBs | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) (2026-10-24) |
| D1 throughput | Each database single-threaded; max ≈ 1 / query duration QPS; overload returns errors | D1 limits |
| D1 query/invocation | 1,000 paid / 50 free; 30 s max query; 100 bound params | D1 limits |
| D1 recovery | Time Travel to any minute, **30 days paid / 7 free**, always on, no extra cost; **no clone/fork yet**; export to R2 via Workflows for longer retention | [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) (2026-04-21) |
| D1/R2 jurisdiction | **eu / fedramp / us only**; D1 jurisdiction fixed at creation | [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/) (2026-10-02); [R2 data location](https://developers.cloudflare.com/r2/reference/data-location/) (2026-08-19) |
| R2 consistency | Strong read-after-write, metadata, delete and list; atomic `If-None-Match` create-once; cache on custom domains relaxes consistency | [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/) (2026-10-14) |
| R2 location | Location hints are **best effort** (`oc` = Oceania); not a residency guarantee | R2 data location |
| R2 egress | Free for Standard storage; Infrequent Access adds retrieval fees | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) (2026-10-01) |
| KV | Eventually consistent; up to 60 s+ propagation; not for atomic operations | [KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/) (2026-04-21) |
| Queues | 128 KB messages; 25 GB backlog; 14-day retention; 5,000 msg/s/queue; 15 min consumer | [Queues limits](https://developers.cloudflare.com/queues/platform/limits/) (2026-04-21) |
| Workflows | 1 GB state/instance; 10,000 steps (25k max); 50,000 concurrent; 30-day completed retention; **not deployable to WfP** | [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/) (2026-09-21) |

### 7.3 Delivery, environments and access

| Limit | Value | Source |
| --- | --- | --- |
| Version URL (was "preview URL") | Uses the version's **existing configuration and resources** — not isolation | [Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/) (2026-09-22) |
| Previews | Wrangler ≥ 4.135.0; 500/Worker paid, 100 deployments each; settings **not inherited**; service bindings → production; routes/cron → production; queue consumers cannot target a Preview; public by default | [Previews](https://developers.cloudflare.com/workers/previews/) (2026-09-24) |
| Wrangler environments | Separate Workers; **bindings and variables non-inheritable** | [Environments](https://developers.cloudflare.com/workers/wrangler/environments/) (2026-10-18) |
| WfP | $25/mo + 20M requests + 60M CPU-ms + 1,000 scripts; 30 s CPU; **no gradual deployments for user Workers**; `caches.default` disabled in untrusted mode | [WfP pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/) (2026-04-21); [WfP limits](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/limits/) (2026-10-13); [isolation](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/worker-isolation/) |
| Logs | **7-day max retention**; 256 KB/log; 5B/day/account; sampling; 20M logs included paid | [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) (2026-10-12) |
| Containers | Workers Paid; any language; full filesystem; Durable-Object-driven, on-demand | [Containers](https://developers.cloudflare.com/containers/) (2026-10-12) |
| Workers Paid price | $5/account/month minimum; 10M requests + 30M CPU-ms included | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (2026-10-02) |
| Access | IdP federation (OIDC/SAML), one-time PIN, service tokens, per-app policies | [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) (2026-04-21) |

**Three things a guidance page must never imply:**

1. That a Version URL is a safe place to test untrusted changes (it shares production config and resources).
2. That Workers can run "any container" (that is Containers; Composer does not use it).
3. That Cloudflare's data jurisdictions satisfy Australian residency (they do not, for D1/R2).

---

## 8. Decision matrix

| Idea from local-paas / peers | User value | Cloudflare fit | Composer today | Owner | Decision | Confidence / unknowns |
| --- | --- | --- | --- | --- | --- | --- |
| Immutable release + retained revisions | High — trust | Native (versions/deployments) | L1 | #219/#11 | **Adopt as guidance** | High |
| Readiness/health gate before promotion | High | Native (Preview/staging + verified post-deploy) | L1/L2 | #310/#319 | **Adopt** | High |
| Desired-vs-observed reconciliation | Medium-high | Read+compare only | L1 inventory, L3 drift | #318 | **Adopt (already owned)** | Medium — Tagging API beta |
| Backup manifest + restore drill | **Critical** | D1 PITR + R2 copy-out; no managed snapshot service | L6 | #118/#9 | **Adopt as drill, not tool** | High value, unknown RTO |
| Per-environment config/secrets shadowing | High | Native, but non-inheritable | L1 config, L5 docs | #310/#291 | **Adopt as guidance** | High |
| OpenBao-style vault | Low | Duplicates Cloudflare secrets + #291 | L1 secrets | #291 | **Reject** | High |
| ClickHouse local log store | Low | Logpush/OTLP instead | L1 logs | #266/#118 | **Reject** | High |
| Container/VM runtime with root | Negative (out of scope) | Containers exist, not Composer's job | L6 | #252/#253 | **Reject for product, point elsewhere** | High |
| Persistent local volumes | Negative | D1/R2/DO instead | L6 | #3/#21 | **Reject** | High |
| One-click app catalogue | Medium | Versioned Wrangler config + bindings | L1/L2 | #218/#286 | **Reuse existing** | High |
| Nix-based reproducible toolchain | Low | Node 22 + pnpm pin already exists | L1 | #316/#175 | **Reject** | High |
| Self-hosted PaaS control plane | Negative | Contradicts Cloudflare-first | L6 | #252/#179 | **Defer to research only** | High |
| Multi-tenant hosting | High but gated | WfP exists, unqualified | L6 | #216 | **No change** | Low until #217/#221 |

---

## 9. Recommendation and explicit no-change list

**Recommendation: report only, then four small guidance edits under existing owners.** No new issue is needed; nothing here justifies a prototype, a dependency, a service or a deployment.

1. **#286/#310 — "Which preview is which".** One page section: Version URL (shares production), Preview (separate settings, production service bindings, no queue consumers), `wrangler deploy --env` (separate Worker, non-inheritable bindings), local `workerd` (not a security boundary). Evidence: §7.3.
2. **#218/#286 — "Minimum useful stack" table.** Reuse §6 verbatim, including the two "we cannot host that" rows.
3. **#118/#9/#21 — backup vs restore honesty.** Add Coolify's and local-paas's framing to the recovery lesson that already exists in `/learn`: persistence ≠ backup; D1 PITR ≠ R2 recovery; a restore drill is the only proof. Then run the drill in the companion report (E3).
4. **#319 — local-first release contract.** Keep `pnpm check`/`build`/`deploy`; state that Previews are not yet wired and that Version URLs are not isolation.

**Explicitly do not do** (and record the decision so it is not re-litigated):

- No fork of local-paas, no Nix, no VM/container runtime, no second control plane.
- No vault, no new secrets service, no credential-store redesign (#291 stands).
- No new workflow engine, queue abstraction, or observability collector (#289/#266 stand).
- No template marketplace; recipes stay versioned configs with an owner (#218).
- No claim that documented provider features are tested Composer features.

**Evolution/history:** first dated report for #349. If Cloudflare changes Previews/Version URLs, WfP, or D1/R2 jurisdictions, re-review §7 and re-date this file rather than editing old conclusions silently. Prior architecture context remains in `docs/platform/field-guide.md` (2026-10-23) and `docs/platform/runtime-qualification.md` (2026-10-23); this report does not supersede their proposals, only grounds the user-guidance question.

---

## 10. Sources

**Reference platform (source-inspected, `82c7fe0d…`, 2026-10-24)**
1. https://github.com/ImLunaHey/local-paas — README, `docs/architecture.md`, `docs/runtime.md`, `docs/storage.md`, `docs/backups.md`, `docs/install.md`, `docs/paas-comparison.md`

**Peer platforms (vendor docs, retrieved 2026-10-25)**
2. Coolify — https://coolify.io/docs/applications/ · https://coolify.io/docs/knowledge-base/persistent-storage/ · https://coolify.io/docs/databases/ · https://coolify.io/docs/knowledge-base/environment-variables/
3. Dokploy — https://docs.dokploy.com/docs/core/applications · https://docs.dokploy.com/docs/core/backups
4. CapRover — https://caprover.com/docs/persistent-apps.html · https://caprover.com/docs/app-configuration.html · https://caprover.com/docs/one-click-apps.html
5. Railway — https://docs.railway.com/guides/environments · https://docs.railway.com/reference/volumes · https://docs.railway.com/guides/deployments
6. Render — https://render.com/docs/disks · https://render.com/docs/preview-environments · https://render.com/docs/blueprint-spec · https://render.com/docs/deploys

**Cloudflare (vendor docs, dates as marked)**
7. Workers limits — https://developers.cloudflare.com/workers/platform/limits/ [2026-10-12]
8. Workers pricing — https://developers.cloudflare.com/workers/platform/pricing/ [2026-10-02]
9. How Workers works — https://developers.cloudflare.com/workers/reference/how-workers-works/ [2026-09-18]
10. Node.js compatibility — https://developers.cloudflare.com/workers/runtime-apis/nodejs/ [2026-08-12]
11. Local development — https://developers.cloudflare.com/workers/development-testing/ [2026-10-22]
12. Wrangler environments — https://developers.cloudflare.com/workers/wrangler/environments/ [2026-10-18]
13. Worker Previews — https://developers.cloudflare.com/workers/previews/ [2026-09-24]
14. Version URLs — https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/ [2026-09-22]
15. Gradual deployments — https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/ [2026-10-18]
16. D1 limits — https://developers.cloudflare.com/d1/platform/limits/ [2026-10-24]
17. D1 Time Travel — https://developers.cloudflare.com/d1/reference/time-travel/ [2026-04-21]
18. D1 data location — https://developers.cloudflare.com/d1/configuration/data-location/ [2026-10-02]
19. R2 consistency — https://developers.cloudflare.com/r2/reference/consistency/ [2026-10-14]
20. R2 data location — https://developers.cloudflare.com/r2/reference/data-location/ [2026-08-19]
21. R2 pricing — https://developers.cloudflare.com/r2/pricing/ [2026-10-01]
22. KV consistency — https://developers.cloudflare.com/kv/concepts/how-kv-works/ [2026-04-21]
23. Queues limits — https://developers.cloudflare.com/queues/platform/limits/ [2026-04-21]
24. Workflows limits — https://developers.cloudflare.com/workflows/reference/limits/ [2026-09-21]
25. WfP limits / pricing / isolation — https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/limits/ [2026-10-13] · …/pricing/ [2026-04-21] · …/worker-isolation/ [2026-04-21]
26. Workers Logs — https://developers.cloudflare.com/workers/observability/logs/workers-logs/ [2026-10-12]
27. Containers — https://developers.cloudflare.com/containers/ [2026-10-12]
28. Access policies — https://developers.cloudflare.com/cloudflare-one/access-controls/policies/ [2026-04-21]
29. Enterprise AI vibe-coding reference architecture — https://developers.cloudflare.com/reference-architecture/diagrams/ai/enterprise-ai-vibe-coding-platform/ [2026-09-28]

**Repository evidence**
30. `wrangler.jsonc`, `package.json`, `scripts/delivery-journey.mjs`, `src/lib/access-boundary.mjs`
31. `docs/STATUS.md` (2026-10-25), `docs/platform/operating-path.md`, `docs/platform/runtime-qualification.md`, `docs/platform/field-guide.md`, `docs/platform/public-reference.md`, `docs/finops-attribution.md`
32. Issue #11 receipts (2026-10-25); issues #3, #21, #118, #179, #216–#221, #252–#257, #266, #286, #289, #291, #310, #318, #319, #349, #359
