# Reconcile a native publisher import

`node scripts/wordpress-reconcile.mjs --input /path/to/private-observations.json`
produces a read-only plan. It performs no request, database write, publication or
installation. Keep observations and the output private when they contain real
content; the maintained lab uses fictional data under ignored `output/`.

Supply current source inventory and destination observations in this shape:

| Field | Observation |
| --- | --- |
| `source.media` | Source ID, exact URL, independently computed SHA-256, alt and caption |
| `source.articles` / `source.pages` | Source ID, slug, exact URL and featured-image ID |
| `sourceOrigins` | Explicitly reviewed source origins, including a retired origin only when its identity is established |
| `media` | Native ID, local media-file URL, independently fetched SHA-256, current alt/caption |
| `entries` | Native ID, collection, slug, current top-level `_rev` token and entry `data` |

Read native content at `/_emdash/api/content/{collection}/{id}` and media at
`/_emdash/api/media/{id}` through the selected site's normal authenticated
EmDash API. Never copy a token into this file. The tool matches unique attachment
bytes, not a filename guess. Missing/ambiguous media are unresolved. Duplicate
source/destination slugs and foreign media URLs are refused. Exact known source
`href`/`src` references can become app-owned URLs; unrelated links and every
paragraph remain unchanged. An owner-selected different featured image stays
selected. Existing destination alt/caption text is preserved; filling a blank
still requires review.

Review each proposed field patch against the current native editor. Saving a
content patch uses the observed `_rev` with native `PUT`; a stale token must stop.
Verify the saved draft, then deliberately publish only work that was public and
is intended to remain public. A private, pending or scheduled source item must
never become public just because it needs a reference repair. Native media
metadata has no equivalent revision token: compare the planned expected values
again, use a single writer and stop if they differ. This tool does not pretend
that check is an atomic media update.

After reconciliation, stop the source. In a fresh unauthenticated browser check
old routes and legacy-ID redirects, nonpublic direct URLs, media bytes and MIME,
image descriptions/captions, guide/internal links, native owner edits and
publication. Record any source requests. A copied file or successful command is
not cutover or recovery proof.

The 25 October continuation uses the real native 1.3.1 importer and normal
revision/publication endpoints on the independent fictional Weekender app. It
also restores the existing native category parent through the normal term API.
[The lab observations](../labs/wordpress/weekender/OBSERVATIONS.md) distinguish
this bounded manual reconciliation from automatic importer parity, the older
1.2→1.3.1 upgrade and hosted/physical-device/provider gates.

Official contracts checked against installed EmDash 1.3.1:
[WordPress import](https://docs.emdashcms.com/migration/from-wordpress/) and
[native REST](https://docs.emdashcms.com/reference/rest-api/).
