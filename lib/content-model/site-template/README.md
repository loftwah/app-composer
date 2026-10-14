# Your EmDash content site

Created by App Composer’s reviewed content-project recipe, 14 October 2026. This is independent application source under MIT. It uses Astro 7.3.5, EmDash 1.2.0, Tailwind 4.3.3 and the Cloudflare adapter. Get Ready and Woodhouse are not runtime dependencies.

Your field model is `src/content-model.json`; its native EmDash schema is `seed/seed.json`. `src/pages/index.astro` reads at most 20 published entries. Draft/private entries are not requested. Optional display conditions affect this page; native EmDash editing does not hide conditional fields. Invalid HTTPS links are rendered as text. Repeating rows are escaped text, not rich HTML.

## Run locally

An authorised agent checks the project’s current instructions, Node22, pnpm12.9.1 and package/lockfile first, then installs the frozen dependencies with lifecycle scripts disabled:

```
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Open the local URL printed by Astro. The dev server binds to localhost. Use the printed localhost URL for passkeys; a numeric IP such as 127.0.0.1 can fail WebAuthn registration. D1 and R2 are simulated in this project’s ignored `.wrangler` directory. No real account, cloud resource or customer data is used. Native EmDash applies its migrations and the model schema on first request. Use `/_emdash/admin` for the initial owner setup and content editing; complete required passkey interaction yourself. Create entries as drafts, then explicitly publish those intended for public reading. An empty page is expected before publication. The kit includes no sample content or user account.

`pnpm build` compiles the Cloudflare Worker. It does not deploy or prove account ownership. The supplied `pnpm deploy` refuses execution: the all-zero D1 ID and local resource names are placeholders, not an authorised destination.

## Before any cloud deployment

Use Get Ready for the actual selected project and account. Review source ownership, the intended domain, app-owned D1/R2, admin protection, privacy, backup/restore and cost before preparing its real deployment configuration. Do not reuse App Composer’s account, domains, storage, credentials or admin policy. A Worker’s code rollback does not restore data. No schema replacement or automatic migration of an existing site is supported by this new-project recipe.

Replace local placeholders only through the project’s reviewed release path. Public search indexing stays disabled until a real canonical origin and public metadata are configured. This kit supplies native authenticated editing and a published-content page. It does not implement public submission forms, enquiry delivery, payment, commerce, media widgets or customer deployment automation. Those need their own reviewed application behaviour.

## Maintain your source

Commit the generated files and lockfile to your own repository after review. `composer-project.json` records generated file hashes and captured template hashes; neither hashes nor a successful build certify agent discovery, security or deployment. Re-run creation only into a new absent directory; this recipe never updates existing files. Keep current edits and data separate from upstream updates. Test changed user journeys and build before deployment.

Official guidance: https://docs.emdashcms.com/agent-skills/ and https://docs.emdashcms.com/deployment/cloudflare/ . Font: Space Grotesk, SIL OFL; the notice is in `public/brand/OFL-Space-Grotesk.txt`.
