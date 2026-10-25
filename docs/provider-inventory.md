# Read-only Cloudflare inventory and first-party identity

Reviewed 25 October 2026. This page explains the on-demand, read-only Cloudflare
check behind **App resources → Cloudflare check**, the meaning of each summary
category, Composer's recorded identity for the eight first-party app Workers,
and the least-privilege operator path when the hosted check has no credential.

The check is not a resource manager. It never creates, changes, tags, deploys,
retires or deletes anything, keeps no credential in the browser, and stores no
provider result. A name, description or tag is evidence at most; it is never
ownership, access or billing authority.

## Reconciled categories

Earlier summaries mixed objects that cannot be added together. The current
summary keeps these axes separate.

| Category | Meaning | Is not |
| --- | --- | --- |
| **Declared / expected** | Composer's committed declaration in `wrangler.jsonc`, `composition.lock.json`, the promotion boundary, and each app's committed Wrangler manifest. | Provider truth, proof of existence, or a grant. |
| **Observed** | In-scope resources returned by the allowlisted GET reads at the labelled UTC time. Unrelated account resources are excluded and counted only. | A clean or complete account scan. |
| **Declared and observed** | Declared resources actually returned in this observation. It equals `match + drift + stale/unverified-but-observed`. | The same as `match`. |
| **Match** | Observed declared resource whose read checks all agree, whose identity is recorded, and whose observation is current. | Health, ownership, cost or current release. |
| **Drift** | Observed declared resource where at least one read field differs. | The stored App resources “app-source drift”, which compares a saved stack with the last app-confirmed build. |
| **Missing** | Declared resource absent from a list that was actually read successfully. | Proof it never existed. |
| **Unverified** | A declaration could not be confirmed: a check field or identity signal was not read, the observation is stale, or no provider identity is recorded. | Not read and inaccessible are distinct; neither is a match. |
| **Inaccessible** | A required read was attempted and the provider refused or failed it (for example 401/403, timeout, malformed reply). | Absent, empty or unverified. |
| **Not declared / undeclared** | Observed in-scope resources that no current declaration covers. Split into Worker scripts and storage, and Worker scripts into earlier pinned compositions and other `composer-*` scripts. | Safe to delete, orphaned, or third-party. |
| **First-party** | Composer/Loftwah apps and composition services. | Verified merely by a familiar name. |
| **Third-party / unrelated** | Account resources outside the Composer scope. They are counted, never listed in comparisons. | Part of the Composer inventory. |
| **Stored** | Composer D1 records: app resources, saved stacks, app-confirmed operations, findings, attention items. Their freshness is a recorded operation time. | Current provider state. |
| **Live** | The bounded provider observation displayed by this check. It is not saved unless the operator imports a local compare file. | Stored history or provider health. |

Freshness rule: an observation older than 24 hours is `stale`/unverified, never
current. The check records both UTC and Australia/Melbourne time.

## Summary arithmetic

For one observation:

- `declared = match + drift + missing + unverified + inaccessible`.
- `observed in scope = declared and observed + not declared`.
- `not declared = undeclared Worker scripts + undeclared storage`.
- `undeclared Worker scripts = earlier pinned compositions + other composer-* scripts`.
- `needs attention` counts **findings**, not resources. It is a severity
  summary, not an inventory count.

A declared resource that is missing is not observed, which is why the first
and second sums are different. The comparison throws rather than render an
unreconciled summary.

## Observation on 25 October 2026 02:14 UTC

Account `1003dc1d93af0ebea56b2f1252f89627`; one bounded GET-only read with the
operator's existing deployment credential. No tag, resource, secret or
deployment was written. 54 unrelated account resources were excluded.

| Measure | Value |
| --- | --- |
| Declared | 21 |
| Declared and observed | 21 |
| Observed in scope | 109 (100 Workers, 4 D1, 3 R2, 2 KV) |
| Match | 21 |
| Drift | 0 |
| Missing | 0 |
| Unverified | 0 |
| Inaccessible | 0 |
| Not declared | 88 Worker scripts (84 from 42 earlier pinned compositions, 4 other `composer-*` scripts) and 0 storage resources |
| First-party identities verified / unknown / drift | 8 / 0 / 0 |
| Needs attention | 1 finding (the 88 undeclared Worker scripts) |
| Cost | Unknown for every row; never zero |

The read completed (`state: verified`), which means the allowlisted GETs
answered — not that the account is clean, healthy or fully declared. The one
attention finding is the undeclared set below.

The 84 earlier-composition scripts are pairs of
`composer-guestbook-<composition-id-prefix>` and
`composer-showcase-<composition-id-prefix>` retained by prior reviewed
compositions. The 4 other scripts are `composer-guestbook-61300860`,
`composer-guestbook-integrated`, `composer-showcase-integrated` and
`composer-owned-reference`. None was individually adopted from a name or tag.
Their retention, rollback role and ownership are unverified; this check does
not mark them safe to retire.

Three storage resources are app-owned and declared from the standalone apps'
own committed Wrangler manifests: `composer-guestbook` D1
`1b7862f8-35ca-46cc-a37d-e21142f81e21`, `composer-showcase` D1
`c366203f-d880-4afc-a78e-d3e607146469`, and `composer-guestbook-photos` R2.
They are declared, observed and matching, but remain app-owned and read-only
here. Earlier summaries counted only Workers and treated these three as
invisible; the previous 109-resource observation therefore showed
`88 not declared` while omitting three storage resources. They are now
declared so storage cannot disappear from the arithmetic. A Composer-owned
composition resource and a first-party app-owned resource are still shown
separately by source.

### Follow-up observation — 25 October 2026 08:30–08:31 UTC

A fresh use of the existing GET-only adapter returned 109 in-scope resources,
21 declared/observed/matching, zero provider drift/missing/unverified/inaccessible,
88 undeclared Workers and zero undeclared storage. Fifty-four unrelated resources
were excluded. The normal observation used 36 GETs; a bounded follow-up selected
the four previously unexplained scripts using the same adapter (22 GETs).
No credential was copied to a Worker; no provider setting or resource changed.

| Script | Actual provider evidence | Current disposition |
| --- | --- | --- |
| `composer-guestbook-integrated` | Version `49f46bd1-71ed-434f-b2eb-951454f23a1f`, annotation names composition `1c74d860…`; D1 `1b7862f8…` and R2 `composer-guestbook-photos` are the existing production app storage. | Historical composition and shared production data; retain pending a separate rollback/retention decision. |
| `composer-showcase-integrated` | Version `29ffa56d-7072-4721-9fcd-b084d692f40d`, same composition annotation; D1 `c366203f…`; still service-binds `composer-guestbook-integrated`. | Historical composition with a live service dependency and shared app storage; not an isolated orphan. |
| `composer-guestbook-61300860` | Version `0a1ed5be-eed9-4e05-840a-46b5ab37d815`, truncated annotation describes the same old composition despite the different name; same production D1/R2 bindings. | Historical/shared-data candidate for review, not automatically safe to retire. |
| `composer-owned-reference` | Version `ee295a38-3e44-4c06-b33e-5c0caec0d3e8`; no deployment annotation, custom domain, schedule or storage/service binding returned. | Owner/retention/traffic and workers.dev exposure remain unknown. Review before any retirement proposal. |

The full old composition ID is
`1c74d860ea3c047817cbb785ce6c676cd5c2073dbbd48218f2159cd373f8c55f`,
recorded in [historical source 55941d3](https://github.com/loftwah/app-composer/blob/55941d3d1976f40facb9faf06701ebb55e79b0c9/composition.lock.json).
This corroborates the provider annotations rather than inferring history from a
name. The other 84 scripts still have only the previous composition-namespace
classification; their individual retention/ownership is not newly qualified.
Current Composer binds the `8428e16f61c25a4d` pair. Other account-wide incoming
references and actual traffic were not read, so absence from today's Composer
binding list is not orphan proof.

Preview's actual settings retained its distinct D1 `bdbbe1c4…`, R2
`app-composer-media-preview` and KV `2e7ac1e5…`, with no service bindings or
custom domain. This is configuration evidence, not audience/authentication or
provider health. Per-resource cost stays unknown. Bounded normalized receipts
are under ignored `output/provider-ownership-20261025/`; #11 owns the release
record and #318/#310/#314 retain the owner and hosted least-privilege gates.

### Stored drift versus live drift

The stored App resources view reported Guestbook app-source drift
(`be79c27d` confirmed against `5075d7be` expected). That compares a saved stack
configuration with the last app-confirmed build record. It is not provider
drift; the live provider comparison showed no drift. Neither surface is
provider health, and the live check is not written into the stored attention
queue (it would make an unconfigured deployment look healthy or stale by
accident).

## First-party Worker identity

Composer's declaration for each app Worker is recorded in
`src/lib/app-provider-identity.ts`: the app's committed Wrangler manifest
declares the Worker name, the app documents its production hostname, and a
release receipt records a version or commit. The check verifies identity only
when a provider signal agrees — the custom domain for that hostname, or the
app's own deployment annotation prefix. A matching name, description or tag
alone is **unknown**, not verified.

Observed 25 October 2026 02:14 UTC:

| App | Worker | Account | Env | Repo / committed manifest | Provider evidence in this observation | Status | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Guestbook | `composer-guestbook` | `1003dc1d93af0ebea56b2f1252f89627` | production | [app-composer-guestbook](https://github.com/loftwah/app-composer-guestbook) `wrangler.jsonc` `name` | Custom domain `guestbook.loftwah.com`; version `0bb238d1…` at 02:14 UTC; the app's live `/build.json` reported revision `10e4f43d…`; no deployment annotation is set. The #11 receipt (`ec9016ea…`, `5075d7be…`) predates the current deployment. | verified (route) | Compare the next standalone Guestbook release with #11; a newer version than the receipt is release activity, not drift. |
| Showcase | `composer-showcase` | same | production | [app-composer-showcase](https://github.com/loftwah/app-composer-showcase) `wrangler.jsonc` | Custom domain `showcase.loftwah.com`; version `dd59d1ea…` at 02:14 UTC; live `/build.json` revision `f0453bc2…`; no annotation. #11 receipt `23968fbc…` / `f1dd2795…` predates the current deployment. | verified (route) | Same as Guestbook; the standalone app and the pinned composition service are separate surfaces. |
| Hello | `composer-hello` | same | production | [app-composer-hello](https://github.com/loftwah/app-composer-hello) `wrangler.jsonc` | Custom domain `ready.loftwah.com`; version `e7086a4e-348b-42db-bb1a-d7df47863170` exactly matches the #11 receipt and live commit `db0a98c6…`. | verified (route + receipt) | No action; recheck only if the live build identity changes. |
| Carry / forward (State) | `composer-state` | same | production | [app-composer-state](https://github.com/loftwah/app-composer-state) `wrangler.jsonc` | Custom domain `ai.loftwah.com`; version `ab43cf01-39a9-4cc4-8cb1-a338eeca3919` exactly matches the #11 receipt and live commit `ab67e2f2…`. | verified (route + receipt) | Keep the synthetic-only gate until #31 is independently accepted. |
| Link Check | `composer-linkcheck` | same | production | [app-composer-linkcheck](https://github.com/loftwah/app-composer-linkcheck) `wrangler.jsonc` | Custom domain `share.loftwah.com`; deployment annotation `Link Check 252791de…` matches the app's live `/build.json` SHA; version `b191d372…`. #11 receipt `7c96b217…` / `7970d17e…` is older. | verified (route + annotation) | Compare the live version with the app's own release record before calling it current. |
| LDraw | `composer-ldraw` | same | production | [app-composer-ldraw](https://github.com/loftwah/app-composer-ldraw) `wrangler.json` | Custom domain `ldraw.loftwah.com`; annotation `LDraw fa7a2ab6…` matches the app's live `/build.json` source; version `f1858d85…`. The #11 source pin is `c9c2339a…`. | verified (route + annotation) | Compare the live annotation with the editor's `/build.json`; the catalogue pin is separate. |
| Paperwork | `composer-paperwork` | same | production | [app-composer-paperwork](https://github.com/loftwah/app-composer-paperwork) `wrangler.jsonc` | Custom domain `paperwork.loftwah.com`; annotation `Paperwork 9748b83d…` matches the app's live `/build.json` SHA; version `e96a42b5…`. #11 receipt `207a2858…` / `51f96278…` is older. | verified (route + annotation) | Same as Link Check. |
| Launch Kit | `composer-launch-kit` | same | production | [app-composer-launch-kit](https://github.com/loftwah/app-composer-launch-kit) `wrangler.jsonc` | No custom domain (documented as `composer-launch-kit.loftwah.workers.dev`; the account subdomain is `loftwah`). Annotation `Launch Kit 1ce11132…` matches the app's live `/release.json`; version `01a3a0c7-f15e-486e-a1c0-1b673a35d50f` exactly matches the #11 receipt. | verified (annotation) | No action; the workers.dev hostname is not read by this path, so the annotation is the identity signal. |

The app build identities (`/build.json`, `/release.json`, deployment
annotations) were read separately during the same run as the provider
observation. Independent app lanes release on their own schedule, so a version
can move between two reads; the table records what each read actually returned.

This table is evidence for identity, not an ownership grant. It also does not
prove that the recorded #11 release is the current one: several apps moved on
during this work (Guestbook and Showcase changed version between the 01:59 and
02:14 UTC reads), and independent app releases are expected.

## Why the hosted check is unconfigured

The deployed `app-composer` Worker's read-only settings list (GET
`/accounts/{account}/workers/scripts/app-composer/settings`, 02:14 UTC) contains
no `PROVIDER_READ_ENABLED` or `PROVIDER_READ_TOKEN` binding, and
`wrangler.jsonc` declares neither. The panel therefore reports
**Not configured / unconfigured**, makes no provider request and is not a clean
scan. No credential was created, copied, rotated or moved by this work; Access,
tags, resources and deployments were not changed.

A broad deployment credential must not be copied into the hosted role. The
existing deployment token is for release operations and is not a read-only
inventory grant.

## Least-privilege operator procedure

Only the owner (MP) can create or install a credential; an agent must not do it
on its own initiative. Follow this only when the owner explicitly authorises a
hosted read.

1. **Create a dedicated account-scoped API token** in the Cloudflare dashboard
   for **only** the Composer account. Include exactly these read permissions:
   - **Workers Scripts: Read** (Worker list, deployments, versions, tags,
     settings, schedules, custom domains and subdomain)
   - **D1: Read**
   - **Workers KV Storage: Read**
   - **Workers R2 Storage: Read**

   No Edit permission, no account-level Resource Tagging write, no zone, DNS,
   Access or billing permission, no user/API-token permission. Do not add
   `#com.cloudflare.api.account.tag.list` or a Super Admin / Workers Admin /
   Tag Admin role just to populate the tag display: the beta account-level tag
   scope is optional, and a missing per-Worker tag read leaves tags unverified
   without affecting identity, inventory or any write. An account-wide
   read scope is required to observe undeclared resources; restricting the
   token to named scripts hides the very drift this check exists to find.
   Prefer an expiry date and a named purpose (for example
   `composer-readonly-inventory`).
2. **Store it only as a Worker secret**: `PROVIDER_READ_TOKEN` on the
   production `app-composer` Worker
   (`npx wrangler secret put PROVIDER_READ_TOKEN --name app-composer` from the
   reviewed checkout, reading the value from the owner's password manager, never
   from the repository, shell history, browser or a prompt). Set
   `PROVIDER_READ_ENABLED=true` and `PROVIDER_READ_ACCOUNT_ID` to the account
   above as production configuration only. Do not add either to the preview
   environment; preview must stay unconfigured. Never put a credential in
   `wrangler.jsonc`, a D1 row, a compare file or a public spec.
3. **Test read before trusting it.** Locally, with the dedicated token in a
   shell variable:
   `CLOUDFLARE_API_TOKEN="…" node scripts/provider-inventory.mjs compare`.
   Expect one bounded GET-only read, `21 declared`, `21 match`, 8 verified
   identities, the current undeclared breakdown, cost unknown, and no write.
   Then open **App resources → Check Cloudflare now**. The first hosted read
   should show the same observation time, account and counts. A 401/403 means
   the token lacks a read permission; a different account is refused by the
   route. Neither is "healthy".
4. **Rotate and revoke.** Rotate at least every 90 days or immediately after
   any owner/session change: create the replacement token, update the secret,
   run the test read, then delete the old token in the dashboard. If the panel
   should stop reading, delete `PROVIDER_READ_TOKEN` (and the enable flag) and
   verify the panel returns to unconfigured. A lost or exposed token is revoked
   first, never "rotated later"; provider access logs and the token audit
   remain owner-visible.
5. **Bound and observe.** Keep the route's GET allowlist, request/deadline
   bounds and no-background-polling behaviour. A partial scan must stay
   partial: an unread list or detail is unverified, not refused or absent.

## Known limits

- Account-level Resource Tagging: `/accounts/{id}/tags` returned 403 to the
  local operator credential and `/resource-tags` has no route. Per-Worker tag
  reads are used as display evidence only; no tag is written.
- D1, R2 and KV native tags are not verified on this path. Their rows carry no
  tag assumption.
- The D1 list `num_tables` disagrees with the per-database read (0 versus the
  real count), so only the per-database value is used.
- One account only. Cross-account, Workers for Platforms, Preview routing,
  Queues, Workflows, Durable Objects and script content are not read.
- Cost is unknown for every resource; these reads do not expose per-resource
  charges.
- Provider names, domains and annotations are identity evidence at most. They
  do not prove ownership, permission or the right to retire a resource.

## Commands

- `node scripts/provider-inventory.mjs plan` — print the allowlisted endpoints
  and bounds; makes no network request.
- `node scripts/provider-inventory.mjs snapshot` — bounded GET-only read,
  written only under the ignored `output/provider-inventory/`.
- `node scripts/provider-inventory.mjs compare --revision <sha>` — reconcile the
  declaration with a snapshot and write a bounded compare file; use the
  deployed source SHA when comparing a live release.
- `node --test tests/provider-inventory.test.mjs` — focused category,
  identity, bound and panel checks.

Snapshots are local operator evidence with the existing credential, not a
Worker-side read, a new grant or a write.

## Inspect observed dependencies and changes

The existing `compare`/`report` command also writes an `-operations.json` and
adds an observed-dependency table to its Markdown summary. Declared accountable
owner and environment come from the committed expectations; undeclared resources
stay unassigned. Each observed service/D1/R2/KV binding names the Worker and
binding that references it. Only successfully read settings contribute edges.
A resource with no observed dependent is never marked safe to retire: other
Worker settings, external clients, Queues and Workflows may remain unread.

Supply `--previous output/provider-inventory/EARLIER-snapshot.json` with
`--snapshot output/provider-inventory/CURRENT-snapshot.json` to compare two
selected observations without any network request. Comparable observed version,
binding, domain and schedule changes are named. Missing list/settings coverage
stays unknown; list absence is not a deletion, ownership or retirement grant.
No temporal comparison is inferred when no previous observation is selected.
The existing stdout JSON check remains unchanged; the operations result is a
separate bounded artifact beside it. The command still performs no provider write
and reports monetary cost as unknown.
