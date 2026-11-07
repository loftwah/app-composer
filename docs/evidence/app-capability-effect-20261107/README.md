# App capability effect — 7 November 2026

Scoped [#412](https://github.com/loftwah/app-composer/issues/412) proof. A real
external caller discovered a typed effect from Composer's live capability
catalogue, performed the existing app-owned read, was refused with the wrong
guest permit without changing state, then submitted one bounded fictional
postcard through the app's own public API. The new postcard stayed pending,
private and absent from both the public collection and its media path.

No owner credential, guest session, customer data or real visitor record was
used. The guest code is the app's intentionally public puzzle (`hunter2`), not an
owner credential.

## Released identities

| Surface          | Revision                                   | Worker / evidence                              |
| ---------------- | ------------------------------------------ | ---------------------------------------------- |
| App Composer     | `bbe9e2246a853b37904ae22a55350f3d2ad3cf43` | Worker `4c2683dd-9916-4864-aa2d-09e3c35cd164`  |
| Guestbook        | `e668c84cf45c8a16ba36015c7bce13c014cf3a38` | Worker `68cc5da7-83f8-4fc9-90e2-04c5c2d897be`  |
| Linkarooie       | `131fe0144e1690bd68e95be8330cdcd9059d3b3f` | Worker `583f07ac-3536-4c89-a40c-c882e9141262`  |

The effect first reached Composer production at `75f9772` / Worker `1c6fe80d`.
The final release `bbe9e22` / Worker `4c2683dd` contains the same catalogue plus
the reviewed ImgBot asset optimisation from merged PR #417 and the refreshed
resource package; the proof below was captured on `75f9772` and the effect code
is unchanged in the final release.

Composer's `/build.json`, Guestbook's `/build.json` and Linkarooie's
`/build.json` matched those revisions after release. The standalone manifest at
each app origin serves its optional `agentCapabilities` declaration; the copies
captured at proof time are in this directory.

Composer's composition pin remains `5075d7be…` / `f1dd2795…`. Promoting the new
standalone app revisions through the composed services requires the independent
app owner/member credentials and is a separate composition-release decision.
Nothing in this proof moves that pin or claims the composed copies changed.

## What the live proof did

1. Read `https://composer.loftwah.com/capabilities.json`. It advertised the
   Guestbook `submit-postcard` effect with `kind: effect`, `POST`, the real
   `/r/:resource/api/guest-postcard` path, `guest-invitation` availability,
   `guest-invitation-code` and `consent` permits, and `confirmation: true`.
2. Read the live invitation at
   `https://guestbook.loftwah.com/r/2056b6dd-bd53-4fe0-afeb-d2985cd417c4/api/invitation`.
   It reported `open` and `accepts: true` for revision 1.
3. Sent a postcard with a deliberately wrong code and `consent: true`. The app
   returned `403` and the pending count stayed at 1.
4. Sent a fictional postcard with the app's public guest code, explicit consent
   and a 1200 × 900 PNG. The app returned `201`, `status: pending`, and the
   pending count rose from 1 to 2. The item ID is recorded in `proof.json`.
5. Read the public collection and the pending item's media path. The item was
   not listed publicly and the media path returned `404`. Owner review,
   approval or publication was not performed.

The raw proof is `proof.json`; the submitted fictional image is `postcard.png`.
The proof script is kept outside the repository as a one-off, and the exact
request semantics are the app-owned contract in the Guestbook source.

## Focused checks

```text
node --test tests/app-capabilities.test.mjs tests/app-capability-declaration.test.mjs
# 13 tests, 13 pass, 0 fail

pnpm check
# release gate: 459 tests, 443 pass, 16 fail before Git signing disabled;
# with the sandbox identity workaround: 459 pass, 0 fail
```

The deploy itself ran `pnpm check`, the production build, remote D1 migrations
(no pending migrations), the Worker upload, live source/pinned-service checks,
sharing output, publication privacy and the anonymous administration boundary.
It ended with `Verified exact live Composer source
75f97727093750782264acd821539cb639d0bc32`.

Guestbook's own release ran its 123 tests, type/lint/format checks, build,
remote migration check and live sharing/source verification; Linkarooie's
release did the same for its own suite.

## What remains

- Owner moderation of the pending fictional postcard. It is private and can be
  hidden, rejected or deleted through the existing Guestbook review flow.
- Composer composition promotion of the new pins, with the independent app
  owner/member credentials. The current composed services and routes still work.
- Skills, workflow/trigger declarations and generated catalogue output remain
  broader #412 follow-ups; they are not claimed here.
