# App capabilities as code

Published 6 November 2026 at `/capabilities` (human) and `/capabilities.json`
(machine). First slice of [#412](https://github.com/loftwah/app-composer/issues/412).

## What it is

A small, strict catalogue of **verified operations the shipped mini-apps already
support**. It exists so a user-selected agent can discover the real transport,
availability and permit for an operation without scraping prose or guessing an
API.

It is not a second app registry, an executor, a marketplace or a permission
grant. The mini-app manifest, composition lock and release controls remain
authoritative. An entry never contains a token, guest code or owner credential.

## Shape

`src/lib/app-capabilities.ts` exports one validated `appCapabilities` array. Each
app names its independent repository, public origin, storage owner and bounded
guides. Each operation names:

- a stable `name` and human `description`;
- `kind`: `read` or `effect`;
- the real `method` and relative `path` (templates may use `:resource`);
- `availability`: `public`, `guest-invitation`, `owner-scope` or `local`;
- the exact `requires` permits;
- `confirmation` (must be true for every effect);
- the date it was last verified.

Validation fails closed on unknown apps, duplicate operations, unsafe paths,
public effects, unconfirmed effects, invented fields and credential-like fields.
`tests/app-capabilities.test.mjs` exercises the positive and negative cases.

## What it deliberately does not do

- It does not call the operation. A caller still uses the app's own HTTPS
  surface, rate limit and identity.
- It does not turn a guest invitation into authority. The guest code and owner
  approval remain app-issued.
- It does not install, deploy or publish anything.
- It does not yet read declarations from each app's own `app.manifest.json`.
  That app-owned contract and the authorised mutation proof remain open in
  #412; this catalogue is Composer's verified description in the meantime.

## Adding or changing an operation

1. Verify the real endpoint against the app's own source and a live bounded
   request. Record the date.
2. Add or edit the entry; keep the operation name stable.
3. Run `node --test tests/app-capabilities.test.mjs` and `pnpm check:types`.
4. Publish through the normal release. The JSON is served with a short public
   cache and no credentials.
