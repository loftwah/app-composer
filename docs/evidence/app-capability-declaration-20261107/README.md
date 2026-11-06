# App-owned capability declaration — 7 November 2026

Scoped #412 slice. An existing independently owned mini-app now carries an
optional agent capability declaration inside its own manifest, and Composer has a
strict validator for it. No capability was executed, no postcard was created, no
customer data was published and no mini-app was redeployed.

## What changed

| Repository   | Commit                                     | Change                                                                                                                       |
| ------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Guestbook    | `2a9e12e70813d3f2c1c21a49bc330267bbc0a61f` | Adds `agentCapabilities` to `app.manifest.json` with the two existing public read operations.                                |
| App Composer | this delivery                              | Adds the optional declaration validator, wires it into `validateManifest`, adds a read-only check command and focused tests. |

Guestbook was chosen because it already has an app-owned manifest, real public
read operations and a reviewed Composer catalogue entry. The declaration
describes, not grants, those operations:

```json
{
  "version": 1,
  "ui": "https://guestbook.loftwah.com",
  "storage": "app-owned",
  "operations": [
    {
      "name": "read-invitation",
      "kind": "read",
      "method": "GET",
      "path": "/r/:resource/api/invitation",
      "availability": "public",
      "requires": ["none"],
      "confirmation": false,
      "verified": "2026-11-06"
    },
    {
      "name": "list-public-items",
      "kind": "read",
      "method": "GET",
      "path": "/api/items",
      "availability": "public",
      "requires": ["none"],
      "confirmation": false,
      "verified": "2026-11-06"
    }
  ]
}
```

The declaration carries no guest code, token, credential, private media or
owner record. It does not make a public operation effectful and does not widen a
permission.

## Composer validation

Composer now validates the optional field in the existing manifest contract:

- `scripts/lib/app-capability-declaration.mjs` enforces exact keys, version 1,
  bounded operations, safe relative paths, GET/POST, the existing availability
  values, permissions/confirmation rules, duplicate rejection and the
  credential-field guard.
- `scripts/contracts.mjs` calls it from `validateManifest` whenever
  `agentCapabilities` is present. Manifests without the field are unchanged.
- `scripts/validate-app-manifest.mjs` is a read-only check for an independent
  checkout. It prints the declared operations and exits non-zero on failure.
- `tests/app-capability-declaration.test.mjs` covers the Guestbook catalogue as
  a declaration, an old manifest without the field, the manifest-level call and
  negative cases (unknown fields, unconfirmed effect, public effect, unsafe path,
  duplicate name, credential-like field).

Focused checks:

```text
node --test tests/app-capability-declaration.test.mjs
# tests 8, pass 8, fail 0

node scripts/validate-app-manifest.mjs <pushed Guestbook manifest>
# ok: true, app: guestbook, declarationVersion: 1
# read-invitation  GET /r/:resource/api/invitation  public
# list-public-items GET /api/items                   public
```

The validator was run against the exact pushed manifest fetched from
`raw.githubusercontent.com/loftwah/app-composer-guestbook/2a9e12e...`.
Manifest SHA-256:
`c8e0801be741ef699cf1febef71f05f5a2086995ef62d4cf21502fdcb837fbe4`.

Guestbook's own focused manifest test also passed:

```text
node --test tests/member-service.test.mjs
# tests 14, pass 14, fail 0
```

## Remaining gates

- Guestbook has not deployed this manifest change. Its independent release
  guard and production deployment remain with that repository.
- Composer's composition pin remains `5075d7be53b43aca288d3707fd06851aca91e8c2`;
  promoting the new Guestbook manifest is a separate composition/release
  decision. The validation above used an independent checkout, not a changed
  production pin.
- No authorised mutation was executed, no fictional guest postcard was created
  and no customer data was published.
- Skills, workflows/triggers, generated catalogue output and the full #412
  acceptance remain open.
