# Your EmDash content site

Created by App Composer’s reviewed content-project recipe, 18 October 2026. This is independent application source under MIT. It uses Astro 7.3.5, EmDash 1.5.0, the exact matching `@emdash-cms/cloudflare` 1.5.0 adapter, `@cloudflare/kumo` 2.15.0 and Tailwind 4.3.3. Get Ready and Woodhouse are not runtime dependencies.

Reviewed against the official [EmDash 1.5 release](https://emdashcms.com/blog/emdash-1-5) on 17 November 2026. The adapter pins its matching `emdash` and Kumo versions exactly; the three paired pins and their lockfile move together. No other direct dependency was upgraded. A fresh project runs migrations 092–097 in the default `auto` mode on first request: this recipe has no sandboxed plugins with KV data and no plugin storage `uniqueIndexes`, so the planned maintenance windows for migrations 092 and 095 do not apply. Existing installed sites are never migrated by this new-project recipe; a real deployment retains its own backup, migration and verification path.

Your field model is `src/content-model.json`; its native EmDash schema is `seed/seed.json`. `src/pages/index.astro` reads 20 published entries per page. Native Previous page / Next page links appear above and below longer collections, so older entries stay reachable without JavaScript. Page addresses can be bookmarked; invalid or duplicate page values are refused, and an empty later page returns 404 with a route back to the first page. The bounded page number supports up to 99,999 pages. Publication changes between requests can shift offset pages; each request still reads only currently published entries. Draft/private entries are not requested. Optional display conditions affect this page; native EmDash editing does not hide conditional fields. Invalid HTTPS links are rendered as text. Repeating rows are escaped text, not rich HTML.

## Run locally

An authorised agent checks the project’s current instructions, Node22, pnpm12.9.1 and package/lockfile first, then installs the frozen dependencies with lifecycle scripts disabled:

```
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm build
pnpm dev
```

Open the local URL printed by Astro. The dev server binds to localhost. Use the printed localhost URL for passkeys; a numeric IP such as 127.0.0.1 can fail WebAuthn registration. D1 and R2 are simulated in this project’s ignored `.wrangler` directory. No real account, cloud resource or customer data is used. Native EmDash applies its migrations and the model schema on first request. Use `/_emdash/admin` for the initial owner setup and content editing; complete required passkey interaction yourself. Create entries as drafts, then explicitly publish those intended for public reading. An empty page is expected before publication. The kit includes no sample content or user account.

### Set up the owner and publish one entry

1. Open the exact `http://localhost:PORT/_emdash/admin` address printed by your agent. Enter a site title and optional tagline, leave the empty-site option selected, then choose **Continue**.
2. Enter your owner email and name, then choose **Continue**. Choose **Create passkey** and finish your browser’s credential-manager prompt. The agent cannot supply your fingerprint, PIN or consent. This local passkey is bound to localhost; it is not a production sign-in credential.
3. Wait for **Passkey created**, then choose **Open the dashboard**. If EmDash shows its login page, choose **Sign in with Passkey** and use the passkey you just created. Dismiss the first-run welcome with **Get Started**.
4. On the dashboard, choose the shortcut bearing your collection’s name. Fill its required fields and choose **Save**. This creates a draft. Open the local public homepage in another tab: the draft should be absent.
5. Return to the editor and choose **Publish now**, then confirm **Publish now** in its dialog. Refresh the public page: the entry should now appear with its supported fields and repeating rows.
6. To revise a live entry, edit its fields and choose **Save**. Visitors keep seeing the old published version. Choose **Publish changes** and confirm only when the revision is ready.

Custom top-level short/long-text length limits and whole-number ranges are compiled into the native schema. The same rules validate the model’s starting values and the Composer preview. Native editing enforces those limits on new or changed entries; this recipe does not rewrite existing stored content. Repeating-row custom limits are refused because the pinned native row validator does not apply them.

Calendar dates are days, not instants. Their value is YYYY-MM-DD (years 0001–9999); no timezone conversion or date rollover is applied. The bundled native date picker clears an optional day to null, while the native string schema rejects impossible days, including invalid leap days. The public reader uses a semantic time element with a written month. A standalone portable seed keeps the same native calendar validation but uses its host’s string editor; it does not depend on this widget. Date fields inside repeating rows are refused. No existing data is converted or backfilled.

Starting values supplied by the model fill new entries in the native editor. Review them before saving. An explicit cleared field, No or zero is not replaced by its default; required fields still need a valid value. Defaults do not backfill existing content. Repeating rows have no defaults in this recipe.

The original pinned EmDash 1.2.0 editor sent a cleared optional URL as an empty string, which its URL validator rejects ([upstream #4075](https://github.com/emdash-cms/emdash/issues/4075), fixed upstream in [#4076](https://github.com/emdash-cms/emdash/pull/4076)). This source includes a small trusted native before-save compatibility hook for this model’s top-level optional links and repeating-row links: only submitted empty strings become null. Other fields, missing values, required links, authentication, native validation, revisions and explicit publication stay under EmDash. There is no route, stored-data scan, backfill or external call. It is bundled with the site’s reviewed code rather than installed from a plugin registry.

Rechecked on 17 November 2026: the 1.5 release includes both the optional-URL fix (#4076, merged 12 October 2026) and the repeater-row empty-value fix (#4479). The hook is retained as harmless normalisation and its unit tests still pass; it is not claimed to be a required 1.5 workaround. Remove it only after a real editor's clear-and-save journey has been re-run against 1.5, which needs the site owner's passkey session.

Public styling is scoped to the collection page so it cannot override the native EmDash editor.

The original pinned editor also converted an empty number control to `0`. The bundled native React integer widget keeps an explicit zero as zero and saves a cleared optional number as null. It uses the same pinned Kumo controls as EmDash, retains required/range attributes, and leaves server validation and publication to EmDash. Only this generated site's seed selects the bundled widget. A separately downloaded portable seed has no plugin dependency and uses the host editor, including its current empty-number limitation. Rechecked on 17 November 2026 with Kumo 2.15.0 and EmDash 1.5.0: strict browser/Worker type checks, the site tests and the generated build pass with the widget unchanged. Real-editor clear and zero-entry interaction still needs the owner's passkey session, so the widget stays for new projects; no existing site is silently updated.

If passkey creation is cancelled, remain on the setup screen and try again through the browser. Seeing **Passkey created** is a successful registration, not an instruction to create another credential. Keep the same localhost hostname; changing to a numeric IP changes the passkey context. A credential created for local testing does not establish production account recovery. Configure and verify the chosen production authentication/recovery separately before accepting valuable content.

`pnpm build` compiles the Cloudflare Worker. It does not deploy or prove account ownership. The supplied `pnpm deploy` refuses execution: the all-zero D1 ID and local resource names are placeholders, not an authorised destination.

## Before any cloud deployment

Use Get Ready for the actual selected project and account. Review source ownership, the intended domain, app-owned D1/R2, admin protection, privacy, backup/restore and cost before preparing its real deployment configuration. Do not reuse App Composer’s account, domains, storage, credentials or admin policy. A Worker’s code rollback does not restore data. No schema replacement or automatic migration of an existing site is supported by this new-project recipe.

Replace local placeholders only through the project’s reviewed release path. Public search indexing stays disabled until a real canonical origin and public metadata are configured. EmDash 1.5 adds a staging site status whose `noindex, nofollow` tag is emitted by pages that render `<EmDashHead>` and can be lifted with **Go live**. This template keeps its own `noindex,nofollow` guard and deliberately does not render `<EmDashHead>`, which emits no tag at all when EmDash has no request runtime — that would leave a fresh or uninitialised preview indexable. The guard is lifted only when all of these are true: EmDash settings are readable, the site has explicitly gone live (`staging === false`), a canonical HTTPS **Site URL** is configured in Settings → General, and the request is actually on that configured origin. Fresh or uninitialised sites, missing or non-HTTPS site URLs, requests on other hosts, failed settings reads, and native preview or edit-mode requests all stay noindex. The real OG/icon metadata and the published-only content queries are unchanged. A fresh 1.5 new site still starts in staging in the admin. This kit supplies native authenticated editing and a published-content page. It does not implement public submission forms, enquiry delivery, payment, commerce, media widgets or customer deployment automation. Those need their own reviewed application behaviour.

## WordPress file conversion

EmDash 1.5 adds `emdash import wordpress FILE`, a local, file-only WXR conversion: `--prepare` writes a migration config and suggested schema, then `--execute` writes one JSON entry per post into an output directory. A rehearsal on a small fictional WXR with two authors, a draft, a published post and a password-protected post produced draft status for the protected entry, kept the draft as a draft, preserved each author and source date, wrote no media when `--skip-media` was set, and touched no site or database. Menu items were not part of that file output; WXR menus and bylines are converted by the authenticated admin importer, not by this file command. Rehearse against your own export in an isolated directory, review the converted files, and keep existing content and the WordPress origin intact. This is conversion evidence, not an import into a site.

## Maintain your source

Commit the generated files and lockfile to your own repository after review. `composer-project.json` records generated file hashes and captured template hashes; neither hashes nor a successful build certify agent discovery, security or deployment. Re-run creation only into a new absent directory; this recipe never updates existing files. Keep current edits and data separate from upstream updates. Test changed user journeys and build before deployment.

Official guidance: https://docs.emdashcms.com/agent-skills/ and https://docs.emdashcms.com/deployment/cloudflare/ . Font: Space Grotesk, SIL OFL; the notice is in `public/brand/OFL-Space-Grotesk.txt`.


## Individual entry pages

Each entry title in the collection links to `/entries/CONTENT_ID`, using the native stable content ID rather than an editable title or slug. Renaming a title keeps that address. The detail page repeats the same visible model fields, groups, date formatting and escaped values as the collection, with one first-level title and a keyboard-accessible route back. It works without JavaScript. Native D1 queries are restricted to the selected collection, explicit published status and the exact bounded ID. Missing, unpublished or removed entries return 404; a database failure returns 503. Detail responses are not cached. The native authenticated preview/edit context is owned by EmDash and is not a public permission grant; public acceptance here uses ordinary unauthenticated requests.

Individual titles and short descriptions supply page and Open Graph metadata. These local pages stay noindex/nofollow; no canonical origin, share artwork, indexing approval or production deployment is invented. Review those separately for the actual public site. The source recipe creates new projects only and never adds routes to an existing owner project automatically.


## Filter a collection

The first top-level select field without a display condition becomes the public filter: a workshop format, project stage or directory category. Conditional and repeating-row selects stay out of the filter. With no eligible choice field, the page keeps its ordinary collection layout. This adds no public editing or submission endpoint.

Choose a value and select **Filter entries**. The native GET form starts at the first matching page; pagination retains the choice, and **Clear filter** returns to the full collection. Filtered addresses can be shared or bookmarked. This works without JavaScript. No matching published entries is an ordinary empty result, with a way back to all entries; an unavailable later page retains a route to the first matching page. Invalid/duplicate filter or page values return 400 before any collection query. Only an exact declared choice can become a native field-equality query; URL input cannot select field names, operators, status or draft access. Entry detail pages keep their stable addresses.

Only this new project's generated seed marks the selected filter field as indexed. The portable seed stays unchanged; no existing project's schema or data is migrated. Indexing supports the native field-equality query and is not an assertion of a measured performance improvement. Reviewed 15 October 2026 against the official [content query guide](https://docs.emdashcms.com/guides/querying-content/) and pinned EmDash 1.5.0 (rechecked 17 November 2026).

## Quality and maintained source

Use Node 22 and the declared pnpm 12.9.1. The complete local workflow is:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm build
pnpm dev
```

`check:types` verifies strict application source/output parity, Astro props and
source, the Worker environment and the browser/React environment separately.
`lint` checks unused application locals/parameters. `format:check` uses pinned
Prettier with its Astro plugin. `test` exercises entry-address, field-value,
calendar and public-query boundaries. `check` aggregates these gates. `build`
checks types before compiling; `deploy` keeps the existing placeholder refusal.

Edit the `.mts` application sources and run `pnpm source:write` to regenerate
readable `.mjs` and `.d.mts` together. Commit both reviewed source and output.
Normal checks refuse stale output. Node build/test/deploy tools stay JavaScript;
generated JS/declarations follow compiler formatting rather than the formatter.
No Composer import or compiler is required in the deployed browser or Worker.
Existing owner projects are never migrated by this new-project recipe.

## Apps and Composer

The Apps button and Cmd/Ctrl+K open the same local command menu used by the Composer family. App Composer branding returns to `https://composer.loftwah.com/`; app destinations are the five independent public sites. Studio shortcuts retain their destination authentication. This project owns the copied controller, strict TypeScript source/emission guard, styles, Space font/OFL, Composer icon and five thumbnails; it fetches no Composer runtime assets. The creation manifest names every captured input. Updating these files is an explicit source change followed by `pnpm source:write`, `pnpm check` and `pnpm build`. Existing projects and owner data are not automatically changed.
