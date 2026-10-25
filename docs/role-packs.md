# Agent role packs

Version `composer.role-packs/1`, reviewed 24 October 2026. Six job contracts for an owner’s local agent, driven by one fictional evidence bundle. A pack is expertise and a job template, not an IAM grant.

## What ships

| Pack | Job | Returns |
| --- | --- | --- |
| Service Owner | Health, impact, release risk and one owner decision | Service review with hold/proceed/escalate |
| Programmer | One defect in an isolated environment | Reproduction, minimal patch, regression test, draft PR |
| Architect | One real dependency decision | ADR, options, Mermaid diagram, unknowns, reversal |
| DevOps / SRE | Desired versus actual provider state | Drift, isolation result, rollout/rollback proposal |
| Security | Access, secrets, exposure and preview isolation | Scoped findings, severity, remediation, owner decisions |
| QA | Journeys, gates, negatives and accessibility | Verdict, blockers, coverage gaps |

The public index is `/roles`; each detail page is `/roles/<id>`. Downloadable Markdown, prompt text, the shared bundle and all six packs as a ZIP are under `/roles/v1/`.

## Run it

Node 22, from the repository root:

```sh
node scripts/roles.mjs check
node scripts/roles.mjs list
node scripts/roles.mjs brief --role qa --input examples/role-packs/fictional-trail-notes.json
node scripts/roles.mjs brief --role security --input examples/role-packs/fictional-trail-notes.json --out output/security-brief.md
```

Exit codes: `0` brief emitted and unblocked, `2` input refused with a human action, `3` brief emitted with a blocking stop. The runner writes nothing unless `--out` is passed. It uses no network, model or provider credential.

## Evidence bundle

`examples/role-packs/fictional-trail-notes.json` is the shared bundle:

- workspace `ws-fiction-trail`, accountable owner Ada Nguyen, fallback Sam Okafor;
- application `app-trail-notes` at fictional source `fiction/trail-notes@7f3a9c2`, release `rel-20261023-3`;
- service `svc-trail-notes-web` on account `fiction-composer-preview`, owner Sam Okafor;
- isolated Preview `env-preview-qa-postcards`;
- seven evidence items, five gates, four dependency edges, drift and security paths.

The records are fictional. Do not replace them with real private records; adapt the schema to the selected workspace and redact before use.

## Refusal rules

Before a brief is rendered, the runner checks:

1. Bundle version, required ownership, application, service, environment and evidence shape.
2. Secret-like values (`Bearer`, API keys, private keys, labelled secrets) — refused, with a rotation and redaction action.
3. Self-approval — an agent requester with any approver, or the same actor on both sides, is refused. Approval must be a separate human.
4. Stale evidence against a per-pack limit (24–168 hours).
5. Production targets for Programmer and QA work; cross-environment evidence for Programmer.
6. Pack-specific input: defect and reproduction, gates, dependency edges and options, drift list, access paths and findings, impact/SLO/gates.

Blocking findings (failed gate, high security finding, preview production binding) still produce a brief, marked blocked, and exit `3`. The brief never becomes an approval.

## Measured outcome

The shipped checks exercise all six packs against the same bundle and four unsafe variants:

- 6 of 6 role briefs emitted; 7 shared evidence items cited in each.
- 4 of 6 briefs blocked by an isolation, security, SLO or gate fault; 2 are proposals (Programmer, Architect).
- 4 of 4 unsafe variants refused: self-approval, secret-like value, production Programmer target, missing ownership. 0 unsafe briefs, 0 secret values echoed.
- 24 pack negative tests, plus repository tests for manifest validity, generated downloads, refusal paths and brief content.

The QA brief is the concrete release example: three of three public-visibility runs failed, so the verdict is blocked even though 12 of 14 journeys passed.

Two packs have also been exercised by fresh local agents with no memory of this repository. The Programmer pack returned all eight output fields for a real small change, including “Not a named defect” for a feature request, no PR because no remote existed, and an unassigned human reviewer. The QA pack refused the committed production-target bundle in 32 seconds, naming the production mutation and the contradictory drift evidence, and asked for an isolated target instead of producing a verdict. Counts, hashes and the remaining gaps are in [the fresh-agent evaluation](../evaluations/fresh-agent-20261025.md); the `/roles` hub derives its proof strip from the same committed results file.

## Actual captures

Full-page Chromium captures from the local `pnpm dev` render, 1440px and 390px, both themes where it matters. [Capture provenance](images/role-packs-20261024.json) records URLs, viewports, bytes and hashes.

The 25 October role-journey pass re-captured the hub, the QA pack and `/setup` after the proof strip and in-page index landed: [24 captures and 18 checks](evidence/role-journey-20261025/README.md), 1440×1000 and 390×844, both themes, zero overflow and zero console errors beyond favicon requests.

- [Role-pack index, desktop](images/role-packs-20261024-index-desktop.png) · [light](images/role-packs-20261024-index-desktop-light.png)
- [Role-pack index, phone](images/role-packs-20261024-index-phone.png)
- [QA pack, desktop](images/role-packs-20261024-qa-desktop.png) · [phone](images/role-packs-20261024-qa-phone.png)
- [Service Owner pack with the generated brief open](images/role-packs-20261024-service-owner-brief.png)

## Boundaries and remaining gates

Proposal only. Nothing here deploys, merges, spends, sends, invites, deletes, rotates a credential or changes access. The accountable human accepts; native EmDash accept/request-changes/reject records and connected-agent authentication remain #311/#315 work. Provider read-only credentials, live Sentry/Wiz/Snyk data and physical-device QA are not claimed.

The runner is repository-local. Downloaded packs are portable instructions; the refusal checks require the checkout. A future EmDash service page should load the relevant pack, call the same validation, and persist a proposal with actor, target IDs, evidence and expiry.
