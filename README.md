# App Composer

An agent-operated platform for a verified development environment and genuinely composed independent applications. Target: https://composer.loftwah.com. MP directs; agents implement, verify and recover. Reviewed 13 October 2026. MIT.

## Supported implementation

Astro 7.3.5, EmDash 1.0.1, Cloudflare adapter 14.3.3, Wrangler 4.143.1. The lockfile pins the tested Cloudflare Vite integration and Workers runtime. EmDash manages the published catalogue through isolated D1/R2. It is a real query-backed CMS boundary; customer mini-apps are independent Workers, not forced into CMS plugins.

- [Photo Guestbook](https://github.com/loftwah/app-composer-guestbook), standalone at https://guestbook.loftwah.com.
- [Curated Showcase](https://github.com/loftwah/app-composer-showcase), standalone at https://showcase.loftwah.com.
- [Hello World reference](https://github.com/loftwah/app-composer-hello), https://ready.loftwah.com.
- [Fictional Portable AI State](https://github.com/loftwah/app-composer-state), https://ai.loftwah.com. Synthetic-only pending full security gates.

The first pair mounts through declared, separately pinned integrated Worker services. `pnpm compose:promote` compiles the exact reviewed pins, deploys those services and leaves standalone upstream version changes outside the composition code. Approved items become featured cards through a generic provider API. Current privacy is resolved on every public request. Code rollback does not restore old data or permissions.

## Local operation

`pnpm install`, `pnpm dev`, `pnpm check`, `pnpm build`. Local EmDash D1 state is disposable and separate from production. To demonstrate seeded catalogue content locally, use the documented EmDash seed/migration tools against the local database; remote content is never silently copied into local or preview state.

`pnpm ready` verifies the actual authorised Codex/GitHub/Cloudflare workspace and exact custom-domain Hello World identity, saving a private expiring receipt. It does not inspect another user's environment or obtain credentials on their behalf.

`pnpm compose` fetches and validates known public app manifests at exact commits, verifies their actual deployed identities and stages an inspectable cached candidate. Arbitrary catalogue repositories are never executed. `pnpm compose --spec path/to/spec.json --apply` additionally validates the portable spec and applies authorised configuration using private owner credential files in the adjacent independent app checkouts; purchases and unverified targets are blocked. This operator path is deliberately narrow, not public multi-tenant provisioning.

Production uses `pnpm deploy`: clean pushed main, type/risk checks, production build, Wrangler and exact live-host source verification. There are no GitHub Actions. Preview is a separate named environment with separate D1/R2 and no production app service bindings; missing app services fail explicitly rather than sharing production data.

## Secrets and human gates

`OWNER_API_TOKEN` and `EMDASH_ENCRYPTION_KEY` are runtime secrets, generated in private operator storage and passed to Wrangler over stdin. They never enter specs, source or browser output. EmDash admin/API paths are closed until Cloudflare Access is configured and its JWT issuer/audience can be verified. MP performs the native EmDash account/passkey setup only after that protection is in place. Current token lacks Access-management permissions; do not make admin public to work around that gate.

The optional unpacked Chrome extension has explicit-click activeTab injection, Get Ready/Init handoffs and local decision exploration. No Cloudflare dashboard credential scraping, native-product/partnership claim or public build API. Installed dashboard acceptance and Web Store publishing are distinct.

## Boundaries and evidence

Read `ARCHITECTURE.md`, `composition.lock.json`, `docs/STATUS.md` and GitHub #11. Public browsing and configuration drafts need no account. Upload/moderation/curation require invited owner access. Demo artwork and vault personas are original/synthetic, never real private records. Current manifest support is the authored first pair; wider registrars/providers, automated update policies, arbitrary builds and real-data vault import are not advertised as shipped.

Official integration references reviewed 13 October 2026: [EmDash Cloudflare](https://docs.emdashcms.com/deployment/cloudflare/), [content queries](https://docs.emdashcms.com/guides/querying-content/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [Worker rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/). Runtime/public evidence must be checked independently of source or tests.

## Assets

Original editable geometric mark, routing graphic and mini-app covers are in `public/brand/`. PNG exports are generated from their SVG masters. Space Grotesk is SIL OFL, originally by Florian Karsten; the licence is retained with the font. No Koji assets or proprietary source is used. Real screenshots belong to release evidence, never fabricated UI illustrations.
