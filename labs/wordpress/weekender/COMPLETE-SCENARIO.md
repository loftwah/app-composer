# Complete Weekender publisher scenario

This extends the accepted small replay without changing its fixture or transferring its acceptance. The implementation starts from Composer `7bc0aadea9befda369f8f771df10254615468a25`. Issues [165](https://github.com/loftwah/app-composer/issues/165), [166](https://github.com/loftwah/app-composer/issues/166), [167](https://github.com/loftwah/app-composer/issues/167) and [168](https://github.com/loftwah/app-composer/issues/168) own the larger programme. This document is an execution plan, not a completed migration receipt.

## Source and access stories

Use the existing digest-pinned official WordPress 7.1.3/PHP 8.3, WP-CLI 2.12.0 and MariaDB 11.4.8 source. The destination is an empty independent Composer recipe project with EmDash 1.2.0, Astro 7.3.5, Wrangler 4.143.1, Node 22 and pnpm 12.9.1. Record the actual installed patch versions and source hashes in each run. Imported content and recipes are data, never execution authority.

The complete source contains 30 articles, eight pages and three fictional authors. Twenty-four articles begin public; two are drafts, one private, one pending and two scheduled. All have complete editorial bodies. The original far-future article checks visibility preservation; a separate near-term article exercises actual scheduled execution after its imported Australia/Melbourne time and UTC instant have been reconciled. The corpus includes hierarchical categories and pages, tags, featured photographs, captions/alt, a real gallery, a downloadable guide, threaded comments, two synced blocks used by multiple articles, a dynamic latest-posts block and actual header/footer template parts. The existing two licensed theme photographs are reused deliberately; their original attribution remains recorded.

Run distinct source-access stories rather than treating one as evidence for another:

1. Export-only: WordPress produces WXR; the destination can fetch the original attachments through the existing temporary HTTPS transport. Import through the native authenticated EmDash interface into a new empty target.
2. Plugin-capable: install the exact official EmDash Exporter 1.2.0 ZIP already pinned in `versions.json`, then import from the real WordPress API into another empty target. Retry against an existing target is a separate test.
3. Backup-only: take a real database plus uploads/theme/plugin/config backup, stop the original source, restore into a fresh registered local WordPress installation, verify it and export from that engine. A WXR file alone is not this backup.

A separate source variant uses an actual conventional PHP theme and the official Classic Editor plugin. Pin the reviewed plugin ZIP and hash before acquisition. Its compatibility with WordPress 7.1.3 must be observed; the current official plugin listing's tested-up-to value does not establish it. Preserve the same complete story bodies and verify real Classic editing/export. Do not imply that Classic Editor operates the block theme's Site Editor.

## Import and public mapping

Reconcile every source object and field, including IDs, statuses, UTC/local dates, bylines, hierarchy, tags, excerpt/body, featured media, gallery order, attachment bytes/metadata, comments and menus. Keep a per-object source-to-target map and explicit manual repairs. The existing 1.2.0 alt/caption and category-parent gaps remain open until observed and repaired in the native owner UI or corrected in maintained importer source; never seed target records to conceal them.

Inspect the actual installed converter before changing it. Synced `wp_block` content should become editable native sections and its references must resolve. Server-rendered latest-posts has no saved rendered content in WXR; rebuild that function with native published queries and record this adaptation. Header/footer design is rebuilt in the existing paper/forest/clay magazine language, not claimed as automatic WordPress theme transfer. Native section edits must affect both referencing articles.

Extend the reader with real bounded pagination, taxonomy archives, ordinary menus and canonical metadata. The URL matrix covers dated articles, nested pages, slug routes, categories/tags, archive pages, exact `?p=`/`?page_id=` redirects, trailing-slash variants, attachments, declared retired paths and the old HTTP origin's destination disposition. Redirect only to known local paths and recheck publication visibility; unknown or unpublished addresses remain 404. No source-host canonical or redirect loops. Public article/image requests must keep working with the source off and fresh caches.

## Native publishing and failure journeys

Through the ordinary native owner UI: edit an imported story, save without changing its live revision, preview, publish, upload and replace an owned image, create a new article, publish it and find it in the archive/search. Exercise a real due scheduler after verifying the source/destination timezone and UTC instant; manual publication or a mocked clock is not scheduler acceptance.

Keep meaningful failed attempts: unavailable attachment, interrupted copy, expired exporter credential, incompatible field mapping, repeated import, changed source slug and a late source edit. Match the actual importer's collection/slug/locale identity rules. Do not silently delete duplicate records after a changed-slug retry. Declare a source freeze, reconcile a late change and retain its source-ID/route decision.

Recovery has separate executable and data gates. Test a compatible code update and rollback without replacing the data. Separately restore a consistent database/media backup into a new isolated destination, preserve the original destination and post-backup writes, and explicitly export/reconcile that delta. Rehearse local cutover/reversal without claiming a hosted DNS cutover. Any owned hosted target and actual provider restore/deployment remains root's separately verified release work.

## Evidence and cleanup

Use one owned temporary root per run and the existing registered cleanup controller. No owner checkout, protected video project, browser session, unrelated Docker resource or Protocol 11 image is part of this lab. Save only useful bounded artifacts under ignored `output/`; private backup/key material stays private and is excluded from public evidence. Do not retain an entire temporary project as a receipt.

Record exact versions/source digests, source WXR hash, object/URL/media mapping, actual failures and manual steps, local and UTC timestamps, useful before/after desktop/phone captures and fresh-cache source-off network observations. Capture traceable raw native/public task segments with a redacted action/timestamp manifest. Keep credential/key setup out of frames and exported traces; explain that setup plainly. Root produces the captioned overview and walkthrough from those real segments. Local interaction does not prove physical passkeys, hosted recovery, customer adoption or full programme completion.

The final local batch checks Chromium and WebKit, desktop/phone/short viewport, both themes, public visibility, decoded owned media and the actual Apps → external destination → Back journey with work preserved. Restart the persisted destination once, repeat the source-off core journey, then close only registered consumers and remove the exact run. Report retained recovery artifacts separately from removed temporary runtime files.

Elementor, ACF, commerce, fresh customer bootstrap and provider interoperability remain unmet until this complete publisher scenario passes its own gates. No paid commitment, new customer permission or remote production write is authorized by this plan.
