# Your EmDash content site

Created by App Composer’s reviewed content-project recipe, 15 October 2026. This is independent application source under MIT. It uses Astro 7.3.5, EmDash 1.2.0, Tailwind 4.3.3 and the Cloudflare adapter. Get Ready and Woodhouse are not runtime dependencies.

Your field model is `src/content-model.json`; its native EmDash schema is `seed/seed.json`. `src/pages/index.astro` reads 20 published entries per page. Native Previous page / Next page links appear above and below longer collections, so older entries stay reachable without JavaScript. Page addresses can be bookmarked; invalid or duplicate page values are refused, and an empty later page returns 404 with a route back to the first page. The bounded page number supports up to 99,999 pages. Publication changes between requests can shift offset pages; each request still reads only currently published entries. Draft/private entries are not requested. Optional display conditions affect this page; native EmDash editing does not hide conditional fields. Invalid HTTPS links are rendered as text. Repeating rows are escaped text, not rich HTML.

## Run locally

An authorised agent checks the project’s current instructions, Node22, pnpm12.9.1 and package/lockfile first, then installs the frozen dependencies with lifecycle scripts disabled:

```
pnpm install --frozen-lockfile --ignore-scripts
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

The pinned EmDash 1.2.0 editor sends a cleared optional URL as an empty string, which its URL validator rejects ([upstream #4075](https://github.com/emdash-cms/emdash/issues/4075), fixed upstream in [#4076](https://github.com/emdash-cms/emdash/pull/4076)). This source includes a small trusted native before-save compatibility hook for this model’s top-level optional links: only submitted empty strings become null. Other fields, missing values, required links, authentication, native validation, revisions and explicit publication stay under EmDash. There is no route, stored-data scan, backfill or external call. It is bundled with the site’s reviewed code rather than installed from a plugin registry. Re-test clearing and remove the compatibility hook after upgrading to a released version that includes the fix.

Public styling is scoped to the collection page so it cannot override the native EmDash editor.

The pinned editor also converts an empty number control to `0`. The bundled native React integer widget keeps an explicit zero as zero and saves a cleared optional number as null. It uses the same pinned Kumo controls as EmDash, retains required/range attributes, and leaves server validation and publication to EmDash. Only this generated site's seed selects the bundled widget. A separately downloaded portable seed has no plugin dependency and uses the host editor, including its current empty-number limitation. Re-test this behaviour on EmDash upgrades before removing the widget; no existing site is silently updated.

If passkey creation is cancelled, remain on the setup screen and try again through the browser. Seeing **Passkey created** is a successful registration, not an instruction to create another credential. Keep the same localhost hostname; changing to a numeric IP changes the passkey context. A credential created for local testing does not establish production account recovery. Configure and verify the chosen production authentication/recovery separately before accepting valuable content.

`pnpm build` compiles the Cloudflare Worker. It does not deploy or prove account ownership. The supplied `pnpm deploy` refuses execution: the all-zero D1 ID and local resource names are placeholders, not an authorised destination.

## Before any cloud deployment

Use Get Ready for the actual selected project and account. Review source ownership, the intended domain, app-owned D1/R2, admin protection, privacy, backup/restore and cost before preparing its real deployment configuration. Do not reuse App Composer’s account, domains, storage, credentials or admin policy. A Worker’s code rollback does not restore data. No schema replacement or automatic migration of an existing site is supported by this new-project recipe.

Replace local placeholders only through the project’s reviewed release path. Public search indexing stays disabled until a real canonical origin and public metadata are configured. This kit supplies native authenticated editing and a published-content page. It does not implement public submission forms, enquiry delivery, payment, commerce, media widgets or customer deployment automation. Those need their own reviewed application behaviour.

## Maintain your source

Commit the generated files and lockfile to your own repository after review. `composer-project.json` records generated file hashes and captured template hashes; neither hashes nor a successful build certify agent discovery, security or deployment. Re-run creation only into a new absent directory; this recipe never updates existing files. Keep current edits and data separate from upstream updates. Test changed user journeys and build before deployment.

Official guidance: https://docs.emdashcms.com/agent-skills/ and https://docs.emdashcms.com/deployment/cloudflare/ . Font: Space Grotesk, SIL OFL; the notice is in `public/brand/OFL-Space-Grotesk.txt`.


## Individual entry pages

Each entry title in the collection links to `/entries/CONTENT_ID`, using the native stable content ID rather than an editable title or slug. Renaming a title keeps that address. The detail page repeats the same visible model fields, groups, date formatting and escaped values as the collection, with one first-level title and a keyboard-accessible route back. It works without JavaScript. Native D1 queries are restricted to the selected collection, explicit published status and the exact bounded ID. Missing, unpublished or removed entries return 404; a database failure returns 503. Detail responses are not cached. The native authenticated preview/edit context is owned by EmDash and is not a public permission grant; public acceptance here uses ordinary unauthenticated requests.

Individual titles and short descriptions supply page and Open Graph metadata. These local pages stay noindex/nofollow; no canonical origin, share artwork, indexing approval or production deployment is invented. Review those separately for the actual public site. The source recipe creates new projects only and never adds routes to an existing owner project automatically.
