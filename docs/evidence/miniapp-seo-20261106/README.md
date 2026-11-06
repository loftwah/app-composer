# Independent mini-app SEO inventory — 6 November 2026

Issue: [#399](https://github.com/loftwah/app-composer/issues/399). This is a dated,
read-only baseline. It does **not** claim Google/Bing indexing, rankings, JavaScript
rendering or native social unfurls.

## Method

For each live origin from the published Composer catalogue and shipped app library, one
bounded request each to `/`, `/robots.txt` and `/sitemap.xml`. No recursion, credentials,
cookies, writes or provider APIs. Raw HTML only. Script:
[`audit.mjs`](audit.mjs). Raw observations: [`inventory.json`](inventory.json).

## Inventory

| Product | Origin | Home | Canonical | robots meta | robots.txt | sitemap | Baseline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Paperwork | `paperwork.loftwah.com` | 200 | self | `index,follow,max-image-preview:large` | 200 | 200, 2 URLs | Pass |
| Here / there | `guestbook.loftwah.com` | 200 | self | none | 200 (content signals) | 404 | Pass with optional sitemap follow-up |
| Linkarooie | `showcase.loftwah.com` | 200 | self | none | 200 (content signals) | 404 | Pass with optional sitemap follow-up |
| Link Check | `share.loftwah.com` | 200 | self | none | 200 | 200, 1 URL | Pass |
| Hello World | `ready.loftwah.com` | 200 | self | `noindex,nofollow` | 200 | 404 | Deliberate non-search demo; no change |
| Carry / forward | `ai.loftwah.com` | 200 | self | none | 200 | 200, 1 URL | Pass |
| LDraw | `ldraw.loftwah.com` | 200 | self | `index,follow,max-image-preview:large` | 200 | 200, 1 URL | Pass |
| Launch Kit | `composer-launch-kit.loftwah.workers.dev` | 200 | **missing** | none | 200 | 404 | **Defect** → [Launch Kit #8](https://github.com/loftwah/app-composer-launch-kit/issues/8) |

Every home page returned a non-empty title and description. `ready.loftwah.com` asking
not to be indexed is consistent with its role as a personal Hello reference, not a public
product page.

Guestbook and Linkarooie have public roots but no sitemap. Their profile/detail routes are
dynamic and owner-controlled, so a useful sitemap needs the apps' own publication rules.
That is an optional improvement for the owning repos, not a present correctness failure.

## Reusable acceptance checklist

A mini-app owner can run this without paid APIs, credentials or new infrastructure:

1. The canonical public origin returns 200 over HTTPS and serves the expected product
   title and description.
2. The page declares a self-referencing canonical, or a deliberate alternate canonical.
3. `robots.txt` returns 200 and states the intended policy; a public content site declares
   its sitemap.
4. `sitemap.xml` returns well-formed `<urlset>` XML and lists only public, 200, indexable
   routes. Private, preview and admin URLs are excluded and also protected by auth.
5. Intentional non-indexing uses `noindex` explicitly rather than relying on absence.
6. Record the checked date and exact source revision. A 200 and a sitemap are not proof of
   indexing or ranking.

## Limits

- No Search Console or Bing property data. Indexing status remains unknown and owner-held.
- The home page may differ after client-side rendering; this audit reads raw HTML only.
- No social card was fetched or rendered; check those separately with Link Check.
