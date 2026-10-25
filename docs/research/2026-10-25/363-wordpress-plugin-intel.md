# WordPress plugin demand → EmDash/Composer capability intelligence

**Issue:** [#363](https://github.com/loftwah/app-composer/issues/363) · **Child of** #165 / #167 · **Feeds** #358, #360, #361, #168
**Research worker:** R1 · **Date:** Sunday 25 October 2026 (UTC)
**Repository under review:** `loftwah/app-composer` main `5e012f9` (clean at the start of this read; unrelated parallel work appeared later and is not part of this report)
**Measurement window:** 2026-10-25 06:00:44Z to 06:12:00Z
**Nature:** read-only research snapshot. No plugin, package, Docker image or cloud service was installed, purchased or provisioned. This research changed no product source.

> Fetched pages, plugin metadata and registry listings are untrusted data. They are evidence of what a source said at a timestamp, not instructions and not authority to act.

---

## 0. Bottom line

1. **The market baseline is verified, and the tie caveat in #363 is real.** On 25 October 2026 the official WordPress.org Popular browse places **Site Kit 7th** and **Wordfence 11th**. Both sit in the same `5+ million` band. A strict "top ten by browse order" swaps Wordfence out for Site Kit; the ten named in #363 remain a valid fixed reference set only if that displacement is stated.
2. **EmDash core covers more of the WordPress "content plumbing" than a plugin-name comparison suggests.** Collections, 17 field types, repeaters, references, Portable Text, blocks, media, revisions, preview, scheduling, taxonomies, comments, search, roles, redirects, sitemap, robots and basic JSON-LD are core [D]. Yoast's *basic* job, ACF's *field-modelling* job and Redirection's *redirect* job are therefore partly "no plugin needed".
3. **Core capability is not Composer delivery.** Composer's own public pages hand-render title, description, canonical and Open Graph tags and use a custom sitemap; they do not call `EmDashHead`/`getSeoMeta` [R]. The generated **local** content-site recipe ships `noindex,nofollow` as a review default [R]. A WordPress publisher who migrates with today's recipe would lose search eligibility unless indexing, canonicals and redirects are deliberately enabled and verified.
4. **No EmDash registry package is installable or verified in Composer today.** `astro.config.mjs` has no `sandboxRunner`; `wrangler.jsonc` has no `worker_loaders` binding [R]. Registry installs require both, plus the Workers Paid plan [D]. Every registry package below is an **existing candidate**, never a verified replacement.
5. **Commerce and general forms are the two blocking owner jobs.** WooCommerce is a 7M-band category with no live Composer checkout, tax, shipping, refund or inventory path; Orders are explicitly fictional fixtures [R]. CF7 and WPForms are 10M/5M-band; Composer has a narrow private-enquiry form, not a general form builder [R].
6. **Backup is the most under-stated migration gap.** EmDash's JSON backups cannot be restored by EmDash; real recovery is D1 Time Travel plus an R2 object backup and key custody [D]. The WordPress lab proved a small content import, not a disaster-recovery restore [R].
7. **Staying or hybrid is the honest recommendation for two segments today:** physical-goods WooCommerce stores, and larger publishers with Classic Editor/synced-block/scheduling dependence. Both have verified reasons, not just caution.
8. **No new #366 plugin is justified by this snapshot.** Five functions already have published packages to test first after #369 (general forms, consent, analytics, SEO/redirect import, spam scoring); until one fails a real pinned-stack journey, a new plugin would duplicate published work.

---

## 1. Method, evidence grades and limits

### 1.1 Sources and endpoints

| Source | Endpoint / URL | Use |
|---|---|---|
| WordPress.org Plugin API 1.2 | `https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=<slug>` | Version, active-install band value, last update, minimum WP/PHP, tested-to |
| WordPress.org Popular browse API | `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&request[browse]=popular&request[per_page]=100` | Official ordering, tie enumeration, directory total |
| WordPress.org Popular page | `https://wordpress.org/plugins/browse/popular/` | Independent confirmation of the same order |
| WordPress.org plugin pages | `https://wordpress.org/plugins/<slug>/` | Rendered band text, "Tested up to", required versions |
| EmDash registry | `https://plugins.emdashcms.com/search` and `/plugins/<handle>/<slug>` | Package existence, version, licence, source link, permissions, publisher DID |
| EmDash docs | `https://docs.emdashcms.com/...` | Vendor-documented core behaviour, install requirements, backup/import contracts |
| EmDash blog | `https://emdashcms.com/blog/emdash-plugin-registry` | Registry launch, sandbox-only rule, free-for-now statement, Workers Paid requirement |
| Repository | files under `src/`, `lib/`, `docs/`, `labs/wordpress/`, `astro.config.mjs`, `wrangler.jsonc` | What Composer actually configures and has exercised |

Exact retrieval window and per-record values are in `363-wordpress-plugin-intel.data.json` beside this report. All WordPress.org API records and all quoted plugin pages were fetched inside the window above.

### 1.2 Evidence grades used below

- **[V] Verified now.** Fetched from the official source during the measurement window. Numbers are recorded, not recalled.
- **[D] Vendor-documented.** An official EmDash or Cloudflare statement in current documentation. Not exercised by this run.
- **[R] Repository evidence.** Present in this checkout at `5e012f9`. Behaviour of the code/config, not a production test.
- **[P] Previously exercised, not re-run.** A dated repository receipt exists, but this run did not repeat it.
- **[U] Unknown / unverified.** No adequate evidence.

Claim states (issue vocabulary): **core / existing candidate / verified / partial / missing / incompatible / unnecessary**. "Verified" is reserved for a dated, exercised journey on the pinned stack. A registry listing is never "verified" here.

### 1.3 What this report did not do

- Did not install any WordPress plugin or run a WordPress site. Docker was not started.
- Did not install any EmDash registry package, add a sandbox runner, add a Worker Loader binding or deploy.
- Did not purchase, provision or call a paid provider.
- Did not test a live WordPress→Composer migration on EmDash 1.3.1; the lab receipt is on 1.2.0.
- Did not audit package source, licence text or publisher identity beyond the listing/licence/source link displayed by the registry.

---

## 2. The ten reference plugins: verified market baseline

### 2.1 Measured values

Sorted by the official Popular browse position on 25 October 2026. `API active_installs` is the rounded integer returned by the API; the page band is the text WordPress.org renders. `10,000,000` means "10+ million", not an exact count.

**Set A (the ten named in #363)** is rows 1–6 and 8–11. **Row 7 (Site Kit)** is the verified near-tied candidate that displaces **row 11 (Wordfence)** if the strict official top ten is used. Both facts are shown rather than silently choosing one.

The reference set for this report is therefore **exactly ten** (set A). Site Kit is documented as the displacing candidate, not counted as an eleventh reference plugin.

| # | Plugin (slug) | API active_installs | Page band | Version | Last updated (GMT) | Requires WP | Tested to | Requires PHP |
|---:|---|---:|---|---|---|---|---|---|
| 1 | Elementor (`elementor`) | 10,000,000 | 10+ million | 4.3.5 | 2026-10-13 12:48pm | 6.8 | 7.1.3 | 7.4 |
| 2 | Yoast SEO (`wordpress-seo`) | 10,000,000 | 10+ million | 28.7 | 2026-10-13 5:27am | 6.9 | 7.1.3 | 7.4 |
| 3 | Contact Form 7 (`contact-form-7`) | 10,000,000 | 10+ million | 6.2.3 | 2026-10-21 8:43am | 7.1 | 7.1.3 | 8.3 |
| 4 | Classic Editor (`classic-editor`) | 8,000,000 | 8+ million | 1.7.0 | 2026-05-28 1:51am | 4.9 | **7.0.7** | 5.2.4 |
| 5 | LiteSpeed Cache (`litespeed-cache`) | 7,000,000 | 7+ million | 7.9.2 | 2026-10-20 6:08pm | 6.0 | 7.1.3 | 7.4 |
| 6 | WooCommerce (`woocommerce`) | 7,000,000 | 7+ million | 11.2.1 | 2026-10-09 3:35pm | 7.0 | 7.1.3 | 7.4 |
| 7 | Site Kit by Google (`google-site-kit`) | 5,000,000 | 5+ million | 1.190.0 | 2026-10-19 10:35pm | 5.2 | 7.1.3 | 7.4 |
| 8 | Akismet (`akismet`) | 5,000,000 | 5+ million | 5.7.2 | 2026-08-18 11:42pm | 5.8 | 7.1.3 | 7.2 |
| 9 | WPForms (`wpforms-lite`) | 5,000,000 | 5+ million | 2.0.3 | 2026-10-22 12:32pm | 5.5 | 7.1.3 | 7.2 |
| 10 | All-in-One WP Migration and Backup (`all-in-one-wp-migration`) | 5,000,000 | 5+ million | 7.112 | 2026-10-07 10:36am | 3.3 | 7.1.3 | 5.3 |
| 11 | Wordfence (`wordfence`) | 5,000,000 | 5+ million | 9.0.2 | 2026-09-30 3:30pm | 4.7 | 7.1.3 | 7.0 |

Every API value above was independently checked against the same plugin's public page text during the window. Examples: `wordpress-seo` page shows "10+ million", "6.9 or higher", "Tested up to 7.1.3", "7.4 or higher"; `all-in-one-wp-migration` shows "5+ million", "3.3 or higher", "7.1.3", "5.3 or higher".

### 2.2 The ranking and the tie, stated precisely

- The official Popular API returned **72,509** plugins (`info.results`), 726 pages at 100 per page.
- Its order is band-monotonic: positions 1–3 are 10M, position 4 is 8M, positions 5–6 are 7M, positions 7–11 are 5M. In the returned top 100 (which continues down to 1M), every plugin at 5M or above appears in the first 11. The 5M tie is fully enumerated inside that set: **Site Kit, Akismet, WPForms, All-in-One WP Migration, Wordfence**.
- The official Popular page independently returned the same first 11 in the same order. This is not an artefact of one API call.
- **Consequence:** "the ten highest-install plugins" is not uniquely defined at the 5M band. The issue's ten = the official positions 1–6 and 8–11. The measured top ten by browse order = positions 1–10 and includes Site Kit at 7, excluding Wordfence at 11.
- **Recommendation for the public artefact:** keep the ten named in #363 as a fixed reference set for continuity, display each one's measured position, and show the Site Kit/Wordfence exchange as a dated tie note. Do not claim Wordfence was top-ten on 25 October 2026.

The within-band order is official but its tie-break method is not documented. It is not a pure "active installs descending" sort inside a band. Treat band values as the comparable measure and browse position as the published ordering.

### 2.3 Maintenance signals worth showing

- **Classic Editor is the outlier.** Last updated 28 May 2026 (about five months before measurement) and tested only to WordPress 7.0.7, not the 7.1.3 the others claim. High installs do not mean current compatibility.
- **Akismet** last updated 18 August 2026 (about ten weeks).
- **Wordfence** last updated 30 September 2026 (about four weeks).
- **Contact Form 7** has the highest runtime floor in the set: WordPress 7.1 and PHP 8.3. A host still on PHP 8.2 cannot run the current release.
- **Absent fields:** UpdraftPlus and WP Fastest Cache return no usable `requires_php` value from the API and no PHP row on their pages; Limit Login Attempts Reloaded returns `false`. These are recorded as absent, not as "any version".

### 2.4 What the bands do not establish

- They are WordPress.org's rounded active-install bands, not revenue, sites, page views or market share.
- They exclude plugins not hosted in the WordPress.org directory. Gravity Forms, ACF Pro, WP Rocket, Elementor Pro, MemberPress and FluentCRM all returned `{"error":"Plugin not found."}` from the API on this date. Their demand is outside this method.
- They say nothing about whether an owner uses the plugin's paid tier, add-ons or integrations.
- A high band does not mean the plugin is well maintained, secure or suitable. It means many installations report it.

---

## 3. Category coverage beyond the top ten

All values below are [V] from the same API window (with public-page corroboration for the named reference set and 14 category entries). Categories are assigned from the plugin's own name/description/tags and the job it advertises, not from a WordPress.org canonical taxonomy. The directory's tag browse is noisy: `tag=page-builder` did not return Elementor, and `tag=e-commerce` returned small gateways first. Tag browse was therefore **not** used to rank categories.

| Category | Verified plugin (slug) | API active_installs | Version | Last updated | Tested to | Note |
|---|---|---|---:|---|---|---|
| SEO | Rank Math (`seo-by-rank-math`) | 4,000,000 | 1.0.280 | 2026-10-06 | 7.1.3 | Second SEO plugin by band |
| SEO | All in One SEO (`all-in-one-seo-pack`) | 2,000,000 | 5.0.4 | 2026-10-22 | 7.1.3 | Third SEO plugin |
| SEO | Redirection (`redirection`) | 2,000,000 | 5.10.1 | 2026-09-19 | 7.1.3 | Redirect manager, overlaps core redirects |
| SEO | SEOPress (`wp-seopress`) | 300,000 | 10.3 | 2026-10-23 | 7.1.3 | Long-tail SEO option |
| Forms | Fluent Forms (`fluentform`) | 800,000 | 6.2.16 | 2026-10-16 | 7.1.3 | API version; page version field did not render |
| Forms | Forminator (`forminator`) | 600,000 | 1.58.2 | 2026-10-14 | 7.1.3 | Free form builder |
| Commerce | SureCart (`surecart`) | 80,000 | 4.10.0 | 2026-10-20 | 7.1.3 | Hosted-style commerce |
| Commerce | Easy Digital Downloads (`easy-digital-downloads`) | 40,000 | 3.7.2 | 2026-10-14 | **7.0.7** | Digital goods; tested behind current WP |
| Caching | WP Super Cache (`wp-super-cache`) | 1,000,000 | 3.1.4 | 2026-09-30 | 7.1.3 | Classic page cache |
| Caching | WP-Optimize (`wp-optimize`) | 1,000,000 | 4.7.0 | 2026-09-21 | 7.1.3 | Cache, compress, minify, clean |
| Caching | Speed Optimizer (`sg-cachepress`) | 1,000,000 | 7.8.5 | 2026-10-20 | 7.1.3 | SiteGround bundle |
| Caching | W3 Total Cache (`w3-total-cache`) | 900,000 | 2.11.0 | 2026-10-20 | 7.1.3 | Page/object cache |
| Caching | WP Fastest Cache (`wp-fastest-cache`) | 1,000,000 | 1.5.3 | 2026-10-10 | 7.1.3 | PHP requirement absent |
| Caching | Redis Object Cache (`redis-cache`) | 500,000 | 3.0.0 | 2026-09-18 | 7.1.3 | Object cache, not page cache |
| Security | Really Simple Security (`really-simple-ssl`) | 3,000,000 | 9.8.3 | 2026-09-15 | 7.1.3 | Security hardening |
| Security | Limit Login Attempts Reloaded (`limit-login-attempts-reloaded`) | 1,000,000 | 3.3.10 | 2026-09-23 | 7.1.3 | Login security, 2FA, firewall |
| Security | Sucuri Security (`sucuri-scanner`) | 600,000 | 2.8.1 | 2026-10-14 | 7.1.3 | Audit, malware scanner |
| Backup | UpdraftPlus (`updraftplus`) | 3,000,000 | 1.26.13 | 2026-10-19 | 7.1.3 | PHP requirement absent |
| Backup | Duplicator (`duplicator`) | 1,000,000 | 5.0.6 | 2026-10-14 | 7.1.3 | Backup and migration |
| Backup | WPvivid (`wpvivid-backuprestore`) | 900,000 | 0.9.136 | 2026-09-28 | 7.1.3 | Backup and restore |
| Backup | Backuply (`backuply`) | 600,000 | 1.6.0 | 2026-10-22 | 7.1.3 | Backup |
| Page building | Kadence Blocks (`kadence-blocks`) | 600,000 | 3.8.0.2 | 2026-10-22 | 7.1.3 | Block library, not a full builder |
| Page building | SiteOrigin Panels (`siteorigin-panels`) | 400,000 | 2.38.0 | 2026-10-19 | 7.1.3 | Page builder |
| Page building | Beaver Builder Lite (`beaver-builder-lite-version`) | 100,000 | 2.11.1.2 | 2026-10-19 | 7.1.3 | Page builder |
| Email | WP Mail SMTP (`wp-mail-smtp`) | 4,000,000 | 4.10.3 | 2026-10-20 | 7.1.3 | Delivery-led; logging/alerts are vendor add-ons |
| Email | MC4WP (`mailchimp-for-wp`) | 1,000,000 | 4.14.1 | 2026-09-16 | 7.1.3 | Newsletter connection |
| Email | Easy WP SMTP (`easy-wp-smtp`) | 500,000 | 2.15.1 | 2026-08-12 | 7.1.3 | SMTP |
| Email | Newsletter (`newsletter`) | 200,000 | 9.4.9 | 2026-10-22 | 7.1.3 | Sending and lists |
| Analytics | MonsterInsights (`google-analytics-for-wordpress`) | 2,000,000 | 11.3.0 | 2026-09-16 | 7.1.3 | GA4 dashboard |
| Analytics | WP Statistics (`wp-statistics`) | 500,000 | 14.16.18 | 2026-10-23 | 7.1.3 | First-party statistics |
| Membership | Members (`members`) | 300,000 | 3.2.27 | 2026-10-21 | 7.1.3 | Roles/capabilities |
| Membership | Ultimate Member (`ultimate-member`) | 200,000 | 2.14.1 | 2026-10-23 | 7.1.3 | Public member profiles |
| Fields | Advanced Custom Fields (`advanced-custom-fields`) | 2,000,000 | 6.8.10 | 2026-09-10 | 7.1.3 | ACF free; Pro absent from directory |
| Multilingual | Polylang (`polylang`) | 900,000 | 3.9.1 | 2026-10-21 | 7.1.3 | WPML API returns `closed`, not a normal listing |
| Multilingual | TranslatePress (`translatepress-multilingual`) | 400,000 | 3.3.8 | 2026-10-13 | 7.1.3 | Front-end translation |
| Consent | CookieYes (`cookie-law-info`) | 1,000,000 | 3.5.7 | 2026-10-14 | 7.1.3 | Cookie banner/consent |

### 3.1 Category observations

- **Commerce is one plugin, then a cliff.** WooCommerce is 7M. The next verified commerce plugins are SureCart at 80k and EDD at 40k. Replacing WooCommerce is replacing a category and an operating workflow, not swapping a plugin.
- **Forms is two plugins, then a long tail.** CF7 10M and WPForms 5M dwarf Fluent Forms 800k and Forminator 600k. The top two have different models: CF7 is markup/shortcode-driven; WPForms is a builder, with entries and payments depending on the tier.
- **SEO is three large products plus utilities.** Yoast 10M, Rank Math 4M, AIOSEO 2M, Redirection 2M, SEOPress 300k. Their overlap is large; an owner rarely needs more than one SEO suite plus redirects.
- **Caching is fragmented.** LiteSpeed 7M is the outlier; its value depends on the LiteSpeed server stack. The rest cluster at 1M/900k. A cache plugin's value is tied to the host and page-cache topology, not portable configuration.
- **Security splits into login hardening and scanning.** Wordfence 5M bundles firewall, malware scan and login security. Really Simple 3M and Limit Login 1M are narrower; Sucuri 600k is scanner-led. These are not interchangeable.
- **Backup splits into scheduled backup and migration.** AIO 5M is migration-led; UpdraftPlus 3M and WPvivid 900k are scheduled-backup-led. "Backup" and "migration" are different jobs with different restore contracts.
- **Page building is Elementor plus block libraries.** Elementor 10M; the next tier is Kadence Blocks 600k and SiteOrigin 400k. The market is not "many equal page builders"; it is one dominant builder and a block ecosystem.
- **Email splits into delivery (WP Mail SMTP 4M) and marketing (MC4WP 1M, Newsletter 200k).** They solve different jobs.
- **Analytics splits into Google surfaces (Site Kit 5M, MonsterInsights 2M) and first-party statistics (WP Statistics 500k).**
- **Membership leaders are outside the directory.** Members and Ultimate Member are visible at 300k/200k; MemberPress and Paid Memberships Pro returned "not found" from the wp.org API. The measurable set understates the category.
- **ACF's free plugin is 2M; ACF Pro is not measurable here.** The free band is a floor, not the size of the field-modelling job.
- **Consent is its own category.** CookieYes 1M. It is not a WordPress-only concern; a Cloudflare-hosted site still needs a consent decision when it loads analytics, ads or embeds.

### 3.2 Directory-method caveat

The WordPress.org API can only measure plugins distributed there. The following returned `Plugin not found` on 25 October 2026 and are therefore absent from every table: `gravityforms`, `advanced-custom-fields-pro`, `wp-rocket`, `elementor-pro`, `memberpress`, `fluentcrm`. `sitepress-multilingual-cms` (WPML) returned `{"error":"closed"}` instead. Treat the measured bands as a floor for those products, never as evidence they lack demand.

---

## 4. Destination inventory: what Composer/EmDash actually offers

### 4.1 EmDash core (vendor-documented, current docs)

Composer pins `emdash` **1.3.1** and `@emdash-cms/cloudflare` **1.3.1** [R `package.json`]. EmDash 1.3 was announced 15 October 2026 [D]. The following is the core surface relevant to WordPress replacement:

| Capability | What core provides | Relevance |
|---|---|---|
| Content model | Collections, taxonomies, relations, menus, widgets, page layouts, sections | Replaces custom post types and much of a theme's structure |
| Fields | 17 types: string, text, url, number, integer, boolean, datetime, select, multiSelect, portableText, image, file, reference, json, slug, repeater, blocks | ACF-style modelling is core, not a plugin |
| Editor | Rich text/Portable Text, typed blocks, reusable sections, preview, revisions, scheduling | Replaces Classic/Gutenberg editing model, not its exact UI |
| Media | Media library, R2 storage adapter, alt/caption metadata, replacement/crop copies | Replaces WordPress media library |
| SEO | Per-entry SEO panel, canonical, noindex, Open Graph/Twitter tags, sitemap index/children, robots.txt, redirects, 404 log, `BlogPosting`/`WebSite` JSON-LD | Replaces Yoast's basics and Redirection's basics |
| Search | Full-text search, FTS5 index, rebuild after restore | Replaces WordPress search |
| Comments | Native comments with approved rendering | Replaces WordPress comments, subject to spam handling |
| Identity | Users, roles, passkeys, invites, recovery, API tokens | Replaces WordPress users/login |
| Email | `email:deliver` hook; provider plugin required in production | Replaces `wp_mail` plumbing, not deliverability tooling |
| Import | Admin WordPress importer (WXR or exporter), media download/rewrite, ACF/SEO field mapping | Replaces the content part of a migration |
| Backup | JSON backup for inspection; **not restorable**; D1 Time Travel/R2 procedure documented | Replaces the "export" half, not the "restore" half |
| Caching | Astro route caching with Cloudflare cache provider and tag invalidation | Platform path for page caching, if configured |
| i18n | Astro i18n integration, translated entries, hreflang | Replaces Polylang basics |
| Plugin formats | Native (`plugins: []`, in-process) and sandboxed (`sandboxed: []`, runner required) | Determines what can be installed |

Evidence: [D] `docs.emdashcms.com/guides/seo/`, `/reference/field-types/`, `/guides/backups/`, `/deployment/route-caching/`, `/migration/from-wordpress/`, `/plugins/installing/`; [R] `package.json`.

**Important distinction:** this is EmDash's capability, not proof that Composer's public site uses it. Composer's pages do not call `EmDashHead`/`getSeoMeta`; `src/pages/sitemap.xml.ts` builds a custom sitemap from static paths plus catalogue slugs; `src/pages/robots.txt.ts` is hand-written [R]. The generated content-site recipe sets `<meta name="robots" content="noindex,nofollow">` unconditionally and documents that local pages stay noindex until a real public site is reviewed [R `lib/content-model/site-template/`].

### 4.2 Composer's own code and platform services

| Component | What it is | Relevance to WordPress jobs |
|---|---|---|
| `composer-stacks` native plugin | Mini-app stacks, publications, resources, share cards, workspace scope | App composition, not a WP plugin equivalent |
| `composer-miniapps` native plugin | Guestbook/Linkarooie admin, moderation, collection sources | Content/community operations |
| `composer-members` native plugin | Workspace membership and roles | Operator permissions, not public membership |
| `composer-resend` native plugin | `hooks.email-transport:register`; Resend delivery from deployment secrets | Transactional email transport |
| `extension/` | Manifest V3 Cloudflare dashboard browser overlay, v0.1.1 | **Not** an EmDash plugin and not a WP replacement |
| Cloudflare Access | Team domain, audience, auto-provision, default role 10 | Admin identity perimeter |
| D1 | Content, users, settings, orders, orders events, analytics aggregates | Relational store |
| R2 | Media bucket | Object storage |
| KV | `SESSION` namespace | Session storage |
| Worker services | Guestbook and Showcase bindings, separately pinned | Independent mini-apps |
| Rate limit | `USAGE_LIMIT`, 60 requests per 60 seconds | Usage counter protection, not form spam |
| Cron | Every minute | Scheduled maintenance |
| Orders | `composer.order/1` contract, workspace-scoped, **fictional fixtures only** | Commerce domain model, no merchant |
| Private enquiries | Guestbook-owned `briefs/v1` form, Composer Inbox broker | One narrow form journey |
| Analytics | First-party counters (`app_open`, `item_open`, `inspection_completed`, `postcard_received`), `/activity`, frozen reports | Product activity, not GA4/Search Console |
| Public metadata | Hand-rendered title/description/canonical/OG; custom sitemap/robots; homepage `WebSite` JSON-LD | Partial SEO surface |
| Caching | `Cache-Control: no-store` on app responses; no Astro cache provider or route rules | No page cache today |
| Media handling | `imageService: 'passthrough'`; `maxUploadSize: 1024*1024` (1 MiB) | No image transforms; low admin upload cap |

Evidence: [R] `astro.config.mjs`, `wrangler.jsonc`, `src/worker.ts`, `src/middleware.ts`, `src/layouts/Base.astro`, `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts`, `src/plugins/resend.ts`, `docs/orders.md`, `docs/private-enquiries.md`, `docs/analytics-events.md`, `extension/README.md`.

The 1 MiB cap is the configured admin upload limit. Whether the WordPress media importer bypasses it was not tested; large-media migration is therefore **unknown**, not proven.

### 4.3 Official registry packages relevant to this matrix

Every listing below was fetched on 25 October 2026. All are **sandboxed** by registry rule [D blog], all display **MIT**, and none is installed in Composer. "Permissions" are the capability labels shown in the listing; "egress" notes network access where declared.

| Package (handle/slug) | Publisher DID | Version | Source shown | Permissions (count) | Egress | Listed |
|---|---|---|---:|---|---|---|---|
| `@moorage.dev/seo` (SEO & Schema Markup) | `did:plc:cus3srdqglppyowqrw3hvjfj` | 0.1.11 | github.com/moorage-dev/moorage | Read content, read structure, read bylines, read redirects, manage redirects (5) | None declared | 2026-10-23 |
| `@nookeshk.bsky.social/seo-suite` (SEO Suite) | `did:plc:suw5qc22clrlpslfo6qapiu4` | 0.2.0 | github.com/nookeshkarri7/emdash-seo-suite-plugin | Read content, **manage content**, read structure, read unsaved edits, suggest edits, block publishing, read taxonomies, read redirects, manage redirects, read media (10) | None declared | 2026-09-29 |
| `@bitdoze.com/emdashhq-contact-forms` (Contact Forms) | `did:plc:qr4gckwrgatg5h3lzc57bsnp` | 1.1.2 | github.com/bitdoze/emdashhq.com | Network requests, send email (2) | Yes | 2026-10-10 |
| `@masonjames.com/contact-forms` (Contact Forms) | `did:plc:neov22wblqftd3653r6cl2gl` | 0.2.0 | No public source link shown | Send email (1) | No network | 2026-09-30 |
| `@solspace.com/freeform` (Freeform) | `did:plc:tsp7az5h6qsqjzqsgz37wonx` | 0.1.4 | github.com/solspace/emdash-freeform | **Unrestricted network**, send email (2) | Yes, any host | 2026-10-20 |
| `@netdollar.dev/forms` (Forms) | `did:plc:zfm2t2bsxltpu44kc7g3eyn4` | 0.1.0 | github.com/charl-kruger/emdash-forms | Send email (1) | No network | 2026-09-29 |
| `@ecommerceave.com/emdash-stripe-checkout` (Stripe Checkout) | `did:plc:wlshattmcjplayfxlgzbhxvk` | 0.10.3 | github.com/ecommerceave/emdash-stripe-checkout | Read content, **manage content**, read structure, read media, network (5) | Yes | 2026-10-24 |
| `@smokyco.bsky.social/dinkus-commerce-beta` (Commerce Beta) | `did:plc:ekk4pjmkh3k3ql2kfoex3qt4` | 0.6.0-beta.1 | github.com/dinkuskit/commerce | Read unsaved edits, suggest edits, read media, network, email (5) | Yes | 2026-10-15 |
| `@dashcommerce.bsky.social/dashcommerce-lite` (DashCommerce Lite) | `did:plc:yakxzbkuhphkc5eepv7p4wrc` | 0.2.0 | github.com/emdashCommerce/dashcommerce | Read content, network (2) | Yes | 2026-10-24 |
| `@devbit.me/apimail` (Mail API) | `did:plc:vrar4voaukehdxtas2ml4txc` | 0.3.1 | git.devbit.me/devbit.me/emdash-plugin-apimail | Network, provide email transport (2) | Yes | 2026-10-20 |
| `@masonjames.com/emdash-smtp` (SMTP) | `did:plc:neov22wblqftd3653r6cl2gl` | 0.4.1 | github.com/masonjames/emdash-smtp | Network, provide email transport (2) | Yes | 2026-09-30 |
| `@vcode.sh/resend` (Resend Email) | `did:plc:ebt3jlwrhznbx4gpq4ahmq73` | 0.1.0 | github.com/vcode-sh/emdash-resend-email | Network, provide email transport (2) | Yes | 2026-10-12 |
| `@shane.bsky.shas.am/emdash-umami-analytics` (Umami Analytics) | `did:plc:efxj3t72atnke555mnnmywju` | 0.1.4 | github.com/shanelord01/emdash-umami-analytics | Read content, read structure, **unrestricted network** (3) | Yes, any host | 2026-10-16 |
| `@eisbachcode.de/analytics` (Analytics) | `did:plc:iucwrgdd464ddkranaa6ux3l` | 0.3.2 | github.com/eisbachcode/emdash-plugin-analytics | Read content, read structure, network (3) | Yes | 2026-09-29 |
| `@moorage.dev/approvals` (Content Approval) | `did:plc:cus3srdqglppyowqrw3hvjfj` | 0.2.1 | github.com/moorage-dev/moorage | Read content, read revisions, publish, read structure, block publishing, send email, **read user accounts** (7) | No network | 2026-10-23 |
| `@moorage.dev/site-health` (Site Health & Broken Links) | `did:plc:cus3srdqglppyowqrw3hvjfj` | 0.1.5 | github.com/moorage-dev/moorage | Read content, read structure, read redirects, manage redirects, **unrestricted network**, send email (6) | Yes, any host | 2026-10-23 |

Notes:

- "Unrestricted network" is the registry's own label for any host. Freeform, Umami and Site Health declare it. That is a real trust-review item, not a defect by itself.
- SEO Suite requests content-write, unsaved-edit and publish-blocking capabilities. It is materially broader than SEO & Schema Markup. #365 should surface that difference.
- Content Approval requests read-user-accounts. That is appropriate for approvals, but it is a privilege to disclose.
- The listing pages read here did not display a `requires` EmDash/Astro range, so compatibility with EmDash 1.3.1/Astro 7.4.2 is **unknown**. The registry client can check `requires`; this run did not execute it.
- Licence is the listing's "MIT". No licence file or package tarball was downloaded or audited.
- **Cost separation:** the registry launch post says all registry plugins are **free for now**, not a permanent price promise. Running any of them still needs the Workers Paid sandbox entitlement. Separately, Freeform's AI features need an Anthropic key, Mail API/Resend/SMTP need a provider account, Stripe/DashCommerce need a Stripe account and incur transaction fees, and Umami needs a Umami instance. A free package is not a zero-cost deployment.

### 4.4 The install gate: why every package is only a candidate

EmDash's install documentation is explicit [D `docs.emdashcms.com/plugins/installing/`]:

- Registry installs need an administrator with `plugins:manage`, configured storage for bundles, and an available sandbox runner.
- On Cloudflare Workers the runner is `sandbox()` from `@emdash-cms/cloudflare`; it requires **Worker Loader** and a `worker_loaders` binding named `LOADER`, and the **Workers Paid** plan.
- Without `LOADER`, registry browsing may remain available, but config-managed sandboxed plugins do not load and install/update requests return `SANDBOX_NOT_AVAILABLE`.
- The Cloudflare templates export `PluginBridge` but leave the binding commented out.
- The "browsing remains available" fallback applies only when the registry is configured. Composer has neither an explicit `registry` nor a `sandboxRunner`, so the admin registry catalogue is not part of this configuration; browsing is not a partial substitute for installation.

Composer state [R]:

| Requirement | State | Evidence |
|---|---|---|
| `sandboxRunner` in `astro.config.mjs` | **Absent** | Integration options list only native `plugins: [...]` |
| `worker_loaders`/`LOADER` in `wrangler.jsonc` | **Absent** | Bindings are D1, R2, KV, services, rate limit, cron, vars |
| `PluginBridge` export | **Present** | `src/worker.ts` imports and re-exports it |
| `sandbox()` available in installed adapter | **Present** | `@emdash-cms/cloudflare@1.3.1` exports `./sandbox` |
| Workers Paid plan | **Unknown** | Not verifiable from the repo; contract/account fact |
| Registry enablement | **Not configured** | No registry option in `astro.config.mjs` |

So the gap is narrow but real: the bridge exists, the adapter helper exists, and the two wiring steps plus plan entitlement do not. That is #369's job. Until #369 lands, any "Works on Composer" claim for a registry package is unsupported.

### 4.5 What is verified working today

| Destination | State | Evidence | What it proves |
|---|---|---|---|
| WordPress content import (small publisher) | **Verified 18 Oct 2026**, EmDash 1.2.0 | `labs/wordpress/weekender/OBSERVATIONS.md` | 11 entries, 3 attachments, comments, bylines, public routes after source-off |
| Private enquiry form + Inbox | **Previously exercised**, not re-run | `docs/private-enquiries.md`, `src/enquiries/` | One fixed brief form, moderation, 30-day body retention |
| Resend owner mail | **Previously exercised**, not re-run | `docs/guide.astro`, `src/plugins/resend.ts` | Invited-recipient delivery, not general customer email |
| Orders | **Fictional fixtures only** | `docs/orders.md` | State machine and reconciliation, no merchant, checkout, refund or fulfilment |
| First-party activity counters | **Repo + docs**, live history not re-checked | `docs/analytics-events.md` | Recorded app events, lower bounds, not GA4 |
| EmDash SEO core | **Documented**, not used by Composer pages | EmDash SEO guide vs `src/layouts/Base.astro` | Capability exists; Composer surface is custom/partial |
| Registry package install | **Not possible today** | `astro.config.mjs`, `wrangler.jsonc`, install docs | Candidate only |
| Page cache | **Not configured** | `src/middleware.ts`, `astro.config.mjs` | `no-store` on app responses |
| Backup/restore rehearsal | **Not present** | EmDash backup docs, STATUS.md | No productised restore |

---

## 5. Plugin-by-plugin mapping

Status is about the **owner job**, not the plugin name. A single row can be "core" for the basic job and "partial" overall because of a material gap.

### 5.1 The ten reference plugins

| WordPress plugin | Owner job | Destination in Composer/EmDash | Status | Evidence | Known gaps / next action |
|---|---|---|---|---|---|
| **Yoast SEO** (`wordpress-seo`) | Be findable and shareable; keep rankings through a move | EmDash SEO panel, sitemap, robots, redirects, 404 log, `BlogPosting`/`WebSite` JSON-LD [D]; registry `@moorage.dev/seo@0.1.11` for richer graph, page checks, redirect CSV import [V] | **core** (basics) + **existing candidate** (advanced); **partial overall** | [D] SEO guide; [V] registry page; [R] Composer uses hand-rendered metadata, not `EmDashHead` | No focus keyphrase/readability/AI in core (SEO Suite claims focus keyphrase/readability, unverified); the Schema plugin says no FAQ/Product/Event schema; no regex redirects; imported Yoast fields land as content fields, not the SEO panel; no verified Composer install. Test after #369, then #167 |
| **Elementor** (`elementor`) | Design and lay out pages without code | EmDash editor + blocks + Astro components/themes + Composer agent-built sections; no Elementor importer | **partial**; **incompatible** for template reuse | [D] field types/blocks; [R] no Elementor parser; lab never touched Elementor | No drag-and-drop canvas, global widgets, popups, theme-builder parity. Elementor JSON/`_elementor_data` is not a portable destination artefact. Rebuild manually or stay. #167 |
| **Contact Form 7** (`contact-form-7`) | Let visitors send a message without spam | No core form builder; Composer Guestbook `briefs/v1` enquiry + Inbox [R]; registry Contact Forms, Freeform, Forms [V] | **missing** (general); **partial** (one enquiry form); **existing candidate** (registry) | [R] `docs/private-enquiries.md`; [V] registry | Fixed brief fields, no contact fields, no conditional logic, no file upload, no entry export in Composer; registry unverified. #117/#369 |
| **Classic Editor** (`classic-editor`) | Edit in the familiar classic screen; keep HTML workflows | EmDash rich text/Portable Text + HTML blocks [D] | **unnecessary** for new builds; **partial** for legacy editorial teams | [D] migration doc; [R] lab notes say Classic coverage unproven | No Classic UI; synced/dynamic blocks and shortcode/page-builder markup need rebuild; editor training/change management. #167 |
| **LiteSpeed Cache** (`litespeed-cache`) | Make pages fast under load | Cloudflare Workers/CDN + Astro route caching + EmDash cache tags [D]; **not configured** in Composer [R] | **missing** in Composer today; **platform path exists** | [R] `no-store`, no cache provider, `imageService: passthrough`; [D] route caching | No HTML page cache, no critical-CSS pipeline, no image transforms. Astro's build already bundles/minifies assets, so that part is not the gap. A cache-dependent high-traffic site has no verified equivalent here. Configure route caching or stay. #361 |
| **WooCommerce** (`woocommerce`) | Sell products, take payment, manage orders | Composer Orders (fictional only) [R]; registry Stripe Checkout, DashCommerce Lite, Commerce Beta [V]; Shopify external (contract modelled, no connector) [R/D] | **missing** (live commerce); **partial** (order domain model) | [R] `docs/orders.md`: "No merchant connection, hosted checkout, provider webhook, payment, refund or Printful order" | No cart/checkout/tax/shipping/inventory/coupons/customer accounts/subscriptions/refunds/emails/reports. Do not migrate a store. #105 |
| **WPForms** (`wpforms-lite`) | Build forms, capture leads and payments | Same as CF7: no core builder; registry Freeform/Contact Forms; Guestbook enquiry is not a substitute | **missing** (general); **existing candidate** | [R] enquiry docs; [V] registry | Payment forms, surveys, quizzes, conditional logic, entries, CSV, add-ons all absent. #117/#369 |
| **Akismet** (`akismet`) | Keep spam out of comments and forms | Human moderation (Guestbook/Inbox, native comments) [R]; Cloudflare Turnstile available but **not configured or verified here**; registry Freeform spam scoring [V] and Comment Spam Protection (search listing) | **partial** (moderation); **missing** (automated scoring) | [R] no Turnstile in repo; [V] registry | No spam service, no reputation feed, no automated form scoring. Public comment form is absent in the imported publisher (approved comments only). #10/#369 |
| **Wordfence** (`wordfence`) | Protect the site from attacks and malware | Cloudflare Access + Workers isolation + EmDash roles/passkeys [R/D]; Cloudflare WAF/Turnstile available, **not configured or verified here**; registry Site Health [V] and CrowdSec (search listing) | **partial** (platform-owned); **not parity** | [R] Access config; no WAF/Turnstile/malware-scan configuration in the repo; [V] registry | No malware/file-integrity scanning is configured or documented here; no plugin vulnerability feed; no WordPress login to protect; no Wordfence-style IP-block UI. The threat model is different, not equivalent. #10/#365 |
| **All-in-One WP Migration and Backup** (`all-in-one-wp-migration`) | Move or restore the whole site safely | EmDash importer + official Exporter 1.2.0 [P]; EmDash site transfer [D]; D1 Time Travel + R2 backup + key custody [D] | **partial** (small content import verified); **missing** (productised backup/restore) | [P] lab; [D] backups; [R] no backup UI/restore | No scheduled offsite backup, no one-click restore, no restore rehearsal, no plugin/theme settings, no large-site proof. Import ≠ disaster recovery. #8/#9/#167 |
| **Site Kit** (`google-site-kit`) | See search, analytics and ad performance in one dashboard | Composer first-party activity counters `/activity` + frozen reports [R]; registry Analytics/Umami [V]; no GA4/Search Console/AdSense connection | **partial** (product activity); **missing** (Google surfaces) | [R] analytics docs; [V] registry; no Google client in repo | No GA4, Search Console, AdSense, PageSpeed Insights; no cross-domain attribution or consent-aware tracking. #360/#369 |

### 5.2 Agency extras named in #363

| WordPress plugin | Job | Destination | Status | Gap / owner |
|---|---|---|---|---|
| **Rank Math** (`seo-by-rank-math`, 4M) | SEO guidance, schema, redirects | Core SEO basics + `@moorage.dev/seo` candidate; Rank Math CSV import claimed by that plugin | **partial** / **existing candidate** | Same schema/keyphrase/redirect gaps as Yoast; CSV import is vendor-documented by the plugin, not tested. #369 |
| **Redirection** (`redirection`, 2M) | Manage redirects and 404s | EmDash redirects + 404 log (core) [D]; EmDash SEO plugin adds CSV import [V] | **core** (basics); **partial** (bulk import/regex) | No regex; server-level rules outside the app; CSV import via unverified plugin. #167 |
| **Gravity Forms** (premium, not in wp.org) | Advanced forms, workflows, payments | No core; registry Freeform/Contact Forms candidates | **missing** / **existing candidate** | Add-ons, conditional logic, payment gateways, entries, integrations absent. #117/#369 |
| **ACF** (`advanced-custom-fields`, 2M; Pro absent) | Model custom content fields | EmDash 17 field types, repeaters, references, blocks [D]; importer maps ACF values to JSON [D] | **core** (modelling); **partial** (import fidelity) | ACF location rules/options pages not modelled; relationship/post-object values keep WordPress IDs; images keep WP media references; manual rebuild. #167 |
| **WP Mail SMTP** (`wp-mail-smtp`, 4M) | Make site email arrive; logs/alerts | Native `composer-resend` transport [R/P]; registry SMTP/Mail API/Resend [V]; Cloudflare Email Sending option [D] | **verified previously** (transport); **partial** (logging/alerts) | No owner-facing email log, resend, deliverability diagnostics or failover; provider/domain auth external. #117 |
| **UpdraftPlus** (`updraftplus`, 3M) | Scheduled backups and restore | EmDash D1/R2 procedure [D]; no Composer backup product | **missing** (productised); **platform procedure exists** | Same as AIO: no schedule, no retention UI, no restore rehearsal. #8/#9 |
| **Site Kit** | Covered above | | | |
| **Polylang / TranslatePress** (900k/400k) | Publish in multiple languages | EmDash i18n + translated entries + hreflang [D]; registry LinguaDash (search listing) | **core** (i18n mechanics); **existing candidate** (translation workflow) | No verified Composer multilingual journey; translation service/AI is external. #167/#369 |
| **CookieYes** (1M) | Consent and compliance | No core consent manager; registry Cookie Consent (search listing) | **missing** / **existing candidate** | No consent banner, category gating, Consent Mode or record-keeping in Composer. #10/#369 |
| **Members / Ultimate Member** (300k/200k) | Public membership, profiles, roles | Composer workspace roles/access [R], not public membership; no public signup | **missing** | Workspace membership ≠ customer membership. No plans, subscriptions, gated content, member profiles. #10/#105 |

### 5.3 Status summary

| Status | Jobs |
|---|---|
| **core** | EmDash content model, fields, media, revisions/preview, taxonomies, comments, search, roles, redirects (basics), sitemap/robots (capability) |
| **verified** | Small WordPress content import (EmDash 1.2.0, 18 Oct 2026); Resend owner mail (previously); private enquiry (previously) |
| **existing candidate** | SEO & Schema, SEO Suite, Contact Forms (two), Freeform, Forms, Stripe Checkout, Commerce Beta, DashCommerce Lite, Mail API, SMTP, Resend plugin, Analytics, Umami, Content Approval, Site Health |
| **partial** | Yoast/Rank Math, ACF import, AIO/UpdraftPlus migration, Wordfence, Akismet, Site Kit, WP Mail SMTP, Elementor |
| **missing** | Live commerce, general forms, memberships, page cache, automated spam, Google analytics/search console, consent, productised backup/restore |
| **incompatible** | Elementor template/JSON reuse |
| **unnecessary** | Classic Editor's WordPress-only UI for new builds; a separate redirect plugin for basic rules; a separate field plugin for basic ACF-style modelling |

---

## 6. The second ranking: migration-relevant category priority

This ranking is **not** by installs. It is an R1 analyst ranking for #363, to be replaced or confirmed by #358/#361 buyer research. Criteria, applied in order:

1. **Segment-blocking:** can an owner in that segment migrate at all without the job?
2. **Verified destination absent:** is there no verified path on the pinned stack?
3. **Data lock-in:** how much owner data or workflow must be reconciled?
4. **Cutover risk:** can a mistake lose rankings, orders, mail or recoverability?
5. **Breadth:** how many of the measured top-100 plugins sit in the category?

| Priority | Category | Why here | Verified destination today |
|---:|---|---|---|
| 1 | **Commerce / payments / orders** | Blocks physical-goods and subscription businesses; highest data/workflow lock-in; WooCommerce is 7M and the next commerce plugin verified here is 80k | None live; Orders fictional; registry candidates only |
| 2 | **Forms / leads / spam** | Blocks service businesses and lead capture; CF7 10M + WPForms 5M; no general builder | One fixed enquiry form; registry candidates |
| 3 | **Backup / migration / recovery** | Every migration needs a rollback; import is not restore; WordPress owners expect scheduled backup + one-click restore | Import verified small; recovery procedure documented, not productised |
| 4 | **SEO / schema / redirects** | Ranking loss is the most visible cutover failure; Yoast 10M + Rank Math 4M + AIOSEO 2M + Redirection 2M | Core basics; advanced plugin candidate; Composer surface partial/noindex recipe |
| 5 | **Page building / editor / fields** | High content lock-in (Elementor JSON, ACF values); determines rebuild cost | Core editor/fields; Elementor incompatible; ACF partial |
| 6 | **Security / identity / anti-abuse** | Due diligence for every owner; platform model differs; no configured malware scanner | Access/Workers/roles; no WAF/Turnstile verified; no scanner |
| 7 | **Memberships / permissions / subscriptions** | Blocks membership businesses; public membership is absent | Workspace roles only |
| 8 | **Email / CRM / marketing** | Transport exists, but campaigns, consent, CRM and deliverability tooling do not | Resend transport; registry candidates; no CRM |
| 9 | **Performance / cache / media** | Scale risk; LiteSpeed 7M; Composer has no page cache and no image transforms | Platform path documented, not configured |
| 10 | **Analytics / search / ads** | Measurement loss, not migration failure; Site Kit 5M | First-party activity; no Google surfaces |
| 11 | **Multilingual / consent** | Narrower but compliance-critical; Polylang 900k, CookieYes 1M | Core i18n; no consent manager |

**Why this differs from install order:** WooCommerce (7M) outranks Yoast (10M) because a store cannot operate without commerce, while a publisher can migrate without Yoast's advanced features. The ranking measures **migration consequence**, not popularity.

---

## 7. What the WordPress lab actually proved

Source: `labs/wordpress/weekender/README.md`, `OBSERVATIONS.md`, `versions.json`, `stories.json`, `media.json` [R].

### 7.1 Proved (18 October 2026)

| Claim | Evidence |
|---|---|
| Genuine source | WordPress 7.1.3, PHP 8.3.35, MariaDB 11.4.8, WP-CLI 2.12.0, pinned official digests |
| Genuine export | Native `wp export` WXR, 35,838 bytes, SHA-256 `814140dd...f0dd` |
| Empty destination | Created through Composer's actual content-project recipe, zero entries/media/accounts before import |
| Destination versions | EmDash 1.2.0 (`b5f37c646`), Astro 7.3.5, Node 22, pnpm 12.9.1 |
| Import | 8 posts, 3 pages, 3 authors, 3 attachments, 2 threaded comments; WXR + official Exporter 1.2.0 retry |
| Owner workflow | Passkey sign-in (isolated virtual authenticator), edit, save revision, preview, publish, new story, media crop/replacement |
| Public cutover | WordPress/MariaDB/tunnel stopped; 7 original public paths 200, 4 non-public 404, no request to stopped source |
| Media | 3 attachments byte-identical SHA-256 from destination-owned storage |
| Responsive | 390×844, 1440×1000, 390×540 in both themes; no horizontal overflow |

### 7.2 Required manual repair (not automatic fidelity)

- Image alt/caption arrived blank in both WXR and exporter paths; reconciled manually in the Media Library.
- Category parent (`Walks` → `Field notes`) was flattened in both paths; restored manually.
- Comments and site identity required the Exporter 1.2.0 retry; the WXR path did not import comments or site settings.
- A future post remained **scheduled at the same UTC instant**, while current EmDash docs describe `future` → draft. Actual 1.2.0 behaviour and current documentation disagree; execution at the future clock is untested.
- A misplaced first demonstration edit was corrected with native rich-text selection, then published.

### 7.3 Not proved

| Gate | Status |
|---|---|
| Approx. 30-article / full publishing scenario | Unproven |
| Classic Editor, synced/dynamic blocks, shortcodes, page-builder markup | Unproven |
| Scheduling parity and future-clock execution | Unproven |
| Retry/cutover/restore, disaster recovery | Unproven |
| Hosted deployment | Unproven |
| Elementor, ACF, commerce, memberships, multilingual, consent | Untouched |
| SEO metadata, canonical, redirects, sitemap, rankings | Untouched; lab destination has no SEO handling |
| Comments without exporter; site settings via WXR | Unproven |
| Large media / 1 MiB cap / video | Unproven |
| EmDash 1.3.1 | Not re-run; lab used 1.2.0 |
| Physical passkey, real Access, production account | Unproven (virtual authenticator only) |
| Search indexing, Core Web Vitals, traffic | Unproven |

### 7.4 `docs/third-party` inspection

`docs/third-party/` contains only two licence texts: the MCP SDK transition notice (Apache-2.0 with legacy MIT contributions) and Zod's MIT licence. There is **no** WordPress plugin code, licence review or vendor security assessment there. Any claim that a WordPress plugin's licence or code has been reviewed by this repo would be unsupported.

### 7.5 Lab verdict

The lab is a credible **small publisher content-import** proof. It is not a plugin-replacement proof, not a disaster-recovery proof and not a commerce proof. Its most important negative findings are the manual metadata/hierarchy repairs and the scheduled-status divergence, because both would surprise an owner at cutover.

---

## 8. When staying on WordPress or hybrid is the better answer

### 8.1 Scenario A: physical-goods WooCommerce store (primary)

**Profile:** 200–2,000 SKUs, Australian GST, shipping zones, coupons, 3–10 staff, WooCommerce 7M-band, possibly subscriptions and a page builder.

**Why stay or hybrid:**

- Composer has no live checkout, merchant connection, provider webhook, refund, tax, shipping, inventory or fulfilment path. `docs/orders.md` says this explicitly; Orders are fictional fixtures [R].
- WooCommerce's job is an operating workflow, not content. A content import cannot move orders, customers, coupons, tax rates, shipping classes, payment tokens or subscription state.
- The public guide already says: "A payment button alone does not replace WooCommerce" and "A standard Shopify theme or a retained WooCommerce store can be the more proportionate choice" [R `src/pages/guide.astro`].
- Each order must have one checkout owner [R PRODUCT.md / orders contract]. Running Composer and WooCommerce checkouts against the same catalogue would create double-charge and reconciliation risk.

**Hybrid that is defensible today:**

- Keep WooCommerce as checkout and order system of record.
- Use Composer/EmDash for brand, content, launch pages, documentation or a separate editorial property.
- Preserve one canonical product URL set; point content CTAs to the WooCommerce checkout; do not duplicate product pages with competing canonicals.
- Keep WooCommerce backups and Composer D1/R2 recovery as separate, tested regimes.
- Revisit when #105 has a verified live checkout with tax, shipping, refunds, webhook reconciliation and a product/order migration path.

**What would change the answer:** verified Stripe/Shopify connector, verified tax/shipping calculation for the owner's jurisdiction, verified refund and fulfilment, and a reconciled product/customer/order migration. None exists today.

### 8.2 Scenario B: 500+ article publisher with Classic Editor and synced blocks

**Profile:** multi-author, hierarchical categories, 30+ scheduled posts, Classic Editor or synced patterns, ad or subscription revenue.

**Why stay for now:**

- The lab proved 11 entries and a handful of media, with manual alt/caption and category-parent repairs; the ~30-article/full scenario is explicitly unproven [R].
- Classic Editor, synced/dynamic blocks and shortcodes are unproven. Current docs say server-rendered/plugin blocks import as inert HTML comments; they show no content until rebuilt [D].
- The lab destination has no SEO handling; the generated local content-site recipe is noindex by default [R]. A publisher cannot risk ranking loss without a verified SEO/redirect/canonical plan.
- The scheduled-post behaviour diverged from documentation in the lab [R]. Scheduling parity is not established.

**Hybrid that is defensible today:** keep WordPress as the publishing system of record; use Composer for a new product site, documentation, campaign pages or a separate property that does not carry the legacy archive. Do not split a single archive across two canonical origins.

### 8.3 Decision rules for the public page

| Condition | Recommendation |
|---|---|
| Revenue depends on checkout, tax, shipping, subscriptions or order history | **Stay** (WooCommerce/Shopify) or **hybrid** |
| Large archive depends on Classic/synced blocks, page-builder layouts or precise scheduling | **Stay** until #167 proves the scenario |
| Content-first site, core fields/editor cover the jobs, SEO/redirect plan is explicit | **Migrate** with a rehearsed import and rollback |
| One missing function is proven and reusable across owners | **Build** it (only after #369 verification and a #366 test) |
| Owner needs managed commerce operations more than a custom CMS | **Shopify** remains a better proportionate choice than a custom storefront |

---

## 9. Genuine gaps and the #366 test

The issue is right to require a real missing function, not "PHP cannot run on Workers". The test below is deliberately falsifiable: if a registry package passes, there is no gap.

| Candidate function | Current destination | Why it is not automatically a gap | Falsification test before #366 | Owner if it fails |
|---|---|---|---|---|
| General form builder with entries, notifications, spam control and export | Guestbook `briefs/v1` enquiry + Inbox [R]; registry Contact Forms (2), Freeform, Forms [V] | Four published packages already claim the job; Guestbook proves one narrow form | After #369: install Freeform (or Contact Forms), build a 6-field form with conditional field, notification, CSV export and spam challenge; submit, store, export, fail-closed | #117, then #366 |
| Consent manager with category gating and records | Registry Cookie Consent (search listing); no core | A published package claims it; compliance wording is owner/legal, not code | Install, configure analytics category, verify nothing loads before consent, record choice, withdraw | #10, then #366 |
| Analytics/Search Console connector | Composer first-party counters [R]; registry Analytics/Umami [V] | Two packages claim analytics; Composer counters already answer "is the app used" | Install Umami or Analytics; verify real page views, referrers, no PII, consent gating | #360, then #366 |
| Advanced SEO schema/redirect import | `@moorage.dev/seo` [V] | Package explicitly claims Yoast alternative + redirect CSV import | Install, import a Yoast/Rank Math CSV with 20 redirects, verify 301/410 and no overwrite; check schema graph | #167, then #366 |
| Spam scoring for public comments/forms | Human moderation [R]; Freeform AI scoring candidate [V] | Freeform claims honeypot/CSRF/AI scoring | Submit known spam patterns, verify flagging, threshold control, no false-positive lockout | #10, then #366 |
| Backup/restore automation | EmDash D1/R2 procedure [D] | This is a platform operation, not a plugin; #8/#9 own it | Rehearse D1 Time Travel + R2 restore into an isolated environment, verify users/media/keys | #8/#9, **not #366** |
| Live commerce | #105; registry Stripe/DashCommerce/Commerce Beta [V] | Multiple packages claim parts; no verified tax/shipping/refund path | #105 live sandbox purchase, refund, webhook replay, tax/shipping calculation | #105, **not #366** |

**Verdict:** zero new #366 plugins are justified on this snapshot. The honest sequence is: #369 enables and verifies registry installs; #167 exercises the owner journeys; only then can a failed function be called missing. Creating a Composer-native form/SEO/commerce plugin now would duplicate published packages and violate the owner's "registry-first, advise don't port" direction.

---

## 10. Publishable comparison artefact outline for #168/#360

### 10.1 Page structure

1. **Title and promise:** "From WordPress plugins to EmDash" with a one-sentence scope and a "last checked 25 October 2026" badge.
2. **Choose your path:** four cards, Stay / Hybrid / Migrate / Build, each with a one-line condition and a link to the decision rules.
3. **Searchable matrix:** filter by category, status, install band and destination type; default sort by **migration priority**, with a toggle to sort by **WordPress install band**.
4. **Per-plugin detail:** job, what to export, destination, status, package identity, permissions, cost, verified date/receipt, gaps, next action.
5. **Category guides:** one short section per category, linking the matrix rows.
6. **"What we actually verified":** dated receipts, versions, what was not tested, links to #11/#167.
7. **Caveats and corrections:** the band/ranking caveats, premium-plugin exclusion, registry candidate status, no savings/security/SEO parity.
8. **Feedback:** "report a wrong or stale entry" route; no automatic publishing.

### 10.2 Table columns

Keep two rankings visually separate, as #363 requires.

**Market columns**

| Column | Content | Caveat |
|---|---|---|
| WordPress plugin | Name + slug | Link to wp.org page |
| Category | Assigned category | Not a wp.org canonical taxonomy |
| Active-install band | e.g. `10+ million` | Rounded band, measured date |
| Market position | Official Popular browse position | Tie-break is official but undocumented |
| Measured on | Date | Show stale after 90 days |

**Job and migration columns**

| Column | Content |
|---|---|
| Owner job | One sentence, not a feature list |
| Must export / preserve | Posts, meta, forms, orders, redirects, media, users |
| Destination | EmDash core / registry package / Cloudflare service / external / custom app |
| Destination status | core / existing candidate / verified / partial / missing / incompatible / unnecessary |
| Verified on pinned stack | Yes/no + date + receipt link |
| Migration recipe | 3–6 steps, with manual-repair warnings |
| Known gaps | What the owner loses or must rebuild |
| Next action | Stay / hybrid / migrate / build / wait |
| Owner issue | #105, #117, #369, etc. |

**Trust columns**

| Column | Content |
|---|---|
| Package identity | Publisher DID, handle, slug, exact version |
| Licence and source | Displayed licence + source link |
| Declared access | Capability labels, network hosts/unrestricted flag |
| Cost and entitlement | Free/paid plugin, external API, Workers Paid, transaction fees |
| Maintenance | Last update, tested-to, release age |
| Trust evidence | #365 rating/health link, not a self-claim |

### 10.3 Honest caveats to publish verbatim

- Active-install bands are WordPress.org's rounded figures. They are not revenue, sites, traffic or market share.
- The Popular browse order is official, but its within-band tie-break is undocumented. On 25 October 2026 Site Kit and Wordfence tied at the 5M band; Site Kit held position 7 and Wordfence position 11.
- Premium-only plugins (Gravity Forms, ACF Pro, WP Rocket, Elementor Pro, MemberPress, FluentCRM) are not in the WordPress.org directory and are therefore absent from the measured baseline. Their demand is not measured here.
- A registry listing proves only that a package was published. It does not prove it installs, works with Composer's EmDash 1.3.1/Astro 7.4.2, is secure, is maintained, or is suitable for a specific site.
- Composer cannot install registry packages today (#369). Every such row must say "candidate, not installed".
- Declared permissions are capability requests, not a security audit. "Unrestricted network" means any host.
- EmDash docs describe current behaviour; the only WordPress import receipt is on EmDash 1.2.0, not the pinned 1.3.1.
- The small publisher lab is not proof of a large archive, Classic Editor, synced blocks, Elementor, ACF, commerce, SEO preservation or disaster recovery.
- No cost saving, security parity, SEO parity or "fully managed" claim is supported.
- Plugin data changes. Show the check date and a stale threshold; do not silently reuse an old row.

### 10.4 Refresh and ownership

- Refresh cadence: monthly for versions/bands; quarterly for the full matrix; immediate on a registry release or WordPress security release that affects a named plugin.
- Each row names an owner issue and a reviewer. #11 holds date/source/receipt. #365 holds package health/ratings. #366 holds only confirmed missing functions.
- The page must not auto-publish a plugin recommendation from registry metadata alone.

---

## 11. Unknowns and next evidence

1. **Registry compatibility:** does any listed package declare an EmDash/Astro range compatible with 1.3.1/7.4.2? The listing did not show it; the discovery client's `requires` check was not run.
2. **Registry install:** can #369 wire `sandbox()` + `LOADER` on the current account/plan, and does an install/update/rollback work with the pinned runtime?
3. **Forms:** which of the four form packages stores submissions where, and can it export them without a paid tier?
4. **SEO:** does the SEO plugin's redirect CSV import handle Yoast/Rank Math exports without overwriting existing rules, and does its schema graph render in Composer's theme?
5. **Commerce:** does any package provide a live, refundable, tax/shipping-correct checkout for an Australian store, or only a Stripe button?
6. **Backup:** can D1 Time Travel + R2 restore a Composer site into an isolated environment with users, media, revocations and deletions intact? #8/#9.
7. **Scale:** page cache, image transforms, 1 MiB upload cap and large-archive import under load. #361/#167.
8. **Editorial parity:** Classic Editor, synced/dynamic blocks, shortcodes, scheduling at future clock. #167.
9. **Multilingual/consent:** no verified Composer journey for either.
10. **Trust:** #365 must rate maintenance, permissions and publisher history; this report only records what the listing displayed.

---

## Appendix A: Retrieval log

| Time (UTC, 2026-10-25) | Source | What was read |
|---|---|---|
| 06:00:44 | WordPress.org Plugin API 1.2 | `wordpress-seo` first request; endpoint confirmed |
| 06:01–06:03 | WordPress.org Plugin API 1.2 | Ten named plugins + Site Kit, full records |
| 06:03–06:04 | WordPress.org Popular API | `browse=popular`, 100 records, `info.results=72509` |
| 06:04–06:05 | `wordpress.org/plugins/browse/popular/` | Rendered order; confirmed first 11 |
| 06:05–06:06 | EmDash registry search + 16 package pages | Versions, licences, sources, permissions, DIDs |
| 06:06–06:10 | EmDash docs | Installing, registry client, SEO, fields, backups, email, route caching, WordPress migration |
| 06:10–06:11 | WordPress.org plugin pages | Rendered bands/versions for 25 plugins |
| 06:11–06:12 | EmDash registry blog + search pages | Sandbox-only rule, free-for-now, Workers Paid |
| 06:12 | Repository | `package.json`, `astro.config.mjs`, `wrangler.jsonc`, `src/`, `docs/`, `labs/wordpress/` |

Raw records: `363-wordpress-plugin-intel.data.json` (same directory).

## Appendix B: Repository evidence index

| Path | Used for |
|---|---|
| `package.json` | EmDash 1.3.1, Astro 7.4.2, Wrangler 4.152.0 |
| `astro.config.mjs` | Native plugins, no `sandboxRunner`, `imageService: passthrough`, 1 MiB upload |
| `wrangler.jsonc` | D1/R2/KV/services/rate limit/cron, no `worker_loaders`, Access vars |
| `src/worker.ts` | `PluginBridge` exported |
| `src/middleware.ts` | Global `Cache-Control: no-store` |
| `src/layouts/Base.astro` | Hand-rendered metadata, canonical, OG |
| `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts` | Custom sitemap/robots |
| `src/plugins/resend.ts` | Native email transport capability |
| `docs/orders.md`, `src/lib/order-contract.ts` | Fictional commerce only |
| `docs/private-enquiries.md`, `src/enquiries/` | Fixed enquiry form and Inbox |
| `docs/analytics-events.md` | First-party counters |
| `docs/platform/integrations.md` | Platform integration contracts |
| `docs/guide.astro` | Public commerce/email/recovery positions |
| `labs/wordpress/weekender/README.md` | Lab scope and commands |
| `labs/wordpress/weekender/OBSERVATIONS.md` | Proved/unproved migration claims |
| `labs/wordpress/weekender/versions.json` | Exact source/destination versions |
| `lib/content-model/site-template/` | Generated site is noindex by default |
| `docs/third-party/` | MCP SDK/Zod licences only |
| `extension/README.md` | MV3 browser overlay, not an EmDash plugin |

## Appendix C: Status vocabulary used in the public artefact

| Status | Meaning |
|---|---|
| **core** | EmDash core supplies the job at the level a typical owner needs |
| **verified** | Exercised on the pinned stack with a dated receipt |
| **existing candidate** | Package exists in the registry, not installed/verified in Composer |
| **partial** | Some of the job works; material gaps remain |
| **missing** | No working path today |
| **incompatible** | The artefact cannot be reused (e.g. Elementor JSON) |
| **unnecessary** | WordPress-only machinery replaced by the platform; no replacement plugin needed |

---

*Prepared by research worker R1 for #363. This document is evidence for review, not a product claim, security certification or migration guarantee. It should be refreshed before publication and linked to #11 receipts.*
