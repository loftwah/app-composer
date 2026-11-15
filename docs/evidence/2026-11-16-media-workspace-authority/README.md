# Workspace-scoped media authority (#599)

Date: 15–16 November 2026 (Australia/Melbourne)
Base: `origin/main` `951b313`
Branch: `codex/batch-runtime-1115`
Scope: Composer's optional Oyster/Prints media capability. The separately
deployed Media Studio and its own grant contract are unchanged.

This change makes the capability safe to offer to more than one creator
workspace on one deployment. Everything below was exercised locally against the
real migration files, a D1-shaped SQLite database and a fictional provider
double. **No live provider call, credential, remote migration or deployment was
made.**

## What changed

| File | Change |
| --- | --- |
| `migrations/0029_media_workspace_authority.sql` | New scoped tables, owner receipts, custody copy of legacy rows |
| `src/lib/media-capability.mjs` | Scope vocabulary, request-id/credential/workspace validation, connection and job views |
| `src/lib/media-capability-runtime.mjs` | Server-derived scope, per-workspace handlers, dispatch/status/reconcile/import rechecks, agent grants, custody and adoption |
| `src/plugins/media.ts` | Native panel resolves the session scope before every read/write |
| `src/pages/api/media-agent.ts` | Agent route admits only a workspace grant and the four allowed actions |
| `src/plugins/media-admin.tsx` | Owner custody section, confirmed adopt action, agent copy |
| `src/plugins/media-admin.css` | Custody and confirmation styling |
| `src/plugins/media.ts` | Read payload carries the owner custody snapshot and its error state |
| `scripts/media-studio-agent.mjs` | Uses `MEDIA_AGENT_GRANT_TOKEN`; no administrative commands |
| `docs/media-studio.md` | Authority matrix, storage, custody and the bounded credential transition |
| `docs/inbox-workflows.md` | #598 reply-job contract and failing-gap list |
| `tests/media-capability.test.mjs` | Pure contract tests for the new validators and views |
| `tests/media-workspace-authority.test.mjs` | Two-workspace acceptance, custody, agent and unknown-outcome proofs |

## Enforcement

Authority is derived server-side and never from a request body.

- **Human session:** current workspace membership (`resolveWorkspace`) plus the
  workspace's `media-studio` / `studio-installation` grants. A workspace owner
  holds `read, edit, generate, publish, admin`; everyone else needs active
  grants. `mediaPermissions` mirrors `studioAccess`, and a parity test asserts
  the two produce the same action set for owner, editor and viewer fixtures.
- **Agent call:** the SHA-256 of the bearer token selects one owner-issued grant
  row. The row supplies the workspace, the permission subset, the revision and
  the expiry. A request-body workspace can only confirm a mismatch.
- **Admin:** `enable`, `disable`, `refresh`, `adopt`, `grant-agent` and
  `revoke-agent` require a human session that is both the deployment owner
  (EmDash role ≥ 50) and the workspace owner, and are refused on the agent path
  before dispatch.
- `status`, `reconcile` and `import` recheck the grant/membership; `generate`
  rechecks again immediately before the provider call, and a revoked authority
  turns the recorded intent into `refused` with `error_code='REVOKED'` instead of
  sending it.

## Migration and backfill rule

`0029_media_workspace_authority.sql` is additive and idempotent. It creates
`media_workspace_connections`, `media_workspace_jobs`, `media_agent_grants` and
`media_scope_events`, then copies legacy rows with `INSERT OR IGNORE`. It never
renames, drops or rewrites `media_capability` or `media_jobs`, so applying it
twice is a no-op and no provider call is possible from SQL.

**Automatic workspace backfill: none.** A pre-#599 row stores no workspace,
account or environment identity, and the old handlers ran with deployment-wide
authority, so no workspace owner is provable. Every legacy job is copied once
into owner custody:

```
workspace_id = 'custody:owner'
scope        = 'custody'
adopted_from = 'legacy:0027'
```

Custody is visible only to the deployment owner, is never mixed into a workspace
list, and is read-only. The only provable ownership path is the owner's explicit
`adopt` action, which records `adopted_from`, `adopted_at`, `adopted_by` on the
job and a `media_scope_events` row (`from`, `requestId`, `imported`). Adoption
makes no provider call. Re-running the migration after adoption cannot move the
row back: the copy is keyed on the job id and `INSERT OR IGNORE` never updates.

**Reversibility.** The change is forward-only in the D1 sense, but it is
reversible without data loss: drop the four new tables and the legacy tables are
exactly as they were. Reverting the runtime without dropping the tables leaves
legacy rows in custody, reachable by the old code, and new scoped rows unread by
it. No legacy row is modified by this migration, and removal loses only receipts
for work performed after it — never an original, a job, a prompt, an output or
an imported artifact.

## Two-workspace acceptance matrix

Fixtures: `ws-atelier-0001` (owner `fictional-owner-a`, editor
`fictional-editor-a`) and `ws-gallery-0002` (owner `fictional-owner-b`, viewer
`fictional-viewer-b`). Both connections point at fictional hosts;
`atelier` uses `OYSTER_CONNECTION_ATELIER_*` secrets, `gallery` is refused the
deployment-wide credential once `atelier` holds it.

| Case | Expected | Proven |
| --- | --- | --- |
| Distinct connections | Two rows, distinct ids, hosts and credential refs | Yes |
| Deployment credential bound once | Second workspace gets `LEGACY_SCOPE_TAKEN` | Yes |
| Credential ref cannot select another secret | `MEDIA_STUDIO_BRIDGE_SECRET` → `INVALID_CREDENTIAL_REF` | Yes |
| Cross-workspace job read | `JOB_NOT_FOUND`, identical message to a missing id, no id/prompt/workspace echoed | Yes |
| Cross-workspace import | `JOB_NOT_FOUND` | Yes |
| Cross-workspace idempotency replay | `SCOPE_CONFLICT`, no provider call, no existence confirmation | Yes |
| Same-workspace replay | Same job, `replayed: true`, `providerCalled: false` | Yes |
| Concurrent dispatch, one request id | One row, one generation, both callers see one job | Yes |
| Revoked `generate` grant | `FORBIDDEN` before the provider | Yes |
| Revocation between intent and dispatch | Job `refused` / `REVOKED`, zero provider calls | Yes |
| Disabled connection | `DISABLED`, jobs kept, other workspace still generates | Yes |
| Unknown outcome / timeout | `unknown`, `retryable: false`, no automatic retry | Yes |
| Explicit reopen | One extra provider call on the same request identity | Yes |
| Import | One object `media-studio/<jobId>.png`, recorded SHA-256, repeat is a no-op | Yes |
| Agent, deployment-wide legacy token | Refused (`FORBIDDEN` / `AGENT_SCOPE_REQUIRED` at the route) | Yes |
| Agent, read-only grant | `status` allowed, `generate` refused, zero provider calls | Yes |
| Agent, wrong workspace selector | `FORBIDDEN` | Yes |
| Agent, admin action | `FORBIDDEN` | Yes |
| Agent revocation / expiry | Both refuse the next call; a resolved scope still rechecks | Yes |
| Custody read | Owner only; never in a workspace list | Yes |
| Adoption | Explicit, audited, invisible to the other workspace, not repeatable | Yes |
| Custody panel | Count, retention note, date/kind/model/prompt excerpt/state/imported per job; empty and error states | Yes, data path; rendered section in the admin panel |
| Stale adopt | `updatedAt` compare-and-swap refused with `CONFLICT`, row unchanged | Yes |
| Grant parity with the native studio | Same action set for owner/editor/viewer | Yes |

Negative cases are covered by the same test file: cross-workspace read and
write, revoked grant, revoked agent grant, expired grant, replay inside and
across scopes, stale scope after revocation, and unknown/timeout not retried.

## Commands and results

```sh
node --test tests/media-capability.test.mjs tests/media-workspace-authority.test.mjs
# 26 tests, 26 pass (14 pure + 12 authority)

node --test tests/media-capability.test.mjs tests/media-workspace-authority.test.mjs \
  tests/migration-order.test.mjs tests/media-studio.test.mjs tests/member-access.test.mjs
# 45 tests, 45 pass

npx astro check
# 12 errors, all pre-existing generated-file imports (build.json, stack-status.json,
# get-ready-package.json) resolved by the check:types pre-steps; no error in a
# changed file.

pnpm check
# exit 0: astro check 0 errors (733 files), lint and format pass,
# 765 tests, 765 pass, 0 fail.
```

## Owner custody in the panel

The admin panel reads the custody snapshot beside the workspace status. It is a
separate read with its own gate, so a custody failure is reported next to the
workspace panel instead of hiding it.

- The **Owner custody** section renders only when the session is the deployment
  owner (`actor.platformAdmin`). Any other session sees an explicit refusal
  line; the panel route itself already refuses a non-owner, and the runtime
  refuses `custody` and `adopt` for an editor or an agent.
- It shows the count, the `custodyNote` retention note, and each job's created
  date, kind, model, 220-character prompt excerpt, state and whether an imported
  copy is kept. The list is read-only apart from adopt.
- **Adopt into this workspace** is a two-step confirmation. It names the
  previous scope (`custody:owner`), states that no provider call is made and
  nothing is charged, then sends the row's own `updatedAt` as the
  compare-and-swap identity. The server refuses a row that changed since it was
  rendered (`CONFLICT`) and the panel reloads. After success the panel reloads:
  the row leaves custody and appears under Project jobs.
- Empty (`No pre-workspace jobs are waiting in custody`), custody error, and
  non-owner states are explicit.
- Custody rows are never merged into the workspace job list.

## Live check for the pre-existing 13 November job

After the normal release, as the deployment owner:

1. Open **Features → Images & video**. Under **Project jobs** the pre-existing
   13 November job must **not** appear. A separate **Owner custody** section
   must appear with **1 job**, the custody retention note, and that job's exact
   created date (13 November), kind, model, prompt excerpt, state and whether an
   imported copy is kept (the retained `media_jobs` row is the reference).
2. Click **Adopt into this workspace**. The confirmation must name
   `custody:owner`, say the prompt/model/result/imported copy are unchanged, and
   say no provider call is made and nothing is charged. Cancel once and confirm
   both the job and the count are unchanged.
3. Confirm. The panel must reload, Owner custody must show
   `No pre-workspace jobs are waiting in custody`, and the same job id with the
   same created date, prompt, state and imported copy must now appear under
   **Project jobs** for the current workspace. Its Continue/Import affordances
   become available again; no provider call is made by the adoption itself.
4. Re-open the panel: the job stays in Project jobs, custody stays empty, and a
   second adoption is not offered. A stale confirmation (open the panel twice,
   adopt in the first tab, confirm in the second) must be refused with the
   reload message rather than moving the row twice.

## Known boundaries

- The panel has no workspace switcher or grant buttons yet. Owner custody and
  the confirmed adopt action are rendered; enforcement and receipts do not
  depend on presentation.
- The custody section is read-only apart from adopt, and it is rendered only
  when the session is the deployment owner (`actor.platformAdmin`). The panel
  route already refuses a non-owner.
- Imported files remain public-by-URL at `/media-studio/asset/<name>`, as
  before. The capability never returns another workspace's key and can only
  import from a job row in the caller's scope; withdrawal and deletion stay
  separate explicit operations.
- The deployment-wide `MEDIA_AGENT_TOKEN` is refused for workspace media calls.
  This is a deliberate narrowing: an operator must issue a workspace grant and
  replace the agent's token.
- The legacy deployment credential may back one workspace at a time. Additional
  workspaces need their own `OYSTER_CONNECTION_<NAME>_ORIGIN` / `_OWNER_KEY`
  Worker secrets.
- No remote D1/R2 migration, production deployment or live provider call was
  performed here.

## Live-release check for the deploying owner

After the normal `pnpm deploy` path (which runs the checks and build once,
applies `0029`, and uploads), verify on production:

1. Open **Features → Images & video** as the owner. The panel must show the
   workspace name and `Off`/`On` for that workspace only, and no legacy job may
   appear in the workspace list.
2. Confirm the legacy receipt: every pre-existing job is present exactly once
   under owner custody (the retained `media_jobs` table) and none is claimed by
   a workspace.
3. Enable one workspace against its real connection and confirm the catalogue
   loads; a second workspace without its own `OYSTER_CONNECTION_*` secrets must
   be refused with `LEGACY_SCOPE_TAKEN`.
4. `POST /api/media-agent` with the old `MEDIA_AGENT_TOKEN` must return
   `403 AGENT_SCOPE_REQUIRED`; after issuing a workspace grant, the returned
   token must run `status` for that workspace and be refused for another.
5. Disable the capability for one workspace and confirm its jobs remain listed
   while `generate` returns `DISABLED`, and the other workspace is unaffected.
