# Cloudflare technical review — 12 November 2026

Public-safe review pack for App Composer’s production Cloudflare deployment, the
Creator Hub reference and the supported agent surfaces. It records what was
inspected, what actually ran, what remains unverified and the next technical
risks. It contains no credentials, customer data, private messages, names or
contact details.

## Production identity

| Fact | Value |
| --- | --- |
| Public origin | <https://composer.loftwah.com> |
| Cloudflare account | `1003dc1d93af0ebea56b2f1252f89627` (Loftwah) |
| Environment | production |
| Zone | `loftwah.com` |
| Audit baseline source | `3292200c9951a979fc08e000790e82a6857d5f76` |
| Audit baseline Worker | `app-composer` version `adab0620-4a81-45ea-8e88-a1add6048899` |
| Review-pack release source | `ca15d9dd5d00787efc577fc295f0d419eef423fe` |
| Review-pack Worker | `app-composer` version `f5aaefa0-42cf-44e7-99e9-0f4fbc0a4348` (version 272, 100%) |
| Live source check | `/build.json` reports `ca15d9dd5d00787efc577fc295f0d419eef423fe` |
| Release guard | `pnpm deploy` from clean pushed `main`; 610 tests passed, 0 failed; release elapsed 87.1s |
| New public page | <https://composer.loftwah.com/cloudflare> |

The review-pack release added the public Cloudflare cost/operations page and its
navigation links. It did not add a binding, route, cron, secret, permission,
paid service or resource. The audit below was taken on the baseline and
rechecked after the release.

A separate maintained Hello reference release brought
<https://ready.loftwah.com> to source
`6411500a39f53d86a61bf4d3efd36f0db94331c7`, Worker
`fbf1a226-8c48-470c-bf3d-0431d13b7a70`. Its exact live source was verified. This
was a docs-only source change in that independent app, not an App Composer
runtime change.

## Declared and observed resources

The live Worker settings and the committed `wrangler.jsonc` agree.

| Binding | Type | Resource | Notes |
| --- | --- | --- | --- |
| `DB` | D1 | `app-composer-emdash` (`1b2b29c8-4109-4a5f-901a-befc91173bc5`) | 121 tables; ~2.54 MB file size observed |
| `MEDIA` | R2 | `app-composer-media` | 1 object, ~12.5 KB |
| `SESSION` | KV | `3a76800194064e498949fd7c251af7e3` (`app-composer-sessions`) | production namespace |
| `GUESTBOOK` | Service | `composer-guestbook-8428e16f61c25a4d` | composed Guestbook |
| `SHOWCASE` | Service | `composer-showcase-8428e16f61c25a4d` | composed Linkarooie |
| `GUESTBOOK_MEMBERS` | Service | `composer-guestbook-8428e16f61c25a4d#GuestbookMemberService` | named entrypoint |
| `CREATOR_HUB_GUESTBOOK` | Service | `creator-hub-guestbook` | Creator Hub reference |
| `CREATOR_HUB_SHOWCASE` | Service | `creator-hub-showcase` | Creator Hub reference |
| `ASSETS` | Assets | Worker static assets | `run_worker_first` for two demo videos |
| `USAGE_LIMIT` | Rate Limit | 60 requests / 60 seconds | per usage key |
| `CF_ACCESS_TEAM_DOMAIN` | Variable | `jolly-cake-2b85.cloudflareaccess.com` | Access team domain |
| `PUBLIC_ORIGIN` | Variable | `https://composer.loftwah.com` | exact public origin |
| `RESOURCE_ACCOUNT_ID` | Variable | `1003dc1d93af0ebea56b2f1252f89627` | resource inventory scope |
| `RESOURCE_ENVIRONMENT` | Variable | `production` | resource inventory scope |

Routing and triggers:

- Custom domain: `composer.loftwah.com` → `app-composer`, environment
  `production`.
- Workers.dev: `app-composer.loftwah.workers.dev` remains enabled. It serves the
  same Worker, is marked `noindex,nofollow`, and refuses administration with
  `403`.
- Cron: `* * * * *`. The scheduled handler also runs the existing EmDash
  scheduled work and daily retention tasks. No new schedule was enabled for
  this review.
- CPU limit: 1,000 ms per invocation.
- Observability: enabled, 10% head sampling.
- Secret store: 14 entries covering Access audience, EmDash encryption, owner
  and service tokens, usage tokens, notification delivery and GitHub
  integration. Values were not read, exported or reproduced.

Read-only account inventory on 2026-11-11 16:32 UTC (2026-11-12 03:32 AEDT):

| Measure | Value |
| --- | --- |
| State | verified (bounded GET read completed) |
| Declared | 21 |
| Declared and observed | 21 |
| Match | 21 |
| Drift / missing / unverified / inaccessible | 0 / 0 / 0 / 0 |
| Observed in scope | 109 (100 Workers, 4 D1, 3 R2, 2 KV) |
| Not declared | 88 Worker scripts, 0 storage |
| First-party identities verified | 8 / 8 |
| Unrelated account resources excluded | 63 |
| Provider requests | 36 GETs, zero writes |
| Cost | unknown, not zero |

The 88 undeclared Workers are 84 scripts from 42 earlier pinned compositions and
4 other `composer-*` scripts. Their retention, traffic and rollback role remain
unverified. No resource was deleted, tagged, adopted or retired.

## Preview isolation

Preview is a separate Worker deployment, not a path into production.

| Check | Production | Preview |
| --- | --- | --- |
| Worker | `app-composer` | `app-composer-preview` |
| Active version | `f5aaefa0-42cf-44e7-99e9-0f4fbc0a4348` | `17185697-8a1e-480a-b2fa-c33c7881bc0f` (17 Oct 2026) |
| Source annotation | `ca15d9dd…` | `aa1b8841…` |
| Custom routes | `composer.loftwah.com` | none |
| Cron triggers | `* * * * *` | none |
| Service bindings | 5 | 0 |
| D1 | `1b2b29c8…` | `bdbbe1c4…` |
| R2 | `app-composer-media` | `app-composer-media-preview` |
| KV | `3a768001…` | `2e7ac1e5…` |
| Rate limit binding | `USAGE_LIMIT` | none |
| Admin response | `302` to Cloudflare Access | `403` |
| Indexing | public production host | `noindex,nofollow` |

The preview Worker’s generated configuration has no services, routes or cron
triggers, and its D1/R2/KV bindings are distinct from production. `Handlers:
fetch, scheduled` describes code capability, not a trigger; the provider
schedule list is empty. The preview remains publicly reachable on
`app-composer-preview.loftwah.workers.dev`, noindexed, with isolated data and no
production-service path. It is stale and should be refreshed or retired
deliberately.

## Agent and MCP surfaces

| Surface | Transport / entry | Capabilities | Tested in this review | Untested or unsupported |
| --- | --- | --- | --- | --- |
| Get Ready core | Installed package / CLI | Local readiness checks, resumable private state, explicit bounded setup operations | Production archive downloaded; SHA-256 and 32 source hashes matched; installed outside Composer; 29 exports resolved; focused deterministic report verified | Current full Cloudflare/GitHub/agent run blocked by no active Codex session |
| Get Ready MCP | Local stdio, server `1.13.0` | `get_ready_check`, `get_ready_inspect`; optional domain, project, tool, skill and clone tools only when the host selects them | 64 focused MCP/readiness/package tests passed; 14 MCP checks in the injection evaluation | Native host discovery/use, a current full standard-host run, hosted API |
| Agent proposal MCP | Local stdio, three tools | `agent_capabilities`, `agent_brief`, `agent_submit`; proposal-only | 37 proposal/grant tests passed | Live owner-issued grant from an authenticated native session |
| EmDash MCP | `/_emdash/api/mcp` | `composer-stacks__agent_scope`, `__agent_brief`, `__agent_submit`; owner PAT scope `mcp:tools:composer-stacks` | Contract and scope tests passed | Authenticated production MCP call; review/deploy/approval via MCP is unsupported |
| Native EmDash admin | `/_emdash/admin` behind Access | Content, mini-app and proposal administration for an invited administrator | Anonymous refusal verified live | Authenticated visual pass in this review |
| Cloudflare MCP | External Cloudflare product | Cloudflare API operations according to its own auth | Not tested or provided by Composer | No Composer claim of Cloudflare MCP integration or endorsement |

Get Ready’s MCP tools accept no model-selected paths, accounts, targets,
credentials or setup authority. Optional setup tools are enabled only by the
trusted host at launch and are zero-argument. The default transport exposes no
cloud-write tool. A copied prompt, a proposal or an imported report does not
execute or approve anything.

The real standalone consumer was installed from the live archive and run
against this workspace and the maintained Hello reference. GitHub permission was
verified. The run correctly reported the remaining gates as structured states:
`agent: action_required` (no active Codex session) and
`cloudflare: action_required` (no pinned workspace Wrangler in that test
workspace). The Hello exact-source gate was resolved by the separate Hello
release above. This is not recorded as a passing current fresh-consumer run.

## Security, privacy and prompt-injection boundaries

- **Anonymous administration.** `https://composer.loftwah.com/_emdash/admin`
  returns `302` to the Cloudflare Access login. The same path on
  `app-composer.loftwah.workers.dev` returns `403`; the preview returns `403`.
  Double-encoded and path-confusion probes returned `400` or the same Access
  boundary. No anonymous administration path was found.
- **Access JWT.** Focused tests verify signature, issuer, audience and expiry,
  and reject forged, wrong-audience, wrong-issuer and expired assertions.
- **Prompt injection.** The deterministic evaluation covers 7 untrusted-input
  boundaries, 58 cases and 14 MCP checks. Two runs were identical and passed
  with zero failures. The boundaries include inspection imports, review prompts,
  public report payloads, role packs, setup guides, Init specifications and
  readiness MCP results.
- **Rate limits and caps.** `USAGE_LIMIT` is 60 requests per 60 seconds per usage
  key. Public count ingestion also requires a per-app bearer token, accepts only
  a 256-byte JSON body and records at most 1,000 events per app/event/day.
  Resource-action recording requires same-origin requests, accepts at most 128
  bytes and shares the 1,000/day cap. No public mutation path can create a cloud
  resource, deploy or spend.
- **Secrets.** The Worker secret values were not read. The production
  publication-privacy gate scanned the live surface and archives and reported
  zero findings: `.env`, `.dev.vars`, `.git`, private keys and service-account
  files returned `404`. Public archives contain only the reviewed allowlists,
  licence, README and source record.
- **Public downloads.** `get-ready-core.tgz` is 123,516 bytes,
  SHA-256 `3df2a531…b871011f`, 33 members, source `ca15d9d`, MIT, 0 runtime
  dependencies. `get-ready-mcp.tgz` is 135,326 bytes, SHA-256
  `21c5c13f…722fa514`, 39 members, source `ca15d9d`, MIT, 2 SDK dependencies.
  Their manifests report `developmentSnapshot: false`; installed source hashes
  matched `SOURCE.json`.
- **Private context.** No private Cloudflare group chat, message, participant
  name, contact detail or private screenshot was read, copied or published in
  this pack.

## Cost and operations

The public page is <https://composer.loftwah.com/cloudflare>. It separates:

1. Cloudflare’s attributed Baselime precedent — daily $1,940 → $325,
   annualised $708,100 → $118,625, about 83% lower for that workload. This is
   Cloudflare’s estimate for Baselime, not an App Composer result.
2. The Creator Hub reference’s observed usage — 1,660 Worker requests, 2,841 D1
   rows read, 138 rows written, 249,856 bytes of D1 storage and about 0.12 MB of
   R2 storage across 31 days. At those volumes the usage is inside the Workers
   Paid included allowances; the account minimum is US$5/month. This is not an
   isolated bill for the two apps.
3. Assumption-labelled growth examples using Cloudflare’s published Workers
   pricing examples. D1, R2, Access, domains, agent usage and labour are
   separate.

Current pricing sources were rechecked on 12 November 2026:
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
Cloudflare’s published Baselime case study is
[here](https://blog.cloudflare.com/80-percent-lower-cloud-cost-how-baselime-moved-from-aws-to-cloudflare/).

## Production captures

Inspected live at 1440 × 1000 and 390 × 844:

- [Desktop, dark theme, full page](cloudflare-desktop-dark.png)
- [Phone, light theme, full page](cloudflare-phone-light.png)

The captures show the operating-model diagram, the Baselime attribution table,
the measured Creator Hub usage, the growth assumptions and the limits section.
The page had one `h1`, four captioned tables, no missing image alt text and no
horizontal overflow at either width. The only console error was the known
CSP-blocked Cloudflare Insights beacon.

## Checks run

| Check | Result |
| --- | --- |
| `pnpm check:types` | 0 errors, 0 warnings, 81 existing hints |
| `pnpm deploy` | dependency audit, 610 tests (0 failed), production build, migrations, upload, live source/pinned services, sharing, publication privacy, anonymous admin and release record passed in 87.1s |
| `node --test tests/access-boundary.test.mjs tests/injection-boundary.test.mjs tests/readiness-mcp.test.mjs tests/readiness-package.test.mjs tests/delivery-journey.test.mjs` | 64 passed, 0 failed |
| `node scripts/eval-injection-boundary.mjs --json` | 7 boundaries, 58 cases, 14 MCP checks, 0 failures |
| `node --test tests/cloudflare-costs.test.mjs tests/public-pages.test.mjs` | 4 passed, 0 failed |
| `node --test tests/provider-inventory.test.mjs` | 16 passed, 0 failed |
| `node --test tests/agent-proposals.test.mjs tests/agent-grants.test.mjs` | 37 passed, 0 failed |
| Live `/cloudflare` | 200; one `h1`; 4 table captions; no missing image alt; 1440 and 390 widths with no horizontal overflow; only the known CSP-blocked Cloudflare Insights beacon in console |
| Live `/build.json` | exact source `ca15d9d` |
| Live admin boundary | production `302` to Access; Workers.dev and preview `403`; encoded probes `400` |
| Provider inventory | 36 GETs, 0 writes, 21/21 declared observed and matching, 0 drift |

## Remaining gates

- **#22 — standalone Get Ready consumer.** Package, licensing, provenance and
  the one-engine boundary are verified on the current release. A current
  full-flow run still needs an active Codex session; the local Codex account is
  over its usage limit until 10:23 on 12 November 2026. The maintained Hello
  source now matches its live revision. Leave open until that run completes.
- **#170 — Cloudflare cost/operations.** Acceptance is met by the public page,
  attributed precedent, measured Creator Hub scenario, assumption-labelled
  growth table, diagram, production screenshots and live validation.
- **#319 — delivery experience.** Local-first profile, candidate/release binding
  and a real Jenkins candidate exist. Remaining: authenticated Delivery runs
  visual pass, a Jenkins `--release` run and the EKS reuse path.
- **#318 — Cloudflare operations.** Read-only inventory and drift comparison are
  current. Remaining: hosted least-privilege provider read, native tag
  create/update, ownership/retention of 88 undeclared Workers, Preview/Queues/
  Workflows/Durable Objects coverage and the authenticated App resources view.
- **#14 — Codex runtime.** The maintained Hello exact-source gate is resolved.
  A fresh active-Codex run that makes a real Cloudflare tool call is still
  blocked by the Codex usage limit; no broader runtime is claimed.
- **#12 — capability registry.** models.dev conditional fetch/304 and
  last-known-good evidence exist. ACP and MCP registry adapters, scheduled
  refresh and material-change actions remain open.
- **#35 — Chrome extension.** MV3 source and local ZIP exist. Real Chrome
  installation on `dash.cloudflare.com`, account-context verification, store
  distribution and non-official-integration labelling acceptance remain open.
- **#425 — flagship.** The native Creator Hub reference and admin path are live.
  The described follow-up app/admin change, source update/refusal/recovery,
  Fungi/Oyster capability and a consenting non-technical participant remain
  open.

## Next three technical risks

1. **Public stale preview.** The preview Worker is publicly reachable on
   `workers.dev`, noindexed and isolated from production data/services, but its
   code is from 17 October 2026. Refresh or retire it deliberately.
2. **Undeclared Worker inventory.** 88 observed Worker scripts are not declared
   by the current composition. Retention and rollback ownership are unknown;
   names and tags do not authorise deletion.
3. **Conservative exact-source gate.** A docs-only commit makes a maintained
   app’s live `/build.json` stale until redeployment, even when runtime bytes are
   unchanged. This is safe but can block readiness; review whether the gate
   should compare a reviewed runtime artefact or continue to require a
   redeploy.

## What reviewers should inspect first

1. <https://composer.loftwah.com/build.json> — exact live source.
2. <https://composer.loftwah.com/cloudflare> — the cost/operations page at
   desktop and phone widths.
3. The preview Worker’s settings and schedules in the Cloudflare dashboard or
   with the redacted commands below — no services, routes or cron, distinct
   D1/R2/KV.
4. `/_emdash/admin` on the custom domain, Workers.dev and preview — Access
   redirect / refusal, no bypass.
5. `/downloads/get-ready-core.json` and `/downloads/get-ready-mcp.json` — size,
   SHA-256, source and licence manifests.
6. The public evidence images in this directory.

## Reproduction commands (redacted)

```sh
curl -sS https://composer.loftwah.com/build.json
npx wrangler deployments list --name app-composer --json
npx wrangler versions view <active-version> --name app-composer
npx wrangler deployments list --name app-composer-preview --json
npx wrangler versions view <preview-version> --name app-composer-preview
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/app-composer-preview/schedules"
node scripts/provider-inventory.mjs snapshot --json
node scripts/provider-inventory.mjs compare --snapshot <snapshot> --revision <sha> --json
node --test tests/access-boundary.test.mjs tests/injection-boundary.test.mjs \
  tests/readiness-mcp.test.mjs tests/readiness-package.test.mjs \
  tests/delivery-journey.test.mjs
```

Credentials were supplied only through the operator environment. No credential,
private message, participant identity or contact detail is included in this
record.
