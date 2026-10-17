# Fictional creator-stack demonstration

Reviewed 18 October 2026. Two named demo stacks make the creator experience
demonstrable end to end inside an isolated, clearly fictional workspace. They are
not owner content, they are not customer data, and nothing in them was imported
from a real person.

## What the two stacks show

| Stack | Public address | Theme | Instances |
| --- | --- | --- | --- |
| Fictional Trail Notes | `/s/trail-notes` | daylight | Here / there (independently configured), Here / there (shared with the first), Linkarooie (independently configured) |
| Fictional Launch Board | `/s/launch-board` | midnight | Hello World, Link Check, Carry / forward |

Fictional Trail Notes exists to show the two ownership cases side by side. One
Here / there instance carries its own declared settings — title, introduction,
theme, layout and guest access — and a second instance reuses it. The reuse is
labelled on the published page, because the app keeps one set of records: an edit
or an approval reaches both entries. Two independently configured instances of
one app are refused by the validator rather than silently overwriting each other,
so the demonstration cannot present a state Composer cannot honour.

Fictional Launch Board exists to show configuration-free instances: Hello World,
Link Check and Carry / forward declare no configuration contract, so their
instances reuse what each app already holds and the editor says exactly that.

The two stacks differ in purpose, theme and content, so a theme or configuration
choice is visible rather than asserted.

## Configuration and data ownership

- The stack document holds presentation and instance configuration only. It
  names reviewed apps, stable instance identities, labels, captions, visibility,
  the reuse relationship and the declared setting values.
- No app record, media file, credential or private configuration is copied into
  a stack, an export or a share image.
- Applying instance configuration is a separate, explicit action
  (`src/lib/stack-activation.mjs`) that verifies each app's live source first,
  writes through that app's own `POST /api/config` boundary, verifies the
  response, and stops at the first failure. It never creates an instance and
  never rewrites a publication.

## Seeding it

The seed is generated from the real validator, so an unsupported instance or an
undeclared setting fails at generation time instead of appearing as demo data:

```sh
node scripts/seed-demo-stacks.mjs
npx wrangler d1 execute app-composer-emdash --local  --file output/demo-stacks.sql
```

Applying the same file with `--remote` publishes the demonstration on the live
instance. That is a deliberate operator action against a named environment; the
script itself never opens a database connection, and re-running it replaces only
the `workspace-demo-fictional-0001` stacks.

## Verified

Locally, against real SQLite and the running site (18 October 2026):

- `output/local-verification/trail-notes-390.png` — the published page at
  390 × 844 with readable text, the shared relationship explained and the
  declared settings listed.
- `output/local-verification/trail-notes-qr.png` and
  `output/local-verification/launch-board-qr.png` decode to
  `https://composer.loftwah.com/s/trail-notes` and
  `https://composer.loftwah.com/s/launch-board`.
- `output/local-verification/trail-notes-share-card.png` and
  `launch-board-share-card.png` are the 1200 × 630 share cards.
- `output/local-verification/trail-notes-after-rename.html` shows an unpublished
  draft rename leaving the public page on published revision 3.

Not yet verified: publishing either stack on the live instance, which needs the
invited administrator's Cloudflare Access session in the native editor. Uploading
this file to production is the next useful action once that session is available.
