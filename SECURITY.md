# Security

Report vulnerabilities privately through this repository's GitHub **Security → Report a vulnerability** entry. If that entry is unavailable, ask the maintainer for a private reporting channel without publishing exploit details, credentials or personal data in an issue.

Include the affected commit/URL, a minimal reproduction using fictional data, expected and actual behavior, and potential impact. Do not test other users, damage deployed resources or publish keys. A report does not authorize access to production. No response deadline or bounty is promised.

The maintained version is current reviewed `main`. Fork operators own their keys, resources and updates. Public specs and imported inspection reports are untrusted data; they do not authorize builds or deployments. Administrative Access is exact-owner protected. Portable AI State remains fictional-only until its independent security acceptance is proven.

Read the repository guidance and owning GitHub issues for current boundaries. Reviewed 13 October 2026.

## Focused review — 14 October 2026

Safe to continue the supported, owner-operated development path with the limits
below. This review does not approve arbitrary customer builds or real sensitive
vault data. Woodhouse coordinates; each app retains its own source and release
authority. Existing [#10](https://github.com/loftwah/app-composer/issues/10) owns
the remaining security work and [#11](https://github.com/loftwah/app-composer/issues/11)
owns release evidence.

1. **High dependency advisories — fixed.** The previous lock included `undici`
   7.29.0 and `sharp` 0.35.4 through Cloudflare's local tooling. The registry audit
   reported 11 advisories (three high, five moderate, three low). Exact overrides
   in `pnpm-workspace.yaml` now select 7.29.1 for affected 7.x consumers and
   sharp 0.35.5, preserving the separate supported undici 8.x dependency; the fresh full audit
   reports zero known vulnerabilities. This is a local dependency exposure, not
   evidence of a deployed Worker exploit. The root `pnpm deploy` path now runs the
   audit before checks/build/upload and fails if the audit fails.
   Sources: [undici TLS advisory](https://github.com/advisories/GHSA-w293-vg96-wgc3)
   and [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).

2. **High conditional build exposure — open in #10.** `scripts/promote.mjs:3`
   passes inherited process credentials and controls to its local compile path
   and compiles from the working checkout. A synthetic dry-run fixture confirmed
   that an unrelated environment canary reaches that subprocess. Clean Git status
   and an exact commit pin do not isolate ignored files, hooks or build inputs.
   Only the two reviewed authored apps are supported; there is no public build
   endpoint. Before broadening that path, reuse Get Ready's verified temporary
   snapshot, credential-free build and selected upload environment, with negative
   tests for hidden edits and inherited controls. This review did not promote any
   integrated service. Impact requires compromised local build inputs or tooling.

3. **Medium hardening gap — open in #10.** `src/middleware.ts:8` supplies headers
   but no main-site CSP; the live Composer homepage also returned none. No
   attacker-controlled script sink was established in this pass. Add an Astro-
   compatible policy without weakening it to allow arbitrary inline execution;
   verify the main pages and native CMS separately. Guestbook/Showcase already
   supply nonce policies; the fictional state demo retains `connect-src 'none'`.

Live anonymous probes confirmed the owner Access redirect on the custom domain,
403 on alternate Worker and preview CMS routes, 400 for ambiguous encoded paths,
401 for both composed exports and unauthenticated usage ingestion, and no-store
for those private responses. Existing signature/audience/issuer/expiry negatives
and four independent vault cryptographic tests passed. Source inspection covered
bounded uploads, current media eligibility, fixed-host Link Check fetching,
spec/report validation, secret redaction and Get Ready's isolated release path.

The vault remains fictional-only under #31–34. This pass does not prove private
authenticated storage, cross-profile authorisation, second-device recovery,
provider interoperability, a restore drill or security certification. No secrets,
personal uploads, new cloud resources or permissions were changed for this review.
