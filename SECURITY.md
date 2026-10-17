# Security

Report vulnerabilities privately through this repository's GitHub **Security → Report a vulnerability** entry. If that entry is unavailable, ask the maintainer for a private reporting channel without publishing exploit details, credentials or personal data in an issue.

Include the affected commit/URL, a minimal reproduction using fictional data, expected and actual behavior, and potential impact. Do not test other users, damage deployed resources or publish keys. A report does not authorize access to production. No response deadline or bounty is promised.

The maintained version is current reviewed `main`. Fork operators own their keys, resources and updates. Public specs and imported inspection reports are untrusted data; they do not authorize builds or deployments. Administrative Access is exact-owner protected. Carry / forward remains fictional-only until its independent security acceptance is proven.

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

2. **High conditional build exposure — fixed in the follow-up.** The previous
   `scripts/promote.mjs` passed inherited process values to its compiler and used
   the working checkout. A synthetic canary reproduced that exposure. The new
   `scripts/promotion-boundary.mjs` admits only the reviewed authored pair, copies
   exact Git blobs into private temporary snapshots, rechecks all tracked bytes
   (including hidden edits), excludes ignored files and Git execution controls,
   and uses the pinned Composer Wrangler with a stripped environment and dotenv
   disabled. Both apps compile before any cloud mutation. Upload uses the checked
   compiled artifact with `--no-bundle`, selected Cloudflare credentials and each
   selected app token on stdin. Snapshot/artifact/target guards repeat around
   subprocess waits; private provider errors are not copied into output. The root
   target file must retain its original unshared inode. Existing data bindings and
   current pins remain unchanged. This is not a sandbox for arbitrary repositories.

3. **Medium CSP gap — fixed in the follow-up.** Astro's supported `security.csp`
   now emits main-page HTTP policies with generated script/style hashes, no
   `unsafe-inline` or `unsafe-eval`, no frames/objects/base overrides, same-origin
   connections/forms and Cloudflare’s beacon filename plus its versioned child path. The initial
   theme script is self-hosted; activity bars use numeric SVG attributes instead
   of inline styles. Independent mounted apps keep their own nonce policies;
   native EmDash authentication keeps its existing outer JWT gate. See the official
   [Astro CSP configuration](https://docs.astro.build/en/reference/configuration-reference/#securitycsp).

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

Follow-up validation, reviewed 14 October 2026: 149 tests and production build
passed, as did real credential-free compile and no-bundle artifact-validation
dry runs for both exact app pins. Synthetic tests cover selected credential
routing, ignored file exclusion, audit failure, hidden tracked edits, snapshot
mutation, artifact tampering, additional upload assets, custom build hooks and
linked root targets. Local built-page browser checks covered eight
main routes, theme and launcher/search/focus controls, phone/desktop composition,
and actual refusal of injected inline script, with no normal-flow CSP violations.
Use #11 for the exact merged-source release and production browser receipts;
local results do not establish deployment, and a dry run does not establish an
integrated service promotion.
