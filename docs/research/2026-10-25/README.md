# Research index — 25 October 2026

Seven independent investigations for the App Composer backlog. Each report was
produced from current primary sources and, where possible, live unauthenticated
API evidence. The owning GitHub issue remains the decision record; this
directory makes the full evidence durable and citable.

All sources were retrieved on **25 October 2026 (UTC)** unless the report says
otherwise. No paid account, tenant, provider write, plugin install or customer
interview was used.

| Issue | Report | Main finding | Decision left open |
| --- | --- | --- | --- |
| [#363](https://github.com/loftwah/app-composer/issues/363) | [WordPress plugin intelligence](363-wordpress-plugin-intel.md) | The ten-plugin baseline is reproducible, but Site Kit enters the strict top ten at the 5M-install band. Commerce, general forms and backup/recovery are the real gaps. | No new #366 plugin is justified before the registry gate. |
| [#357](https://github.com/loftwah/app-composer/issues/357) | [Shopify developer fit](357-shopify-fit.md) | Composer is a companion for owned operator/content apps, not a theme, checkout, admin-extension or storefront replacement. | Shopify adapter remains #293; do not build a headless storefront. |
| [#359](https://github.com/loftwah/app-composer/issues/359) | [Platform buyer research](359-platform-buyers.md) | Composer fits a small product team as a Cloudflare studio. It is not a replacement for an enterprise platform team. | Restore/recovery, identity lifecycle and AU data residency block larger claims. |
| [#349](https://github.com/loftwah/app-composer/issues/349) | [Cloudflare-first patterns](349-cloudflare-patterns.md) | Local-PaaS release discipline transfers; containers, arbitrary binaries and persistent volumes do not. | No structural platform build; four guidance edits under existing owners. |
| [#352](https://github.com/loftwah/app-composer/issues/352) | [Federated identity](352-federated-identity.md) | The load-bearing defect is identity binding by email rather than `(issuer, subject)`; conditional access and device trust stay upstream. | Origin-side OIDC/JWKS contract harness is the next safe slice. |
| [#365](https://github.com/loftwah/app-composer/issues/365) | [Plugin Trust Centre readiness](365-plugin-trust-readiness.md) | The registry discovery API works, but metadata alone cannot establish permissions, advisories or install safety. Freeform is RED, Stripe Checkout AMBER, no GREEN yet. | Small read-only evaluator over a dated snapshot; no installer. |
| [#369](https://github.com/loftwah/app-composer/issues/369) | [Registry lifecycle readiness](369-registry-lifecycle-readiness.md) | Browsing is verified; installation is not ready. No `sandboxRunner`/`LOADER`, no isolated target and no lifecycle receipt. | Needs an explicitly authorised isolated environment; no implicit paid resources. |

## Live evidence

`evidence/` contains the bounded, unauthenticated registry observations used by
#365/#369: search, resolve and release responses, two downloaded bundle
digests that match their release multihashes, and probe results. It contains no
credential, cookie, token or private package.

## What this research does not establish

- No customer or buyer interviews; willingness to pay and demand remain
  unknown.
- No Entra/AD tenant, conditional-access policy or SCIM provisioning test.
- No plugin install, update, disable or uninstall.
- No tenant-specific Cloudflare plan or paid entitlement receipt.
- No production, device, screen-reader or owner acceptance.

Those are separate gates. A report is evidence for a decision, not the decision
or an implementation claim.
