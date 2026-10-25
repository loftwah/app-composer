# LDraw catalogue publication

Reviewed 2026/10/25 (Australia/Melbourne). This note records the source-level
route resolution for `/catalogue/ldraw`, the exact LDraw identity Composer
publishes, and the publication result the coordinator performed under the
existing authenticated owner session.

## What the route actually resolves

`src/pages/catalogue/[slug].astro` asks EmDash for a published entry:

```
const { entry, error } = await getEmDashEntry("catalogue", Astro.params.slug);
```

- `error` renders a 503 "temporarily unavailable" page and leaves the shipped
  app library usable.
- No entry renders a 404 "No mini-app exists at this address" page. It does not
  fall back to the shipped library record, so a shipped app with no published
  contract cannot appear as a published catalogue entry by accident.
- An entry is only returned for a **published** record in the `catalogue`
  collection. The collection is declared in `seed/seed.json` with
  `supports: ["drafts", "revisions", "search", "seo"]` and the required fields
  `title`, `description`, `href`, `source` and `reviewed`. A draft therefore has
  no public route; it is visible only in EmDash administration.

The committed seed contains exactly two catalogue records (`guestbook` and
`showcase`). There is no LDraw row in the seed, so publishing it in the owner's
EmDash database cannot create a duplicate from repository data.

## The exact LDraw identity that is published

| Field | Value | Source of truth |
| --- | --- | --- |
| Title | LDraw | `lib/ldraw/app.manifest.json`, `src/lib/apps.ts` |
| Live route (`href`) | `https://ldraw.loftwah.com/` | `lib/ldraw/source.json` → `origin`; `/ldraw` returns 302 to the same origin |
| Independent source | `https://github.com/loftwah/app-composer-ldraw/tree/c9c2339a1296ee7c06a7d94f274c69143478acba` | `lib/ldraw/source.json` → `repository` + `commit` |
| Reviewed | 2026/10/24 | release evidence in issue #11 |
| Description | Local editable drawings, powered by Excalidraw. | manifest `description`, unchanged |

`tests/ldraw.test.mjs` pins the source commit, the repository, the origin, the
manifest file hash and the manifest digest, and asserts that Composer registers
no LDraw service binding. `src/lib/ldraw-entry.mjs` forwards only `analytics=off`
and a bounded `qa` label to the fixed origin; project, drawing and arbitrary
destination parameters are dropped.

The catalogue page reuses the shipped library record for artwork, so the entry
must keep using the committed captures rather than a new upload:

- preview `public/brand/apps/ldraw-workspace-c9c2339a1296-d2e0dc4b-r2-960.webp`
  with the 1440 variant;
- share card `public/brand/apps/ldraw-share-c9c2339a1296-d2e0dc4b-r2.png`
  (1200×630);
- provenance `public/brand/apps/ldraw-provenance-c9c2339a1296-d2e0dc4b-r2.json`;
- the 96px catalogue/launcher tile, which is Composer's typographic discovery
  tile rather than an invented LDraw logo.

Because `/catalogue/[slug]` chooses the image from the shipped record by slug,
publishing the entry does not change or duplicate the artwork mapping.

## Publication result — performed by the coordinator

The coordinator held an already-authenticated owner session in the run harness
and published the native entry there. Recorded result, as reported by that
session:

- status `published`;
- live revision id `01M5R1P8DJ3C4FM61Y7E5NB48T`;
- `https://composer.loftwah.com/catalogue/ldraw` returns 200;
- no duplicate entry was created.

This lane did **not** publish, edit or verify the live entry. It has no
authenticated production session, so the revision id and the live 200 are the
coordinator's observation, not an independent proof here. A sitemap omission
found in the same session is owned by PR #337 and is not duplicated here.

## Remaining owner-only steps

None for first publication. For any later change to the LDraw text, route,
source pin or review date:

1. Sign in to `https://composer.loftwah.com/_emdash/admin` with the existing
   owner identity; do not create or copy an Access session.
2. Open **Mini-app catalogue → LDraw** and edit the record. Keep `href` exactly
   `https://ldraw.loftwah.com/` and `source` on the current reviewed commit.
3. Publish the revision. A draft has no public route.
4. Capture evidence afterwards: the EmDash revision/status, an anonymous
   request to `/catalogue/ldraw` (expect 200 with the LDraw title), and the
   rendered 390px and 1440px pages in both themes. Do not claim a new social
   preview until the actual platform render is checked.

## What this note does not claim

- No production deployment, D1 write or catalogue publication happened in this
  lane.
- The route, schema, source pin, manifest hashes and artwork mapping above are
  verified from committed source and read-only HTTP responses (`/catalogue`
  200, `/catalogue/ldraw` 404 before publication, `/ldraw` 302).
- Physical-device, stylus and screen-reader acceptance remain unverified.
