# Agent proposals

Reviewed 2026/10/25 (Australia/Melbourne). This is the local-first proposal
channel for [#311](https://github.com/loftwah/app-composer/issues/311), using
the six role packs from [#315](https://github.com/loftwah/app-composer/issues/315)
and the ownership record scope from [#314](https://github.com/loftwah/app-composer/issues/314).
Trusted team provisioning from [#219](https://github.com/loftwah/app-composer/issues/219)
is limited here to issuing a scoped, proposal-only grant.

A proposal is a reviewable record. It is not an approval, a deployment
instruction or an access grant. Accepting a digest executes nothing. The
separate handoff artifact is for the existing authorised release or delivery
flow.

## What is supported

| Capability                                                     | Local slice                                                             | Connected production                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Owner issues a scoped grant                                    | `node scripts/agent-proposal.mjs grant` against one local SQLite file   | Not implemented. Would need an owner-only EmDash route and D1 migration        |
| Deterministic briefing                                         | Yes. Stored in `creator_agent_briefings`, digest over the exact content | Not implemented as a hosted service                                            |
| Agent submits a proposal                                       | Yes, through the local CLI. Repo + commit or local path + content hash  | No connected agent authentication                                              |
| Accept / request changes / reject                              | CLI and native EmDash admin page                                        | Native page exists, but production data and Access were not exercised          |
| Approval digest                                                | SHA-256 over canonical scope, source, evidence, risk and change         | Same contract                                                                  |
| Separate handoff artifact                                      | Yes, `prepared` and `not-performed`                                     | The artifact can inform an existing release, but no execution adapter is added |
| Production proposals                                           | Refused                                                                 | Not supported                                                                  |
| Hosted agent service                                           | None                                                                    | Not proposed by this slice                                                     |
| Deploy, merge, spend, invite, rotate credential, change access | Refused / not present                                                   | Outside this contract                                                          |

The local CLI is a lab tool. It asserts the agent and owner identities from
flags and verifies that the reviewer is the grant's named owner or fallback. It
is **not** connected authentication. Anyone who can run the CLI against the
database can assert an identity. The native route uses the EmDash session and
workspace membership; that is the stronger path, but it is still a local/preview
slice until an owner deployment and Access admission are independently verified.

## The workflow

1. **Owner issues a grant.** The grant names one workspace, app, environment,
   role pack and agent. It names an accountable owner and a different fallback.
   Its only mode is `proposal-only`, and it expires. Production scope is refused.
2. **Brief.** `brief` assembles the role pack's inputs, required evidence,
   output schema, stop rules and prohibited actions with the permitted evidence
   for that environment. The briefing is stored once and reused by digest.
   It is read-only for the agent.
3. **Submit.** The agent returns a bounded diff or 1–20 structured actions,
   cites only evidence permitted by that briefing, states a risk and names its
   source. The CLI computes a local source content hash or records a repo commit.
   Submission is one atomic write. A partial intent is not a proposal.
4. **Review.** A human accepts, requests changes or rejects. The decision names
   the reviewer, reason and exact digest. The proposer cannot review its own
   proposal. An agent identity cannot review at all. Only the workspace owner
   can accept through the native route; editors can request changes or reject.
5. **Revise.** Request changes allows a new version. The version increments and
   the previous digest stops being current. Rejected and accepted proposals are
   terminal; open a new briefing for another attempt.
6. **Accept.** Acceptance stores the exact accepted digest, source identity and
   reviewer. It creates no handoff and performs no execution.
7. **Verify.** Recompute the digest from stored content, compare the accepted
   digest, recheck the source and grant, and report every check.
8. **Handoff.** The owner may prepare a separate artifact for the existing
   release flow. The artifact records `execution: not-performed` and grants no
   deploy, merge, spend, credential or access authority.

## Commands

```sh
# Owner: issue a proposal-only grant for one fictional app and environment.
node scripts/agent-proposal.mjs grant \
  --db output/agent-proposals-20261025/proposals.sqlite \
  --workspace ws-fiction-trail --workspace-name "Fictional Trail Notes" \
  --app trail-notes --environment env-preview-qa --environment-kind preview \
  --account fiction-composer-preview --role programmer \
  --agent-id agent:opencode/lane-b --agent-name "OpenCode Lane B" \
  --owner-id fictional-owner-0001 --owner-name "Ada Nguyen" \
  --fallback-id fictional-owner-0002 --fallback-name "Sam Okafor" \
  --issued-by "Ada Nguyen" --expires-at 2026-10-27T00:00:00Z \
  --confirm-owner --now 2026-10-25T00:30:00Z --json

# Deterministic, read-only briefing for the agent.
node scripts/agent-proposal.mjs brief --db <db> --grant <grant> \
  --evidence output/agent-proposals-20261025/evidence.json \
  --as-of 2026-10-25T01:00:00Z --out output/agent-proposals-20261025/brief.md

# Agent: submit v1 from a local path, or a repo + commit.
node scripts/agent-proposal.mjs submit --db <db> --grant <grant> \
  --briefing <briefing> --evidence ev-01,ev-02 \
  --source-path output/agent-proposals-20261025/source-v1.md --repo-root . \
  --change output/agent-proposals-20261025/change-v1.json \
  --risk medium --now 2026-10-25T01:10:00Z --json

# Agent: submit v2 against the same proposal after a change request.
node scripts/agent-proposal.mjs submit --db <db> --grant <grant> \
  --briefing <briefing> --proposal <proposal> --evidence ev-01,ev-02 \
  --source-path output/agent-proposals-20261025/source-v2.md --repo-root . \
  --change output/agent-proposals-20261025/change-v2.json \
  --risk medium --now 2026-10-25T01:30:00Z --json

# Human: review the exact digest.
node scripts/agent-proposal.mjs review --db <db> --proposal <proposal> \
  --decision request-changes --actor-id fictional-owner-0001 \
  --actor-name "Ada Nguyen" --actor-kind human \
  --reason "Add the regression test and state the 422 contract." \
  --expected-digest <digest> --now 2026-10-25T01:20:00Z --json

node scripts/agent-proposal.mjs review --db <db> --proposal <proposal> \
  --decision accept --actor-id fictional-owner-0001 \
  --actor-name "Ada Nguyen" --actor-kind human \
  --reason "Checked the exact digest and the isolated source." \
  --expected-digest <digest> --now 2026-10-25T01:40:00Z --json

# Read state later without reconstructing a conversation.
node scripts/agent-proposal.mjs list --db <db> --workspace ws-fiction-trail
node scripts/agent-proposal.mjs show --db <db> --proposal <proposal>
node scripts/agent-proposal.mjs verify --db <db> --proposal <proposal> --repo-root .

# Separate handoff for the existing release flow. No execution.
node scripts/agent-proposal.mjs handoff --db <db> --proposal <proposal> \
  --actor-id fictional-owner-0001 --actor-name "Ada Nguyen" \
  --expected-digest <digest> --repo-root . \
  --now 2026-10-25T01:50:00Z --json
```

A repo source may also be submitted with `--source-repo <name-or-url>
--source-commit <sha>` and, when a checkout is available, `--checkout <path>`.
The CLI verifies a supplied checkout contains the commit. A repo + commit without
a checkout is treated as a declared immutable pin; the local CLI cannot prove the
commit exists without one. Local paths are the fully rechecked case.

`--now` is a local evidence clock for reproducible transcripts. It is not
accepted by the native route and does not grant authority.

`execute`, `deploy`, `approve` and `merge` are refused commands. The CLI has no
execution path.

## Digest and source rules

The canonical digest is SHA-256 over canonical JSON containing:

- contract version, briefing id and briefing digest;
- role pack and version;
- workspace, app, environment (id, kind, account);
- proposer identity;
- source identity: repo + commit, or local path + content hash;
- cited evidence, sorted by id;
- risk;
- the exact diff or structured actions.

It excludes database ids, review timestamps and submission timestamps, so the
same reviewable content is idempotent. It also excludes the local source
`checkedAt`; that is a freshness observation, not reviewable content. A later
identical submission therefore reuses the same proposal instead of creating a
row.

Any change to scope, source, evidence, risk or proposed change changes the
digest. Accepting an older digest after a revision is refused. Mutating stored
content without updating the digest is detected by recomputing it at review,
handoff and verify time.

## Review rules

| Rule                                                        | Result                            |
| ----------------------------------------------------------- | --------------------------------- |
| Reviewer is the proposer                                    | `SELF_APPROVAL`                   |
| Reviewer is an agent identity                               | `SELF_APPROVAL`                   |
| Reviewer is not the named owner or fallback                 | `REVIEWER_NOT_AUTHORISED`         |
| Expected version or digest differs from the stored proposal | `CONFLICT`                        |
| Stored content no longer matches the digest                 | `DIGEST_MISMATCH`                 |
| Source moved or is missing at acceptance                    | `SOURCE_STALE` / `SOURCE_MISSING` |
| Grant revoked or expired                                    | `GRANT_REVOKED` / `GRANT_EXPIRED` |
| Proposal already accepted or rejected                       | `ALREADY_ACCEPTED` / `TERMINAL`   |
| Same version reviewed twice                                 | `ALREADY_REVIEWED`                |

A local source is considered freshly checked for 10 minutes in the native route.
After that, acceptance is refused with `SOURCE_UNVERIFIED` until the local CLI
rechecks it. The CLI always rechecks before accepting. A repo + commit is treated
as pinned in the native route; a supplied checkout is rechecked by the CLI.

## Native admin page

The EmDash plugin `composer-stacks` adds **Agent proposals** at
`/_emdash/admin/plugins/composer-stacks/proposals`. It follows the existing
Orders page structure and CSS variables:

- list with state, role pack, app, environment, risk and version;
- detail with scope, grant state, owner/fallback, source identity, digest,
  briefing, evidence, proposed change, review history and next action;
- reason field with Accept, Request changes and Reject;
- accepted digest and a separate **Prepare handoff** action;
- handoff artifact with an explicit `execution: not-performed` statement.

The layout is single-column at 390px, uses native buttons, labels, select and
textarea controls, keeps a visible focus ring, and does not rely on pointer-only
interactions. The page reads from the same store module as the CLI; there is no
second approval implementation.

What the page does **not** do: create grants, submit proposals, execute a
handoff, deploy, merge, change access or contact a provider. Grant creation is a
local owner CLI action in this slice.

## Persistence

Migration `0016_agent_proposals.sql` adds:

- `creator_agent_grants` — scoped, expiring, proposal-only grants with owner,
  fallback and revocation fields;
- `creator_agent_briefings` — exact briefing content and digest;
- `creator_agent_proposals` — current version, state and accepted digest;
- `creator_agent_proposal_versions` — one immutable row per version with source,
  evidence, risk and change;
- `creator_agent_proposal_reviews` — human decisions with digest and reason;
- `creator_agent_proposal_handoffs` — prepared artifacts pinned to the accepted
  digest, always `execution = not-performed`.

The migration is forward-only. Local D1/SQLite is sufficient for this slice; no
production migration is claimed or required.

## Negative cases

Each case has a real test in `tests/agent-proposals.test.mjs`.

| Case                            | Test                                        | Observed refusal                                                                              |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Wrong workspace                 | wrong workspace or environment              | `GRANT_NOT_FOUND`                                                                             |
| Wrong environment               | wrong workspace or environment              | `SCOPE_MISMATCH`; briefing evidence from another environment is `WRONG_ENVIRONMENT`           |
| Revoked grant                   | revoked and expired grants                  | `GRANT_REVOKED`                                                                               |
| Expired grant                   | revoked and expired grants                  | `GRANT_EXPIRED`                                                                               |
| Stale proposed source           | source that moved                           | `SOURCE_STALE`; verify reports `ok: false`                                                    |
| Duplicate proposal              | duplicate submission                        | same proposal and digest; one proposal row, one version row                                   |
| Interrupted submission          | interrupted or partial submission           | `INVALID` before a row; a partial row is `INCOMPLETE`/`CORRUPT_RECORD` and cannot be accepted |
| Changed approval digest         | content mutated after review                | `DIGEST_MISMATCH`; state stays `changes-requested`                                            |
| Hidden secret material          | secret-like material                        | `SECRET_MATERIAL`; no row and the value is absent from the database dump                      |
| Self-approval                   | proposer and agent identity                 | `SELF_APPROVAL`; no review row                                                                |
| Production scope                | production scope and missing accountability | `INVALID` with “Production proposals are not supported”                                       |
| Evidence outside the briefing   | evidence outside the briefing               | `UNPERMITTED_EVIDENCE`                                                                        |
| Native route viewer/editor/CSRF | native admin route                          | `FORBIDDEN`; owner acceptance records `execution: not-performed`                              |
| CLI execute/self-approve        | CLI journey                                 | exit `2`, `NOT_SUPPORTED` / `SELF_APPROVAL`, no state change                                  |

Secret scanning refuses bearer tokens, provider-style keys, GitHub/Slack tokens,
PEM private keys, labelled secrets, environment-style values, credential URLs and
JWTs. Errors name the field and label, never the value. Source files with
secret-like filenames or content are not hashed into a proposal.

## Ownership and provisioning boundary

A grant is the only thing an agent receives, and it is proposal-only. It names:

- the accountable owner and a different fallback, both human;
- the workspace, app, service environment and account;
- the role pack and agent identity;
- an expiry.

Missing ownership refuses the grant. An agent cannot be its own owner or
fallback. An agent identity cannot review. Acceptance requires the named owner
or fallback; handoff requires the owner. The native route additionally requires
a current EmDash creator session and workspace membership.

#219 resource provisioning and provider account permissions remain separate.
This slice does not create Cloudflare resources, change Access, rotate
credentials or infer production policy from an environment name. Environment
identity is explicit in every briefing, proposal, review and handoff.

#314's operational contract is represented by the required owner/fallback and
the explicit scope, but this is not a claim that every existing app already has
a complete ownership record. Provider drift, authenticated owner administration
and production provisioning stay open.

## Evidence

The local journey and its refusal transcript are in
[`docs/evidence/agent-proposals-20261025/transcript.md`](evidence/agent-proposals-20261025/transcript.md).
The deterministic briefing is in
[`brief.md`](evidence/agent-proposals-20261025/brief.md). The full local
artefacts (SQLite database and command responses) were kept under ignored
`output/agent-proposals-20261025/` during the run; only the bounded, redacted
transcript and briefing are committed.

## Remaining gaps

- Connected agent authentication and a hosted agent runner are not implemented.
- Grant provisioning and submission are local CLI actions, not EmDash UI.
- The native review page was type-checked and a static CSS/markup harness using
  its actual classes passed at 390px with keyboard focus. Production D1, real
  Access admission, the authenticated native route and screen-reader use were
  not exercised in this slice.
- Repo + commit without a local checkout is a declared pin, not a proven commit.
- No execution adapter exists. The handoff must be carried out by a human using
  the existing release or delivery flow.
- Production proposals are refused. Multi-workspace and multi-account
  provisioning beyond the explicit scope are #219/#310 work.
