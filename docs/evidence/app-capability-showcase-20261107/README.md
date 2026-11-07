# Showcase app-owned capability declaration — 7 November 2026

Scoped #412 continuation. A second existing independently owned mini-app now
carries the optional `agentCapabilities` declaration in its own manifest, and
Composer validates the exact pushed source through the existing manifest
contract. No operation was executed, no profile was edited or published, no
credential was used and no mini-app was redeployed.

## Why Showcase

Link Check was the first candidate, but it has no `app.manifest.json` in its
own repository. Creating one would require choosing a Composer mount route and
contract that the app does not currently declare, which would be an invented
contract rather than an additive declaration.

Showcase (Linkarooie) already has the versioned `app.manifest.json`, a real
public read already present in Composer's verified catalogue, and a separate
independent release. It is therefore the smallest truthful next declaration.
The operation is a read: no owner mutation was invented.

## What changed

| Repository | Commit | Change |
| --- | --- | --- |
| Showcase | `131fe0144e1690bd68e95be8330cdcd9059d3b3f` | Adds `agentCapabilities` to `app.manifest.json` with the existing public profile read. |
| App Composer | this documentation/evidence change | Records and validates the exact pushed manifest. No runtime source change. |

The pushed file is preserved as [showcase.app.manifest.json](showcase.app.manifest.json)
with SHA-256 `3b18590f3273c02884488acac07e568c37b32ce53ae8283598ce313d0f0fde93`
and GitHub blob SHA `f50166d2da9731812009c89d81ac8f9a0bd65995`.

```json
{
  "version": 1,
  "ui": "https://showcase.loftwah.com",
  "storage": "app-owned",
  "operations": [
    {
      "name": "read-public-profile",
      "description": "Read one explicitly published profile snapshot. Draft profile edits and owner configuration stay private.",
      "kind": "read",
      "method": "GET",
      "path": "/p/:handle/",
      "availability": "public",
      "requires": ["none"],
      "confirmation": false,
      "verified": "2026-11-07"
    }
  ]
}
```

The declaration carries no token, credential, draft profile, owner setting or
private record. It grants nothing and describes no effect.

## Validation and live read

```text
node scripts/validate-app-manifest.mjs docs/evidence/app-capability-showcase-20261107/showcase.app.manifest.json
# ok: true, app: showcase, contract: 1, declarationVersion: 1
# read-public-profile GET /p/:handle/ public, no confirmation, verified 2026-11-07
```

The raw validator output is [validation.json](validation.json). The operation
was read live without a session:

```text
GET https://showcase.loftwah.com/p/fictional-river/
200 text/html; charset=utf-8
<title>River Morgan</title>
```

## Exact remaining gate

The declaration is in Showcase's pushed source, not in its deployed manifest.
The live `https://showcase.loftwah.com/app.manifest.json` returned `200` with
2,387 bytes and no `agentCapabilities` field. The current Composer composition
pin remains Showcase `f1dd27952ca8548f81fde5c5905346dae4a2b61b`.

Two separate owner-authorised actions remain:

1. Release Showcase from the declaration commit and verify its served
   `app.manifest.json` carries the declaration.
2. Update the Composer composition pin and promote it through the existing
   clean pushed-main release path.

No mutation, postcard, profile publication, customer data, credential or
permission was created. #412 remains open because an authorised mutation, the
broader capability pattern and the release/promotion path are still separate
gates.
