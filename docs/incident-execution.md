# Execute one approved local recovery

The existing Incident Desk review now has a finite local execution consumer.
It restores one nullable caption in the fictional canary used by the native
incident lab. It does not run commands, deploy, install plugins, send mail or
select a production target. Approval still performs no execution.

The investigator submits one `configure` action targeting
`incident-canary.caption`. Its `detail` is strict JSON:

```json
{"version":"composer.caption-recovery/1","team":"fictional-team-a","expectedRevision":2,"expectedCaption":null,"caption":"The previously observed healthy caption"}
```

This action, incident, source and evidence are covered by the existing proposal
digest. After owner review, prepare the ordinary exact-digest handoff. The local
operator then selects the owned fixture root and invokes a plan before executing:

```sh
node scripts/incident-execution.mjs plan --root "$OWNED_FIXTURE" --workspace "$WORKSPACE" --proposal "$PROPOSAL" --digest "$DIGEST" --actor "$OWNER"
node scripts/incident-execution.mjs execute --root "$OWNED_FIXTURE" --workspace "$WORKSPACE" --proposal "$PROPOSAL" --digest "$DIGEST" --actor "$OWNER" --confirm-owner
```

These identities are asserted by the local operator, as in the existing proposal
CLI. This is not a connected authentication claim. There is no HTTP endpoint,
email approval URL, worker shell or remotely accepted execution token. Opening a
GET link can never invoke this command. An agent proposal-only connection gains
no execution capability.

The host-owned `incident-target.json` selects the fixture's local database,
source root, account, environment, workspace, app, loopback origin and known
healthy page/control hashes. Its schema is in
`scripts/lib/incident-execution.mjs`; the maintained native lab writes it from
fresh baseline observations. Proposal text cannot choose a database, URL or SQL
statement. Linked paths, remote URLs and mismatching scopes are refused.

Before dispatch the adapter holds a SQLite write transaction while rechecking
current proposal content/digest, accepted version, prepared handoff, active grant,
accountable owner, actual source bytes and exact current caption/revision. It
then commits the one fixed compare-and-swap and an execution receipt together.
The original approval and handoff stay immutable. Repeating that digest returns
the prior receipt and does not repeat the mutation.

A committed action starts as `applied-unverified`. Three independent HTTP page
samples must return 200 with the original body hash, and the other team's
control must match. Only then does the separate receipt become `recovered`.
Verification failure or an interrupted verifier leaves `applied-unverified`;
inspect the target and receipt before any new proposal. An old digest, revoked
grant, changed source, incompatible action or newer target revision stops before
mutation. A new action needs a new proposal and its own review.

## Repeat the proof

```sh
node --test tests/incident-execution.test.mjs tests/agent-proposals.test.mjs
node docs/evidence/incident-lab-20261025/run.mjs output/incident-execution
node labs/recovery/run.mjs output/recovery-drill/receipt.json
```

Use the host's shared validation reservation for the native browser command.
Its signed-in EmDash journey preserves investigation v1, send-back, revision v2,
stale 409 refusal and owner approval, then explicitly calls this adapter. The
subsequent SITREP retains the recovery evidence without rewriting the approved
candidate. The lab knows its predetermined fault; this is not blind autonomous
diagnosis. All data is fictional and local. Browser seams and missing provider,
physical-device, MFA and mail coverage remain explicit in the receipt.

[The recovery drill](recovery-drill.md) separately proves why code rollback does
not restore records or media, and why revocations and deletions must survive a
restore. Cloudflare D1/R2 restoration, production actions, configured email and
PagerDuty remain separate acceptance gates under #8/#9/#215/#367/#117.
