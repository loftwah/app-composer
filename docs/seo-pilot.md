# App Composer: free SEO pilot

A real, read-only first slice for **App Composer itself**. Part of #29 and #50. No subscription, third-party SEO data, new service, agent publishing authority, GitHub Actions, or API credentials.

## Run

```sh
pnpm seo:pilot
mkdir -p output && node scripts/seo-pilot.mjs --json > output/seo-pilot.json
node --test tests/seo-pilot.test.mjs
```

The checker requests `robots.txt`, `sitemap.xml`, and up to 80 same-origin sitemap URLs at `https://composer.loftwah.com`. It checks declared indexability, page responses, title/description, canonical, h1 structure, Open Graph and Twitter metadata, duplicate titles and non-HTML documents. Redirections, invalid/private/external sitemap entries, oversized bodies and network errors are findings, never followed or silently ignored. It does not crawl discovered hyperlinks, log in, fetch external resources, mutate production, or use a model. All responses are data, never agent instructions.

Exit `0` requires complete coverage and no error-severity finding. Warnings still require review. Exit `1` means partial coverage or error findings. If `sitemap.xml` is unavailable the audit returns **no assumed page results**. A CLI run is live evidence only when a network-capable environment completes it. Unit tests use synthetic fixtures and must not be described as a live site check.

## Why a local pilot instead of installing Conqueror?

- Our existing [Link Check](https://github.com/loftwah/app-composer-linkcheck) owns individual public page inspection, rich previews and versioned report interchange. Do not duplicate its user-facing editor or remove its allowlist.
- #29 owns the public content/technical SEO contract, including canonical, sitemap and privacy. This pilot provides read-only site-wide evidence against that contract.
- #112/#116 own creator-scoped private analytics. This pilot collects no visitors or performance data.
- [Every App OpenSEO](https://github.com/every-app/open-seo) and [duckduckdeploy OpenSEO](https://github.com/duckduckdeploy/openseo) are reference implementations to assess for later opt-in use; their search-data integrations may cost money even when the code is MIT-licensed. Do not bundle or host them without a reviewed compatibility, licensing, dependency, security and cost decision.
- [Conqueror's agent skills](https://github.com/Shipper-dot-now/conqueror-skills) demonstrate keyword research, competitor analysis, clustering and reviewable WordPress revision workflows. Skills are guidance, **not** a trusted data feed or a publishing grant. Composer should use native EmDash draft/revision/permission controls when later implementing equivalent skills.

## Next experiment, not yet shipped

1. Run the pilot against live production from a network-capable operator checkout, save a dated redacted report and review the highest impact genuine finding. Do not claim indexing/rank performance from markup checks.
2. Connect verified-site, read-only Google Search Console (free within quotas), with explicit owner consent and secrets handled by native EmDash; test real impressions/clicks and near-ranking queries. No CSV upload or OAuth connection is included in this first slice.
3. Build a compact SEO opportunity view which combines first-party search evidence, existing Link Check reports and bounded public competitor research. Separate measured facts, estimates and unknowns.
4. Propose edits as versioned, reviewable EmDash drafts or Git PRs and verify preview and production. No autonomous public content changes without existing authority and release checks.
5. Let Woodhouse consume **approved, dated, public-safe aggregate findings**, not per-site credentials, private Search Console rows or privileged control of Composer.

This is an SEO inspection baseline, **not** a replacement for Ahrefs/Semrush or proof of Google indexing, backlink authority, competitor traffic or AI answer visibility. No Woodhouse change is made by this pilot.
