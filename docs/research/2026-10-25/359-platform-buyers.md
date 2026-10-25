# Platform buyers: what DevOps, platform and enterprise teams actually need

**Issue:** [#359](https://github.com/loftwah/app-composer/issues/359) · **Companion report:** [349-cloudflare-patterns.md](349-cloudflare-patterns.md)
**Research date:** 2026-10-25 Australia/Melbourne (AEDT, UTC+11) / 2026-10-25 UTC
**Product baseline inspected:** production Composer `5e012f98e15dceb009e98468d0e541e00401d918`, Worker `57c5873f-77a9-4c0c-a413-bd1d1ad4b2b4` ([#11 receipt, 2026-10-25 03:04 UTC](https://github.com/loftwah/app-composer/issues/11)); local inspection tree `d9f4dfd1456da10ead2d65951079f1e9606e9fc0` (PR #378 analytics naming only). This repository owns implementation; exact live identity remains #11's.
**Scope:** buyer/job evidence, capability-gap analysis and falsification tests. Not a sales plan, not an implementation authorisation, not a competing developer portal or control plane.

Evidence labels used throughout:

- **[F] fact** — read directly in this repository, or stated plainly by a primary document (quoted, with the document's own date).
- **[V] vendor claim** — a provider or provider-funded programme asserting something about its own product, market or survey population. Directional, not independently verified.
- **[I] inference** — my reasoning from the evidence. Explicitly not a customer statement. **No customer interviews, buying-intent data or willingness-to-pay evidence were collected.** Demand remains unknown per [#355](https://github.com/loftwah/app-composer/issues/355)'s rule.

Capability levels for Composer itself (used in every table):

| Level | Meaning |
| --- | --- |
| **L1** | Shipped and live-verified, with a dated #11 receipt |
| **L2** | Implemented and locally/`workerd`-qualified, not production-proven |
| **L3** | Implemented, not qualified end-to-end |
| **L4** | Provider-documented only — Composer has not exercised it |
| **L5** | Proposed/research (issue exists, no code path) |
| **L6** | Absent or explicitly unsupported |

---

## 1. The one-page answer

1. **The buyer need is real and is about toil, not about a portal.** DORA's platform-engineering capability page (last updated 2026-01-12) reports that "by 2025, adoption had become nearly universal, with 90% of organizations reporting the use of an internal developer platform and 76% establishing dedicated platform teams", and names the pitfalls buyers are trying to escape: the "build it and they will come" trap, "ivory tower", "ticket-ops", "big bang" and "one-size-fits-all". **[F, vendor-affiliated research]** — DORA is run by Google Cloud, so treat the percentages as a well-known industry survey rather than neutral measurement.
2. **The single strongest predictor of platform satisfaction is feedback quality, not feature count.** DORA's 2025 data: "the platform capability most correlated with a positive user experience is giving 'clear feedback on the outcome of my tasks'". CNCF's Platforms White Paper makes the same point structurally — a platform is "the thinnest reasonable layer", judged on interfaces and experience, and should rely on externally provided services rather than re-implement them. **[F]**
3. **Cloudflare already publishes the target architecture for this exact buyer.** Its enterprise AI vibe-coding reference architecture (last updated 2026-09-28) specifies Access at the entry point, sandboxes/containers or Dynamic Workers for untrusted code, Workers for Platforms in production, an outbound worker for egress and credential injection, per-tenant D1/KV/R2, dispatch-level limits, Logpush/Tail Workers/Analytics Engine, and resource tagging for ownership and cost. **[V]** — it is vendor guidance, not evidence that Composer implements it.
4. **Composer today is a credible single-team Cloudflare application studio, not a platform for other teams.** Live: one owner installation, Access-gated EmDash admin, eight independently released apps, composition pins, guarded deploy, readiness/Init specs, native agent-proposal workflow. Not live: any second-team production admission, any provider-provisioned per-team resource estate, any restore drill, any SSO/SCIM, any audit export, any enforceable quota. **[F]** — receipts in §3.
5. **The honest commercial position is narrower than "enterprise platform".** The only defensible wedge I can evidence is *Cloudflare-native application scaffolding + a real admin + agent-executable specs*, consumed by a small team directly or by a mature platform team as a recipe/handoff source behind their existing portal. Everything else — Kubernetes replacement, IAM, observability suite, multi-tenant hosting — is a no-fit today (§5) and should be said out loud (§4).

---

## 2. Dated primary-source evidence

All pages retrieved **2026-10-25**. "Doc date" is the page's own last-updated marker where it shows one; where a page shows none, only the retrieval date is claimed.

| # | Source | Doc date | What it actually establishes | Type |
| --- | --- | --- | --- | --- |
| S1 | [DORA capability: platform engineering](https://dora.dev/capabilities/platform-engineering/) | 2026-01-12 | 90% IDP use / 76% dedicated platform teams (2025); minimum viable platform; "shift down" cognitive load; clear feedback as top UX correlate; extensibility; J-curve; five named antipatterns; balanced scorecard (delivery + DevEx + adoption + task success) | [F] vendor-affiliated research |
| S2 | [DORA 2025 report overview](https://dora.dev/research/2025/dora-report/) | 2025 report | "AI's primary role is as an amplifier"; returns come from the organisational system, not tools | [F]/[V] |
| S3 | [CNCF Platforms White Paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/) | v1 lineage, maturity model added later; page shows no single revision date | Platform as product; UX; documentation/onboarding; self-service; reduced cognitive load; **optional and composable**; secure by default; platform teams own *interfaces*, not necessarily infrastructure; start with frequently-needed undifferentiated capabilities and a few engaged app teams | [F] vendor-neutral community |
| S4 | [CNCF Platform Engineering Maturity Model](https://tag-app-delivery.cncf.io/whitepapers/platform-eng-maturity-model) | v1 completed Oct 2023, iterating | Four levels — Provisional, Operationalized, Scalable, Optimizing — across Investment, Adoption, Interfaces, Operations, Measurement; explicitly "no level is inherently good or bad" | [F] |
| S5 | [CNCF Annual Cloud Native Survey](https://www.cncf.io/reports/the-cncf-annual-cloud-native-survey/) | published 2026-01-20 | 82% of container users run Kubernetes in production | [F]/[V] survey |
| S6 | [Cloudflare: enterprise AI vibe-coding platform reference architecture](https://developers.cloudflare.com/reference-architecture/diagrams/ai/enterprise-ai-vibe-coding-platform/) | 2026-09-28 | The full enterprise control set: Access + IdP federation, untrusted code isolation, outbound worker credential injection, per-tenant resources, dispatch limits, three-tier observability, tagging, "assume AI-generated code is untrusted" | [V] |
| S7 | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | 2026-10-12 | CPU 10 ms free / 5 min paid (default 30 s); 128 MB memory; 10,000 subrequests paid; 6 waiting connections; no hard HTTP duration while client connected; `waitUntil` +30 s; 15 min cron/queue/DO-alarm | [F] provider docs |
| S8 | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) | 2026-10-02 | $5/month account minimum; 10M requests + 30M CPU-ms included; +$0.30/M requests, +$0.02/M CPU-ms; duration unmetered | [V] provider price |
| S9 | [WfP limits](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/limits/) · [WfP pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/) | 2026-10-13 · 2026-04-21 | $25/month base, 20M requests, 60M CPU-ms, 1,000 scripts, 30 s CPU cap; **no gradual deployments for user Workers**; `caches.default` disabled in untrusted mode | [V] |
| S10 | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/) | 2026-10-24 · 2026-10-02 | 10 GB per database (cannot be increased), single-threaded per database, 30 s query, 1,000 queries/invocation paid, Time Travel 30 days paid; jurisdictions **eu / fedramp / us only**, fixed at creation | [F] provider docs |
| S11 | [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/) · [R2 data location](https://developers.cloudflare.com/r2/reference/data-location/) · [R2 pricing](https://developers.cloudflare.com/r2/pricing/) | 2026-10-14 · 2026-08-19 · 2026-10-01 | Strong read-after-write/metadata/delete/list; atomic conditional writes; cache relaxes consistency on custom domains; egress free (Standard); jurisdictions eu/fedramp/us; `oc` is a best-effort **location hint**, not a guarantee | [F] provider docs |
| S12 | [KV: how it works](https://developers.cloudflare.com/kv/concepts/how-kv-works/) | 2026-04-21 | Eventually consistent; up to 60 s+ propagation; not for atomic operations | [F] |
| S13 | [Worker Previews](https://developers.cloudflare.com/workers/previews/) · [Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/) | 2026-09-24 · 2026-09-22 | Previews = per-branch settings, 500/Worker paid, service bindings hit **production**, routes/cron target production, queue consumers cannot target a Preview, URLs public by default. Version URLs ("previously preview URLs") reuse the Worker's **existing configuration and resources** | [F] |
| S14 | [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/) | 2026-09-21 | 1 GB state/instance paid, 10,000 steps default, 50,000 concurrent, 30-day completed-state retention, unlimited wall time per step; **Workflows cannot be deployed to WfP namespaces** | [F] |
| S15 | [Queues limits](https://developers.cloudflare.com/queues/platform/limits/) | 2026-04-21 | 128 KB messages, 25 GB backlog, 14-day retention, 5,000 msg/s/queue, 15 min consumer wall time | [F] |
| S16 | [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) | 2026-10-12 | **Maximum log retention 7 days**; 256 KB max log; 5B logs/account/day; sampling; paid 20M logs included | [F] |
| S17 | [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/) | 2026-10-18 | Bindings and environment variables are **non-inheritable** and must be declared per environment | [F] |
| S18 | Cloudflare Access application/policy docs, incl. [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) and [applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/) | 2026-04-21 | IdP federation (OIDC/SAML), one-time PIN, service tokens, per-app policies | [F] provider docs |

**Deliberately not claimed:** Access seat pricing/entitlement. Cloudflare's public Zero Trust pricing page is client-rendered and returned no seat-cap text to a text fetch on 2026-10-25; the docs expose capability, not price. Confirm seat entitlement in the account before quoting anyone a number. Likewise, no SOC 2/IRAP scope is asserted here — supplier report scope, period and exceptions belong to [#256](https://github.com/loftwah/app-composer/issues/256).

### What the sources jointly say about buyer needs

Converging across S1/S3/S4 (industry) and S6 (vendor):

1. **A minimum viable platform beats a complete one** — one common workflow made demonstrably better (S1, S3).
2. **Self-service is the product** — request → capability without a ticket (S3, S1's "ticket-ops" pitfall).
3. **Feedback loops decide adoption** — clear outcome of *my* task, not dashboards for the platform team (S1).
4. **Composability is non-negotiable** — teams must be able to step outside the platform (S3), which for Cloudflare means direct Wrangler/Terraform must keep working.
5. **Maturity is contextual** — an organisation at CNCF level 1 needs documentation and a paved path, not a chargeback model (S4).
6. **Untrusted code and identity are the enterprise gates** — Access at the edge, isolated execution, credential injection, per-tenant data, egress control (S6).

Point 5 is the most consequential for Composer: **"enterprise" is at least three different buyers, and the same product cannot be the minimum viable platform for all of them.**

---

## 3. Composer's actual baseline (what every verdict below is measured against)

### 3.1 Shipped and live (L1)

| Capability | Evidence |
| --- | --- |
| Astro/EmDash Worker with D1 `DB`, R2 `MEDIA`, KV `SESSION`, `GUESTBOOK`/`SHOWCASE`/`GUESTBOOK_MEMBERS` service bindings, per-minute cron, rate-limit binding, `limits.cpu_ms: 1000`, `observability.head_sampling_rate: 0.1` | `wrangler.jsonc` [F] |
| Owner admin closed until Access JWT verification is configured; only `/_emdash` is Access-gated; exact-owner semantics elsewhere | `src/lib/access-boundary.mjs` (issuer/audience/RS256 verification) [F] |
| Guarded clean-pushed-main release with post-deploy verification; 1,148 tests, 1,252-file publication guard at the 25 Oct release | [#11 receipt 2026-10-25T03:04Z](https://github.com/loftwah/app-composer/issues/11) [F] |
| Eight independently released apps, exact source pins, composition revisions, mounted + standalone routes | `docs/STATUS.md` (25 Oct), README [F] |
| Get Ready readiness engine with resumable evidence; six clocked fresh-agent setup trials, two downloaded-kit evaluations | `docs/STATUS.md`, `docs/evidence/` [F] |
| Init: content models/forms, versioned portable specs, exported `project setup` | `docs/STATUS.md`, `/init`, `/setup` [F] |
| Native agent connection + proposal review (migration `0018`), scoped local MCP endpoint, refusal paths | `docs/STATUS.md`, `docs/agent-proposals.md` [F] |
| Role packs (Service Owner, Programmer, Architect, DevOps/SRE, Security, QA) with outputs, stop rules and negative tests | `docs/role-packs.md` [F] |
| Read-only Cloudflare inventory: 109 in-scope resources via 36 GETs, 21 declared/observed/match, 0 drift, 88 undeclared scripts; native panel **unconfigured** (no distinct `PROVIDER_READ_*` secret) | `docs/STATUS.md` (25 Oct), `docs/provider-inventory.md` [F] |
| Cost-attribution contract + read-only adapter; unknown is `null`, never `0` | `docs/finops-attribution.md` (25 Oct) [F] |

### 3.2 Implemented but not production-proven (L2/L3)

| Capability | State |
| --- | --- |
| Governed team path (standing policy, request, optional independent review, app-owned scoped Guestbook resource, immutable publication, reconciliation) | **L2** — exercised in native `workerd` at `25dc7589`; explicitly "does not create dedicated team infrastructure or admit a new person"; retirement, rotation, full restore and continuous health not implemented (`docs/STATUS.md`; `docs/platform/operating-path.md`) |
| Two-team isolation | **L2** — fictional two-team specimen; cross-team denial exercised locally, not against production providers (`docs/platform/demo.md`, `docs/platform/native-demo.md`) |
| Incident/availability exercise (hide + restore, correlated events to a local receiver) | **L2** — local, PagerDuty-shaped transport only (`docs/platform/incident-demo.md`) |
| Worker `env.preview` | **L2** — separate D1/R2/KV, **no** service bindings, rate limits or cron; `preview_urls:false`; no `wrangler preview` usage in scripts (`wrangler.jsonc`; `scripts/delivery-journey.mjs` refuses `CLOUDFLARE_ENV` for production) |
| Provider drift/tag reconciliation | **L3/L4** — #318 owns; Tagging API is public beta and `PUT` replaces the full tag set; Composer has not written tags |

### 3.3 Not present (L5/L6) — the enterprise gap list

No SSO/SCIM/group sync (#352/#257), no audit export, no policy-as-code beyond a small declarative schema (#218), no enforceable monthly quota (#220), no restore drill or data/media portability (#117/#118), no on-call/incident product (#215), no SLA/support contract, no commercial customer admission, no CI/GitOps integration beyond local scripts (#319/#254), no general IAM, no observability suite (#266), no Kubernetes/container runtime (#252).

### 3.4 What Composer is not (state this on any buyer-facing page)

- **Not a Kubernetes or container replacement.** Workers are V8 isolates with no persistent local disk, no arbitrary native binaries, no root, no host. Cloudflare Containers exist on the Workers Paid plan and are Durable-Object-driven, but Composer does not use them; "any container on Workers" is false.
- **Not a general IAM/IdP.** Access federates an existing IdP for admission to Composer's admin; it does not create users, groups, SCIM feeds or leavers process. Workspace roles are Composer-side only.
- **Not a full observability stack.** 7-day log retention, sampling, 256 KB lines; no metrics/traces product, no alert routing, no on-call.
- **Not a production-proven multi-tenant platform.** One owner account, one production Composer, platform path local-only, no hostile-tenant isolation test, no per-customer billing or abuse response.
- **Not a compliance certification.** Cloudflare's report scope is not Composer's; no IRAP/SOC 2 claim attaches to Composer.
- **Not a CI/CD or GitOps system.** Local scripts and a guarded deploy; no pipeline engine, no reconciler.
- **Not a secrets manager or vault.** Cloudflare secrets/bindings; #291 owns connections. Introducing a vault would duplicate an owner.
- **Not a CMDB/service catalogue replacement.** It can show a Service record; it is not the system of record for an enterprise estate (#314).

---

## 4. Segment buyers

Each segment below separates **job**, **must-haves**, **blockers**, **procurement/security questions** and **fit now**. "What would have to be true" is my inference, not a roadmap commitment.

### 4.1 Small product team (5–20 engineers, one or two products, Cloudflare-curious or already on Workers)

**Context.** This is the segment the shipped product actually addresses: a small team with no platform function, one owner, one Cloudflare account, a content surface plus a couple of small apps. DORA/CNCF level 1–2.

**Jobs to be done**
- Get a customer-facing site *and* a small app live this week with an admin the non-engineer can use.
- Keep the bill legible (Workers Paid minimum, storage, domains), avoid a cluster.
- Change something safely and roll back code when a release is bad.
- Hand the code to the next person/agent without a mystery dashboard.

**Must-haves** [F where provider docs say so]
- One-command local dev with simulated bindings, one-command deploy, and a rollback path (S7/S17; Composer `pnpm dev`, `pnpm check`, `pnpm build`, `pnpm deploy`).
- Environment separation that does not silently share production data (S17 non-inheritable bindings; Composer `env.preview`).
- Admin behind real authentication (Access JWT for `/_emdash`).
- Relational + object storage with a recovery story (D1 Time Travel 30 days; R2 strong consistency).
- Boring, honest limits (CPU 1 s configured here vs 30 s default; D1 10 GB/db).

**Blockers (evidence, not vibes)**
- **No verified restore.** `docs/STATUS.md`: data/media portability and isolated restore remain #117/#118. D1 Time Travel is provider capability; Composer has not drilled it. A team that loses its guestbook photos discovers this at the worst moment.
- **Preview is not isolation.** `env.preview` has no service bindings/cron; Version URLs reuse production resources (S13). A team that assumes "preview URL = safe sandbox" can write to production.
- **Single-owner admission.** No second person can be admitted to production without an owner-approved Access change (`docs/STATUS.md`, invited-members section).
- **No CI story.** Local-first by design and no GitHub Actions; if the team already lives in GitHub, there is no first-class integration yet (#319).
- **EmDash encryption-key operational gap observed in production** (`EMDASH_ENCRYPTION_KEY` format refused at the 25 Oct verification). [F, #11 comment 2026-10-25T03:28Z] [I] This is the class of failure a small team cannot debug alone; it is also an operational-honesty data point in Composer's favour that it was recorded rather than hidden.

**Procurement/security questions they will ask**
- Who holds the Cloudflare account and the domain? Can I take both with me?
- What happens to my data if I stop paying / stop using Composer?
- Is my admin login tied to my company IdP, or a separate account?
- Is the agent allowed to deploy, or only propose?

**Fit now: yes, conditionally — the strongest fit in this report.** Composer's real, shipped value (spec → build → guarded deploy → native admin → owned source) matches this segment's job better than the enterprise's. The conditions are: one owner, Cloudflare account, non-regulated data, and an explicit acceptance that restore is not yet proven. **Verdict: adoptable for a pilot with a written limitation list.**

**What would have to be true to widen it** [I]: one restore drill with measured RPO/RTO; a second admitted person with a scoped role; a preview path that cannot reach production data; one integration with the team's existing Git host.

### 4.2 Agency / MSP delivering for several client owners

**Context.** 2–20 people, many small client sites/apps, each client is a separate commercial and data boundary. The agency is *not* usually the data controller. Existing tools: WordPress + hosts, Vercel/Netlify, Cloudflare, spreadsheets for handover.

**Jobs to be done**
- Deliver a repeatable site/app per client quickly, with the client's own accounts and domain.
- Hand over source and admin so the client is not locked in (and so the agency can exit cleanly).
- Maintain N clients without N bespoke snowflakes; apply a fix once.
- Show the client evidence of what was delivered and what it costs.
- Offboard a client without deleting another client's data.

**Must-haves**
- Per-client separation of source, data, media, secrets, and billing.
- Export/exit that a client can accept (source + config + data references).
- Versioned updates that do not overwrite client customisation (#8/#114).
- A support/incident path and a named owner per client (#314).
- White-label presentation without forking the product.

**Blockers**
- **Tenancy is manual, not productised.** Independence today means separate repos/apps/Cloudflare resources per client, managed by an operator. The governed path creates "an app-owned scoped resource... on existing Workers/databases" and explicitly "does not create dedicated team infrastructure" (`docs/platform/operating-path.md`).
- **No customer onboarding.** New-person production admission requires an owner-approved Access change; no self-serve signup, no invitations actually sent (`docs/STATUS.md`).
- **No retirement/deletion lifecycle.** "Retirement, automatic resource deletion, credential rotation, promotion, full data restoration, provider exit and commercial customer admission are not implemented" (`docs/platform/operating-path.md`).
- **No DPA/subprocessor artefact, no SLA.** Legal blockers before the technical ones.
- **Billing is per Cloudflare account, not per client.** #312/#220 are the owners; neither is enforced.

**Procurement/security questions**
- Who is the processor for client personal data — the agency, Composer, or Cloudflare? [I] There is no documented Composer legal entity or DPA today, so this cannot be answered contractually.
- Can a client's admin be separated from the agency's operator access, and can that be revoked on offboarding?
- Where does client data live (D1/R2 jurisdiction)? Can it be pinned to Australia? **No** — D1 and R2 jurisdictions are eu/fedramp/us only (S10/S11).
- What is retained after termination, and can deletion be proven?
- Who is on call when a client site breaks at 2am?

**Fit now: partial, and only as an operator tool, not a platform.** The genuine agency assets are source ownership, independent app repos, config portability and composition pins. The blockers are tenancy, onboarding, deletion and legal. **Verdict: usable by a single agency that already operates Cloudflare accounts for clients; not sellable as multi-client hosting.**

**What would have to be true** [I]: a per-client workspace with provider-verified resource separation and a tested revocation; export/delete receipts; a support boundary someone is contractually responsible for.

### 4.3 Enterprise platform team (mature IDP, existing CI, security review, procurement)

**Context.** CNCF level 3–4. Already has Backstage/Port or an internal portal, Terraform, Jenkins/GitLab/Azure DevOps, an IdP with SCIM, a CMDB, ServiceNow change, Splunk/OpenSearch, PagerDuty, a security team with a vendor-risk process. Their default answer to a new portal is "no".

**Jobs to be done**
- Reduce lead time for a known workload class without adding a second control plane.
- Enforce policy at the point of effect, with evidence an auditor accepts.
- Keep ownership, cost and incident routing accurate as people move.
- Integrate with what exists; do not migrate the estate.

**Must-haves (all of these are gates, not nice-to-haves)**
- SSO + group→role mapping + leaver revocation; SCIM or a documented equivalent.
- Audit export with actor, target, decision, outcome, timestamp.
- Policy-as-code with reviewable change and exceptions that expire.
- Environment/resource isolation proven by negative tests, not naming.
- Backup/restore with measured RPO/RTO and a drill receipt.
- Observability with retention that matches incident practice (7 days is not it).
- Data residency and processor obligations satisfied.
- Support/SLA, security questionnaire answers, exit plan.

**Blockers (each with evidence)**
- **Identity:** Access JWT gates `/_emdash`; no SCIM, no group mapping, no directory-driven revocation. `docs/STATUS.md` states fresh Access admission needs an owner-approved change; #352 is still an investigation.
- **Audit:** request events record actor/action/plan digest — but there is no export, no retention policy, no tamper-evidence claim (`docs/platform/operating-path.md` "operation records").
- **Isolation:** no production hostile-tenant test; WfP (if ever used) has no native gradual deployments and requires untrusted-mode trade-offs (S9).
- **Recovery:** `docs/STATUS.md` §"Active mission gates" — app-owned content/media portability and isolated restore remain open. DORA's balanced scorecard would call this a failed-deployment-recovery gap.
- **Observability:** 7-day log maximum, 10% head sampling in this deployment (S16, `wrangler.jsonc`). No traces/metrics product, no alert routing.
- **Residency:** D1/R2 jurisdictions exclude Australia (S10/S11). For an Australian-regulated buyer this alone ends the evaluation for in-scope data.
- **Change/supply chain:** local-first scripts, no Jenkins/Terraform/ServiceNow adapter; #254/#255 are research.
- **Assurance:** no Composer SOC 2/IRAP; Cloudflare's reports do not transfer.
- **Commercial:** no SLA, no support contract, no DPA, no public multi-tenant service.
- **Cost:** measured/estimated/invoiced are separated correctly, but no enforceable quota and no chargeback (#220/#312).

**Procurement/security questions they will ask (checklist, not evidence of answers)**
1. Which IdP(s), protocols, and provisioning model? Group→role mapping? Leaver latency?
2. Where is data stored and processed, and can it be constrained to AU? (No, for D1/R2.)
3. What is the subprocessor list and the data-processing terms?
4. What audit evidence can be exported, in what schema, retained how long?
5. What are the tested RPO/RTO, and when was the last restore drill?
6. How is AI-generated/agent-generated code isolated from credentials and production data?
7. Who can approve a production change, and can that be separated from the requester?
8. What is the vulnerability disclosure and patch SLA? Is there a pen-test report?
9. What is the exit plan — source, configuration, data, media, DNS?
10. What is the support model and incident escalation path?
11. What happens on provider outage (Cloudflare), and what is the customer's responsibility?
12. Is any of this certified, or is certification inherited from Cloudflare's scope?

**Fit now: no-fit as a platform replacement.** Composer cannot be the IDP's control plane. **Possible narrow fit** [I]: as a *recipe/template and handoff source* — its versioned specs, role packs, readiness evidence and guarded deploy scripts are the kind of artefact a platform team would consume behind their existing portal. That integration does not exist and is #266/#255 research. **Verdict: do not sell to this buyer as a platform; offer it as a Cloudflare golden-path implementation they can fork.**

**What would have to be true** [I]: identity federation with group mapping and revocation; audit export; a restore drill; a supported observability route; and a named human accountable for support. That is a multi-quarter programme, not a release.

---

## 5. Fit / no-fit matrix

Symbols: **●** fit today with evidence · **◐** partial — usable with a named limitation · **○** no-fit today. "Owner" is the existing issue that would change the cell, not a new one.

| Buyer job | Small team | Agency | Enterprise platform | Binding constraint (owner) |
| --- | --- | --- | --- | --- |
| Self-service request → verified app | ◐ shipped for one owner; governed path local-only | ○ manual per client | ○ no SSO/policy/audit | #218/#219 |
| Golden-path recipes/templates | ● Init specs, 8 apps, role packs | ● source-owned repos | ◐ consumable, not integrated | #218/#286 |
| Environment separation | ◐ `env.preview` lacks services/cron | ○ per-client manual | ○ no prod isolation proof | #310/#219 |
| Immutable release + code rollback | ● versions, guarded deploy, #11 receipts | ● per app | ◐ no change record | #219/#254 |
| Data backup + restore (RPO/RTO) | ○ not drilled | ○ per client manual | ○ gate | #118/#9 |
| Observability + incident response | ◐ logs only (7-day) | ◐ per client | ○ no SLO/alerting/on-call | #266/#215 |
| Identity lifecycle (SSO/SCIM/leaver) | ○ Access JWT only | ○ | ○ | #257/#352 |
| Audit + change evidence | ○ operation records, no export | ○ | ○ | #220/#254 |
| Cost attribution + enforceable quota | ◐ contract + read-only adapter | ◐ | ○ no chargeback | #312/#220 |
| Ownership / on-call catalogue | ◐ workspace roles + owner records | ◐ | ○ no CMDB integration | #314 |
| Drift detection / reconciliation | ○ read-only inventory only | ○ | ○ Tagging API beta | #318 |
| Multi-tenant isolation / commercial hosting | ○ | ○ | ○ | #216 (gated) |
| Exit / portability | ◐ source + config export; data open | ◐ | ○ no tested exit | #253/#118 |
| Existing toolchain integration (Jenkins/Terraform/ServiceNow) | ○ n/a | ○ | ○ research only | #254/#255 |

Read the matrix as a **sales boundary**, not a defect list. Three cells are load-bearing: restore (#118), identity (#257/#352), and residency (Cloudflare constraint, not a Composer bug). Until those three move, the enterprise column stays empty regardless of feature work.

---

## 6. Five experiments that would falsify the positioning

Each is deliberately cheap, uses fictional or existing approved resources, and has a kill criterion. None authorises new paid infrastructure.

**E1 — Time-to-first-verified-app (falsifies "reduces toil")**
- *Hypothesis:* a competent developer using Composer reaches a live app with working admin faster than direct Wrangler + an EmDash/Astro starter.
- *Method:* three fresh sessions (at least two independent agents + one human) each start from `/setup`, target a fictional brief, and stop at a live HTTPS app with one authenticated admin action. Record wall time, human interventions, failed commands, and ambiguous provider results.
- *Measure:* minutes to live; number of manual handoffs; number of retries.
- *Kills the claim if:* Composer is not ≥25% faster **or** needs more human interventions than the direct path. (25% is an arbitrary but pre-registered threshold; record it before running.)
- *Owner:* #355/#376. *Authority:* none beyond existing local + one approved deployment target.

**E2 — Two-team negative isolation (falsifies "governed self-service")**
- *Hypothesis:* team B cannot read, write, approve, deploy, or infer team A's app via UI, direct API, preview URL, logs, or service binding.
- *Method:* reuse the #221 fixture; attempt at least 12 cross-boundary actions including a forged workspace id, a stale approval digest, a preview→production binding, and a log query.
- *Measure:* denied/allowed per action, with server-side evidence.
- *Kills the claim if:* any cross-team read or write succeeds, or a denial depends on the UI rather than the server.
- *Owner:* #219/#221. *Authority:* local first; cloud only with an approved isolated account.

**E3 — Restore drill with measured RPO/RTO (falsifies "recoverable")**
- *Hypothesis:* a fictional app's D1 rows, R2 media, configuration, revocations and deletions can be restored into an isolated target with known loss bounds.
- *Method:* snapshot → mutate (approve, hide, delete media) → destroy the isolated target → restore → verify each record, media byte, permission and revocation; repeat with a restore interrupted mid-flight.
- *Measure:* RPO (data lost), RTO (wall time), and every divergence.
- *Kills the claim if:* deleted media returns, revoked access returns, or restore silently drops newer records. (Composer already asserts the opposite behaviour is required; this tests it.)
- *Owner:* #118/#9. *Authority:* isolated fictional database + bucket only.

**E4 — Existing-pipeline integration cost (falsifies "fits your toolchain")**
- *Hypothesis:* an existing Jenkins or GitLab pipeline can invoke Composer's check/build/release semantics without a bespoke adapter per tool.
- *Method:* implement one adapter against the documented step contract (#319); count the lines, the credential plumbing, and the cases where the pipeline must know Composer internals.
- *Measure:* integration effort (hours), number of Composer-specific concepts leaked into the pipeline, and whether the receipt is trustworthy without Composer's UI.
- *Kills the claim if:* the adapter is tool-specific in more than a thin mapping layer, or the pipeline can post a fake "verified" result.
- *Owner:* #319/#254. *Authority:* local fixture; no new CI service.

**E5 — Procurement dry-run (falsifies "enterprise-ready")**
- *Hypothesis:* a security/procurement reviewer can answer the 12 questions in §4.3 from published material alone.
- *Method:* give the reviewer only the repo, `/platform`, `/manage`, `SECURITY.md` and #11; record which answers are "not documented", which are "documented but unverified", and which are "no".
- *Measure:* count of answerable questions; count of claims that overreach.
- *Kills the claim if:* fewer than 8/12 are answerable with evidence, or any published claim implies a control that does not exist.
- *Owner:* #256/#251/#360. *Authority:* none (desk review).

These five cover the four claims that matter commercially: *faster*, *governed*, *recoverable*, *fits*. If E1 and E4 pass but E2/E3 fail, the honest product is "a very good Cloudflare starter + admin", not a platform — which is still a business, just a different one.

---

## 7. Objection handling (answers Composer can defend today)

| Objection | Defensible answer | Do not say |
| --- | --- | --- |
| "We already have Backstage." | Then use Composer as a Cloudflare recipe/handoff source; do not add a portal. | "We replace Backstage." |
| "We're on EKS/Kubernetes." | Keep it. Composer targets Cloudflare-compatible workloads only; hybrid/container qualification is #252/#253 research. | "Any workload runs on Workers." |
| "Where's your SOC 2?" | Cloudflare's reports cover Cloudflare's scope; Composer has none. #256 owns the honest mapping. | "We're SOC 2 compliant." |
| "Can you guarantee Australian data residency?" | No for D1/R2 today (jurisdictions are eu/fedramp/us); Workers data-localisation regions are separate and do not fix storage. | "We're Australian-hosted." |
| "What's your SLA?" | None. There is no commercial service or support contract. | Any uptime number. |
| "Can our security team audit it?" | Yes, read the repo and SECURITY.md; there is no audit export or certification. | "Fully auditable." |
| "How do we get our data out?" | Source and configuration export exist; data/media portability and tested exit are #117/#118/#253. | "One-click export." |
| "Can it run our Java service?" | No. Containers/K8s are out of scope; Cloudflare Containers exist but Composer doesn't use them. | "Bring any container." |
| "Who's on call?" | Whoever you appoint. Composer has no on-call product (#215). | "We handle incidents." |
| "Can the agent deploy to prod?" | Only through the same authorised path a human uses; it can propose without authority. | "The agent runs production." |

---

## 8. Gap register

| Need (job) | Current evidence | Existing owner | Genuinely new? |
| --- | --- | --- | --- |
| Governed request → verified app | L2 local two-team path | #218/#219/#221 | No — needs production qualification, not new design |
| Env/preview correctness | `env.preview` incomplete; Version URLs share prod | #310/#319 | No |
| Restore with RPO/RTO | Not drilled | #118/#9 | No — needs a drill (E3) |
| Identity lifecycle | Access JWT only | #257/#352 | No |
| Audit export | Operation records only | #220/#254 | No |
| Observability/incident | 7-day logs; local receiver | #266/#215 | No |
| Cost/quota enforcement | Contract + read-only adapter | #312/#220 | No |
| Drift/tags | Read-only inventory; Tagging API beta | #318 | No |
| Existing pipeline adapters | Local scripts only | #319/#254 | No |
| Buyer/segment evidence | **This report** | #355/#359 | Yes — no prior segment job map existed |
| Time-to-first-app measurement | None | #355 (E1) | Yes — measurement method, not code |
| Procurement answer set | Scattered across #251/#256 | #256/#360 | Partly — consolidate, don't duplicate |

No new implementation issue is justified by this report. The two genuinely new artefacts are (a) the segment job map and (b) the experiment protocol; both belong to #355/#359.

---

## 9. Publication handoff for #355 / #360

A buyer-facing page should lead with the job and the limit, in this order:

1. **Who it helps:** a small team or solo operator on Cloudflare who wants a real admin, owned source, and an agent that prepares and releases work.
2. **What changes:** describe the app → get a versioned spec → agent implements → guarded release → native admin → evidence receipt. One request, one owner, one account.
3. **How to try it:** `/setup` → `/init` → the eight public apps → `/platform` for the governed path's *actual* status.
4. **What is still unsupported:** restore drill, second-person admission, preview isolation, SSO/SCIM, audit export, AU data residency, SLA. Say these on the same page, not in a footnote.
5. **Who it is not for:** Kubernetes/container estates, regulated data, mature IDPs wanting a replacement portal, agencies wanting multi-client hosting.

That framing survives E1–E5 failing; a "platform for the enterprise" framing does not.

---

## 10. Sources

Retrieved 2026-10-25 unless stated. Dates in brackets are the page's own last-updated marker.

**Industry / community**
1. DORA, *Capabilities: Platform engineering* — https://dora.dev/capabilities/platform-engineering/ [2026-01-12]
2. DORA, *State of AI-assisted Software Development 2025* — https://dora.dev/research/2025/dora-report/
3. CNCF TAG App Delivery, *Platforms White Paper* — https://tag-app-delivery.cncf.io/whitepapers/platforms/
4. CNCF TAG App Delivery, *Platform Engineering Maturity Model* — https://tag-app-delivery.cncf.io/whitepapers/platform-eng-maturity-model (source: https://github.com/cncf/tag-app-delivery/tree/main/platforms-maturity-model)
5. CNCF, *Annual Cloud Native Survey* — https://www.cncf.io/reports/the-cncf-annual-cloud-native-survey/ [published 2026-01-20]

**Cloudflare (vendor documentation; capability and price, not Composer evidence)**
6. Enterprise AI vibe-coding platform reference architecture — https://developers.cloudflare.com/reference-architecture/diagrams/ai/enterprise-ai-vibe-coding-platform/ [2026-09-28]
7. Workers limits — https://developers.cloudflare.com/workers/platform/limits/ [2026-10-12]
8. Workers pricing — https://developers.cloudflare.com/workers/platform/pricing/ [2026-10-02]
9. Workers for Platforms limits — https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/limits/ [2026-10-13]
10. Workers for Platforms pricing — https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/ [2026-04-21]
11. Workers for Platforms isolation — https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/worker-isolation/ [2026-04-21]
12. D1 limits — https://developers.cloudflare.com/d1/platform/limits/ [2026-10-24]
13. D1 data location — https://developers.cloudflare.com/d1/configuration/data-location/ [2026-10-02]
14. R2 consistency — https://developers.cloudflare.com/r2/reference/consistency/ [2026-10-14]
15. R2 data location — https://developers.cloudflare.com/r2/reference/data-location/ [2026-08-19]
16. R2 pricing — https://developers.cloudflare.com/r2/pricing/ [2026-10-01]
17. KV consistency — https://developers.cloudflare.com/kv/concepts/how-kv-works/ [2026-04-21]
18. Worker Previews — https://developers.cloudflare.com/workers/previews/ [2026-09-24]
19. Version URLs — https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/ [2026-09-22]
20. Workflows limits — https://developers.cloudflare.com/workflows/reference/limits/ [2026-09-21]
21. Queues limits — https://developers.cloudflare.com/queues/platform/limits/ [2026-04-21]
22. Workers Logs — https://developers.cloudflare.com/workers/observability/logs/workers-logs/ [2026-10-12]
23. Wrangler environments — https://developers.cloudflare.com/workers/wrangler/environments/ [2026-10-18]
24. Access policies — https://developers.cloudflare.com/cloudflare-one/access-controls/policies/ [2026-04-21]

**Repository evidence**
25. `docs/STATUS.md` (reviewed 2026-10-25), `PRODUCT.md` (2026-10-13), `ARCHITECTURE.md`, `SECURITY.md`
26. `docs/platform/field-guide.md`, `operating-path.md`, `runtime-qualification.md`, `demo.md`, `native-demo.md`, `incident-demo.md`, `public-reference.md` (all 2026-10-23 except as noted)
27. `docs/finops-attribution.md` (2026-10-25), `docs/provider-inventory.md`, `docs/agent-proposals.md`, `docs/role-packs.md`
28. `wrangler.jsonc`, `package.json`, `src/lib/access-boundary.mjs`, `src/lib/role-discovery.ts`
29. Issue #11 release receipts, 2026-10-25 (source `5e012f98…`, Worker `57c5873f…`, 1,148 tests); issues #216–#221, #251–#257, #310, #314, #318, #319, #351, #352, #291, #118, #215, #220, #312, #355
