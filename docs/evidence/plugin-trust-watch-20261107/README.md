# Plugin Trust watch depth and a fresh registry observation

Date: 7 November 2026. Issue:
[#365](https://github.com/loftwah/app-composer/issues/365). This is a slice; the
issue stays open.

## Production identity

- Composer source `67749e2ccec9158364c25597495c9603f0bdb963` (`67749e2`).
- Worker version `14f25e06-383a-47c0-b932-ebdfbe26d0b9`.
- Released through `pnpm deploy` from clean pushed `main`; the guard ran the
  audit, full check, production build, migrations, upload and every live gate.
- `/build.json` returned the same commit.

The prior production identity was `d041f69` / Worker `245bba21`.

## Fresh observation

`pnpm plugin-trust:observe` is a bounded, read-only observation command:

- resolves the curated package and latest release through the public
  `com.emdashcms.experimental.aggregator.*` XRPC methods;
- downloads each release artifact from the record-scoped blob cache, capped at
  5 MB and verified byte-for-byte against the release SHA-256 multihash;
- gunzips and reads `manifest.json` from the archive without executing anything,
  extracting only supported capability and allowed-host declarations;
- refuses the whole write if any package, digest, size, identity or manifest
  check fails, so a partial snapshot never looks healthy.

Observed on 7 November 2026 at `10:52:48Z`, host EmDash 1.4.0 / adapter 1.4.0 /
Astro 7.4.7:

| Package | Version | SHA-256 | Capabilities | Hosts |
| --- | --- | --- | --- | --- |
| `freeform` | 1.3.0 | `ce1e83f2…c54c2` | `network:request:unrestricted`, `network:request`, `email:send` | none |
| `emdash-stripe-checkout` | 0.10.6 | `6501b85f…fc3d9` | `content:read`, `content:write`, `schema:read`, `media:read`, `network:request` | `api.stripe.com` |

The Stripe digest was independently decoded from the release multihash
`bciqgkanyl5…` and matched the downloaded bytes.

Freeform's **profile** carries an active `listing-overridden` label while its
release carries `listing-passed`. The schema now accepts optional
`profileLabels`; an active override is AMBER `PROFILE_OVERRIDDEN`, and an active
withdrawal/suspension is RED `PROFILE_WITHDRAWN`. Profile labels stay separate
from release labels so a profile override cannot be mistaken for a release
identity mismatch.

## What changed since 25 October

The evaluator compares the two committed observations and raises deduplicated
review items keyed by publisher DID, slug, code and version:

1. `freeform` `RELEASE_CHANGED` — 0.1.4 → 1.3.0.
2. `freeform` `ARTIFACT_CHANGED` — new checksum.
3. `freeform` `PROFILE_REVIEW` — active `listing-overridden`.
4. `emdash-stripe-checkout` `RELEASE_CHANGED` — 0.10.3 → 0.10.6.
5. `emdash-stripe-checkout` `ARTIFACT_CHANGED` — new checksum.
6. `emdash-stripe-checkout` `SOURCE_CHANGED` — the observed source repository
   became unavailable.

A repeated observation of the same release produces zero items. Retention is
newest-first, capped at six observations by default and de-duplicated by
observation time. Automatic refresh is **off**; the page states the daily
cadence, owner, network cost (two registry reads, up to two artifact downloads,
no credentials, no model spend) and the change-only escalation rule.

## Checks that ran

| Check | Result |
| --- | --- |
| `node --test tests/plugin-trust-watch.test.mjs` | 7 passed |
| `pnpm check:types` | 0 errors |
| `pnpm deploy` | all release gates passed |
| `pnpm plugin-trust:observe` (live registry) | 2 packages verified |

Tests cover unchanged observations, release/permission/host/compatibility drift,
deduplicated keys, withdrawal and removal, profile override and withdrawal
evaluation, negated labels, retention bounds, and a synthetic tar.gz bundle with
digest, duplicate-member and identity-mismatch refusals.

## Live owner verification

The real Cloudflare Access owner session opened
`/_emdash/admin/plugins/composer-stacks/plugin-trust` on production.

- The **What changed since the last observation** section rendered both
  observation times, `2 retained observations`, automatic refresh off, the daily
  cadence and the owner.
- It listed exactly the six review items above with their codes and reasons.
- 1440 × 1000 and 390 × 844: document width equals viewport and the section is
  not clipped horizontally.
- The only console errors were the known CSP block of Cloudflare's Insights
  beacon.
- Screenshots: [desktop](watch-desktop.png) and [phone](watch-phone.png).

## Remaining #365 gates

- Automatic watch execution with explicit enable/pause controls, a scheduled
  refresh, and a deduplicated Inbox/review item written through the existing
  inbox rather than only displayed.
- A licensed advisory feed, SBOM or source-health check; today the evaluation
  still records `ADVISORY_SOURCE_NONE`.
- A completed native install/update/disable/uninstall receipt joined by
  publisher DID and slug for the exact release.
- Per-site installed inventory join against registry evidence beyond the
  existing read-only comparison, with secret and private-storage isolation.
- Financial fields (price, Pro tier, external API cost) from an authoritative
  source; the registry exposes no price.
- Fork/rescue playbook and attributable, expiring exceptions.
- Public curated directory with sanitised evidence only.
- Physical mobile/desktop usability beyond the browser checks above.
