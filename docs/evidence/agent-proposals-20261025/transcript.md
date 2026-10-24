# Agent proposal local journey — fictional Trail Notes

Captured 2026/10/25 11:30–13:00 Australia/Melbourne (2026-10-25T00:30–02:00Z).
The local lab used a fixed clock so the transcript stays reproducible.

- Scope: fictional workspace `ws-fiction-trail`, app `trail-notes`, isolated Preview `env-preview-qa`, account `fiction-composer-preview`.
- Role pack: `programmer` 1.0.0.
- Agent: `agent:opencode/lane-b` (OpenCode Lane B).
- Accountable owner: Ada Nguyen. Fallback: Sam Okafor.
- Storage: one local SQLite file selected with `--db`. No network, provider, production D1, Access policy, deployment or paid service was used.
- Identities are asserted by this local CLI. This is not connected authentication and does not establish production authority.

## Result

| Step | Command                             | State / result                                                                                |
| ---- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| 1    | `grant`                             | `grant-f63dc364-50ce-46f4-ae19-d67816027ded` · proposal-only · expires 2026-10-27             |
| 2    | `brief`                             | `brf-7e47cc831e7c19011328e1a728ce261d` · digest `7e47cc831e7c…0c7276` · created               |
| 3    | `submit` v1                         | `prop-5782ae91-ff48-4e1a-8bc2-4572f052bc89` · v1 · `submitted` · digest `1821dd75a6b0…5561e7` |
| 4    | self-approval attempt               | refused `SELF_APPROVAL`; no review row                                                        |
| 5    | `review --decision request-changes` | `changes-requested`; reason recorded                                                          |
| 6    | `submit` v2                         | same proposal · v2 · `submitted` · digest `533277ad79fa…ee88b3`; v1 digest no longer current  |
| 7    | `review --decision accept`          | `accepted` · accepted digest `533277ad79fa…ee88b3` · handoff `none`                           |
| 8    | `verify`                            | `ok: true`; accepted digest matches current content and source                                |
| 9    | `execute` attempt                   | refused `NOT_SUPPORTED`; nothing executed                                                     |
| 10   | `handoff`                           | `7c51c14d-bf8c-41de-bc3b-2049677dcac4` · `prepared` · `execution: not-performed`              |
| 11   | `verify`                            | `ok: true`; handoff pins the accepted digest                                                  |
| 12   | `list`                              | one proposal, v2, `accepted`                                                                  |

## Accepted content

- Proposal: `prop-5782ae91-ff48-4e1a-8bc2-4572f052bc89`, version 2.
- Accepted digest: `533277ad79fa70e8fc08a5e3b9887c61aec0c597a35e4f16bd139552efee88b3`.
- Accepted by Ada Nguyen at `2026-10-25T01:40:00.000Z`.
- Source: local path `output/agent-proposals-20261025/source-v2.md`, content hash `99ffaf4555ae713bbeddf711ab217e69330052e8397fa1ba3d3bf86e379c5460`.
- Evidence: `ev-01`, `ev-02`.
- Change: Return 422 for empty-after-trim postcard text and add the regression test the reviewer asked for.
- Handoff destination: `existing-release-flow`. Execution: `not-performed`.
- The handoff carries no deploy, merge, spend, credential or access authority.

## Refusals captured live

```text
Refused (SELF_APPROVAL): An agent identity cannot review or approve a proposal.
Human action: Route the decision to a separate accountable human.
```

```text
Refused (NOT_SUPPORTED): This CLI has no execute, deploy, approve or merge command. Acceptance is a decision; execution belongs to the existing authorised release flow.
Human action: Correct the input; no record was changed.
```

## Verify output

```text
Verify prop-5782ae91-ff48-4e1a-8bc2-4572f052bc89 · accepted · version 2
Stored digest: 533277ad79fa70e8fc08a5e3b9887c61aec0c597a35e4f16bd139552efee88b3
Current digest: 533277ad79fa70e8fc08a5e3b9887c61aec0c597a35e4f16bd139552efee88b3
Accepted digest: 533277ad79fa70e8fc08a5e3b9887c61aec0c597a35e4f16bd139552efee88b3
Source: current — 1 file(s) and 285 byte(s) match the submitted content hash.
Grant: active — Grant grant-f63dc364-50ce-46f4-ae19-d67816027ded is active; expires 2026-10-27T00:00:00Z.
Handoff: prepared (digest matches: yes)
Execution: not-performed

PASS version-exists — Version 2 is present.
PASS digest-current — The recomputed digest matches the stored proposal digest.
PASS digest-matches-version — The current version digest matches the proposal.
PASS accepted-digest — The accepted digest matches the current content.
PASS grant-active — Grant is active.
PASS source-current — current: 1 file(s) and 285 byte(s) match the submitted content hash.
PASS handoff-digest — The prepared handoff pins the accepted digest.
```

## Final list

```text
prop-5782ae91-ff48-4e1a-8bc2-4572f052bc89 · v2 · accepted · medium · programmer · trail-notes/env-preview-qa · 533277ad79fa70e8…efee88b3
```

## What this transcript proves

- One versioned proposal moved through request-changes to a second version; the previous digest stopped being current.
- Acceptance stored the exact reviewed digest and source identity, and did not create a handoff.
- The separate handoff pins the accepted digest and explicitly records `execution: not-performed`.
- Self-approval and execute attempts were refused with no state change.
- The owner can reopen `show` and read scope, digest, source, evidence, review history, accepted digest and next action without reconstructing a conversation.

## What it does not prove

- Connected agent authentication, hosted agent execution, production D1 persistence, EmDash Access admission or a deployment.
- A production proposal: the contract refuses production scope.
- A real Trail Notes app or real user data. The app, owner names, evidence and source are fictional.
- The authenticated native admin page. The separate 390px CSS/markup harness is recorded in the evidence README.

## Files in this transcript directory

- `brief.md` — deterministic briefing for the programmer pack.
- `03-submit-v1.json`, `07-submit-v2.json`, `09-accept.json`, `13-handoff.json` — exact persisted responses.
- `10-verify.json`, `14-verify-handoff.json` — verification checks.
- `05-self-review.txt`, `12-execute.txt` — refusals.
- `source-v1.md`, `source-v2.md`, `change-v1.json`, `change-v2.json`, `evidence.json` — fictional inputs.
- `proposals.sqlite` — the local database. It is ignored by git and was deleted after the bounded receipt was saved.

Redaction: no credential, token, private key or environment value appears in any artefact. The transcript contains fictional owner names and fictional evidence only.
