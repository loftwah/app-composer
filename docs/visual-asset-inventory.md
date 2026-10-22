# Visual asset ownership and release inventory

Reviewed 18 October 2026. This inventory describes committed source, not a visual
approval or a live-release receipt. Composer was inspected at
`24a611f65575ea17734f4cc0926adfb6fa00c465`. The five independent repositories were
read through the exact local `origin/main` revisions below, without checking out,
resetting or editing their owner worktrees. Refresh those identities before a
release; local remote-tracking refs do not establish GitHub or deployed freshness.

MP's current direction is a distinct adult science-fiction cartoon world with
recognisable characters, strong drawing and app-specific silhouettes. Read the
owning [visual direction](visual-direction.md) before selecting or changing art.
The owner's Bubbles benchmark concerns composition, a specific moment and whole
presentation/finish; it does not require copying its appearance or forcing every
app into a shiny mascot. Generic clipart, glossy interchangeable mascots and the
old flat symbol family are not
the selected direction. Linkarooie now has the qualified accepted lime workshop curator recorded in the visual direction. Historical GitHub references remain provenance, including the confirmed wrong-reference selection; they must not replace the accepted character. Other app identities retain separate selection and delivery evidence.

## Source boundaries

| Product | Repository / inspected revision | Current public shell |
| --- | --- | --- |
| App Composer | `loftwah/app-composer` / `24a611f65575ea17734f4cc0926adfb6fa00c465` | `src/layouts/Base.astro`, `src/components/ProductHome.astro`, `src/components/AppLauncher.astro` |
| Here / there | `loftwah/app-composer-guestbook` / `9ef065e33947351ba28f5317570a00a5aa57701c` | `src/common.ts`, `src/worker.ts` |
| Linkarooie | `loftwah/app-composer-showcase` / `3d39b1e3d39c8580da96c14b29003599721e8e78` | `src/common.ts`, `src/worker.ts`, `src/creator-profile.ts` |
| Hello World | `loftwah/app-composer-hello` / `d1b04076ed37d2657abcadd8204976c671baded0` | `src/worker.ts`, `public/style.css` |
| Carry / forward | `loftwah/app-composer-state` / `7f6a69a2f7ec67a5c87d500e0b7d8beb46ac589f` | `public/index.html`, `public/style.css`, `worker.ts` |
| Link Check | `loftwah/app-composer-linkcheck` / `8d10595eb14c83ead66e7fd8470dbf651aaa2316` | `public/index.html`, `public/style.css`, `src/worker.ts` |

Some shell/browser sources are being extracted and strictly checked in the
engineering stream. Reconcile this table with that stream's final commits before
editing consumers; emitted files do not replace their authored source.

Each app owns and commits its deployable assets. Catalogue and launcher copies
are local distributions of reviewed bytes. They do not fetch artwork from
Composer at runtime. Guestbook and Linkarooie also need independent release and
exact source-pin promotion before their mounted Composer copies change.

## Icons, headers and installation

Every current shell declares `/brand/mark.svg` as its favicon and
`/brand/icon.png` as its Apple touch icon. All six PNGs are 512 × 512. Those
stable filenames currently contain the old authored symbol family; replacing
only the catalogue image will leave these visible identities behind.

| Product | Current mark and header use | Action for the selected family |
| --- | --- | --- |
| Composer | `public/brand/mark.svg`: interlocking squares. Header repeats separate inline SVG geometry in `Base.astro`; launcher Composer row uses Lucide `Grid3x3`. | Replace all selected identity consumers together, with one reviewed Composer master and explicitly named derivatives. Keep functional control glyphs separate. |
| Here / there | `public/brand/mark.svg`: postcard/pin. `src/common.ts` also displays this app mark beside a link labelled **App Composer**. | Give the app its own selected icon. Composer-return links must display the Composer identity, rather than borrowing the app favicon. |
| Linkarooie | `public/brand/mark.svg`: chain links. Standalone header instead uses `public/brand/creators/linkarooie-kangaroo-v1.png`. That PNG is now a 192px rendering of the chain mark. Composer-return links use the app mark. | Restore the reviewed original-derived kangaroo identity consistently in app favicon, touch/header and launcher derivatives. Use a separate Composer identity for Composer-return links. |
| Hello | `public/brand/mark.svg`: signal dish. `src/worker.ts` uses the same path in its app header. | Replace both uses with its own selected identity derivatives. |
| Carry / forward | `public/brand/mark.svg`: memory device. `public/index.html` uses it in the app header. | Replace both uses with its own selected identity derivatives. |
| Link Check | `public/brand/mark.svg`: page/magnifier. `public/index.html` uses it in the app header. | Replace both uses with its own selected identity derivatives. |

Only Composer currently commits `public/site.webmanifest`. Its `icons[0].src`
is `/brand/icon.png`, `sizes` is `512x512`, and purpose is `any`. It does not
declare a separately qualified maskable icon. The other five inspected sources
declare Apple touch icons but no web manifest. An icon declaration alone is not
proof of installation, OS masking or an existing home-screen icon updating.

The old authored SVG sources are also in `.artwork/marks/authored/`; earlier
generated mark candidates are in `.artwork/masters/marks/`. Treat them as
superseded authoring history after the new family is selected. Do not use their
existence or old proof sheets as acceptance of the new direction.

## App illustration, catalogue and launcher copies

The source masters below are committed in their independent app's
`public/brand/`. The two `*-art-v4-480.webp` / `*-art-v4-960.webp` files are its
480px and 960px square hero derivatives. Names contain `v4` although provenance
calls the chosen generation jobs `v5`; those are different identities, not a
reliable version rule for a new release.

| App | Own committed master / hero prefix | Composer catalogue / thumbnail prefix | Own and Composer share prefix |
| --- | --- | --- | --- |
| Here / there | `herethere-art-v4-master.png` / `herethere-art-v4` | `herethere-v4.webp` / `herethere-small-v4.webp` | `herethere-share-v4` |
| Linkarooie | `linkarooie-art-v4-master.png` / `linkarooie-art-v4` | `linkarooie-v4.webp` / `linkarooie-small-v4.webp` | `linkarooie-share-v4` |
| Link Check | `linkcheck-art-v4-master.png` / `linkcheck-art-v4` | `linkcheck-v4.webp` / `linkcheck-small-v4.webp` | `linkcheck-share-v4` |
| Hello | `hello-art-v4-master.png` / `hello-art-v4` | `hello-v4.webp` / `hello-small-v4.webp` | `hello-share-v4` |
| Carry / forward | `carry-forward-art-v4-master.png` / `carry-forward-art-v4` | `carryforward-v4.webp` / `carryforward-small-v4.webp` | `carryforward-share-v4` |

Composer's catalogue copies live in `public/brand/apps/` and are selected by
`src/lib/apps.ts`: `image` is 480 × 480, `thumbnail` is 96 × 96, and `share` is
the app's 1200 × 630 JPEG. Each independent app also commits all five local
`public/brand/apps/*-small-v4.webp` launcher images. Composer uses those paths
through `apps.ts` / `AppLauncher.astro`; the other launchers declare them in
their shell source. New identity thumbnails must use the chosen app's icon
master, rather than an arbitrary centre crop of its large scene.

Current previews use `public/brand/apps/previews/{herethere,linkarooie,linkcheck,hello,carryforward}-20261018-{960,1440}.webp`.
They were captured from the actual independently released production apps at 1440×960 on 18 October, after the common command menu shipped. The source PNGs and phone captures are in `docs/images/`; exact app revisions, capture settings and hashes are in `docs/images/capture-20261018.json` and the preview directory's dated capture receipt. There are no asset/request overrides or fictional UI fixtures. Requests carry the existing verification marker. The old undated preview files remain intact.

The preview files
are captured app screens, selected through `preview` / `previewWide`. Keep their
honest screenshot role and capture date. Recapture after the new visible UI
ships; do not replace screenshots with character artwork. `apps.astro` and
`catalogue/[slug].astro` deliberately distinguish real screens from drawings.

Composer's own hero is separate:
`public/brand/hero-composer-v5-{960,1600}.webp`, rendered by `ProductHome.astro`.
Its authoring master is an ignored local `.artwork/masters/hero-composer-v5-2.png`.
The new receipt must identify and retain the selected source; a script referring
to an ignored file does not make that source available in a fresh checkout.

## Social cards and persisted publications

Keep the current product social identity:
`public/brand/campaign/product-og-20261022.jpg` (1200 × 630), rendered from the
approved mark and the existing product line. `Base.astro` defaults to it; the
retired `share-ai-v1`, personal-profile homepage cards and the rejected
assembly-scene product card remain unused historical files. Do not restore them
while replacing an icon.

The PHP2Shell article uses campaign-specific artwork:
`public/brand/campaign/php2shell-australia-1200x630.jpg` for Open Graph/X,
with deliberate 1080 × 1080 and 1080 × 1920 reflows. Its HTML render sources
and export command live in `.artwork/campaign/`; supplied masters, hashes and
the verification boundary are recorded in `docs/assets/brand/PROVENANCE.md`.

Each app's own share prefix in the table produces `.jpg`, `.webp` and
`-600.webp` (600 × 315). Composer's copies are in `public/brand/apps/`; app shell
metadata selects its own JPEG. Copy changes must include truthful title,
description, alt text, media type and dimensions at their actual consumer.
At the inspected revisions, all five own-app JPEGs match their Composer copies
byte-for-byte, and all 25 independent launcher thumbnail copies match Composer.
That consistency is useful evidence to retain, separately from art approval.

Published stack cards use a different path:
`src/pages/s/[slug]/share/[identity].png.ts`, `src/lib/stack-share-image.ts`,
`src/lib/stack-share-svg.ts` and `src/lib/stack-sharing.ts`. They render a
persisted publication, use its current visibility and exact immutable identity,
and embed separate Composer module geometry. Keep the publication boundary,
shared theme tokens and QR. Any renderer/font/mark change that changes these
pixels must advance `STACK_CARD_VERSION` and its identity validator together;
reusing `v1` URLs for new pixels violates their cache identity.

`public/brand/page-share-url.mjs` hashes canonical URL, title, description and
**image URL**, not image bytes. Replacing a JPEG at the same filename leaves the
share revision unchanged. Use new artwork filenames for new pixels, update the
metadata consumers and keep the clean SEO canonical. A new URL does not purge
an earlier platform preview.

## Themes and functional glyphs

Keep functional sun/moon, close, search, status and keyboard symbols as useful
interface controls. App identity artwork does not replace their meaning. The
shared local `public/brand/theme-control.css`, launcher and sharing files retain
the explicit maintenance boundary in `docs/source-maintenance.md`.

| Consumer | Theme source / state boundary |
| --- | --- |
| Composer | `src/styles/global.css`, `public/brand/theme-bootstrap.js`, `Base.astro` toggle; `composer-theme` |
| Here / there | `src/common.ts` inline CSS/bootstrap plus local `public/brand/navigation.js`; standalone `guestbook:reader-theme`, mounted `composer-theme` |
| Linkarooie | `src/common.ts`, `src/creator-style.ts` plus local `public/brand/navigation.js`; standalone `showcase:reader-theme`, mounted `composer-theme` |
| Hello | `public/style.css`, local `public/brand/navigation.js`; `hello:reader-theme` |
| Carry / forward | `public/style.css`, `public/brand/reader-theme.js` bootstrap and `navigation.js` toggle; `state:reader-theme` |
| Link Check | `public/style.css`, `public/app.js`; `linkcheck-theme` |
| Published stack | `src/lib/stack-theme.mjs` tokens shared with `StackView.tsx` and the persisted image renderer |
| Content-site template | `site-template/src/styles/site.css`, `ContentLayout.astro` toggle; `content-site-theme` |

Preserve those separate storage keys and the mounted reader choice. New identity
derivatives need contrast inspection in both themes; changing a brand image
does not authorise changing theme behavior or app state.

## Linkarooie creator assets and original provenance

The initially selected reference repository identified by the earlier Showcase guidance
is `loftwah/linkarooie-3` at
`149f277bc45baf31eca406878e8e16325b85a06f`,
[`src/assets/images/icon.png`](https://github.com/loftwah/linkarooie-3/blob/149f277bc45baf31eca406878e8e16325b85a06f/src/assets/images/icon.png).
MP identified this as the wrong one of two similar references. Independent comparison found the original seated kangaroo in Rails Linkarooie at `d0650199` and Linkarooie 2 at `910d4797`; neither historical finding overrides the accepted workshop curator. The source name alone is not visual authority.
`docs/linkarooie-provenance.md` also records the older Rails behaviour reference
separately. Do not import its trackers, runtime or private content.

Creator images are owner settings, separate from the generic app identity:
`public/brand/creators/loftwah-avatar-v1.jpg`, `loftwah-banner-v1.jpg` and
`loftwah-share-v1.jpg`. Preserve owner records and explicit configuration. Replace
a wrong avatar only from the selected, authorised owner reference, with a new
recorded derivative/version and an explicit configuration migration if needed.
Do not substitute an app mascot for a person's portrait or silently re-export
whatever happens to exist at a private local filename.

The current `docs/brand/provenance.md` needs reconciliation when this release is
made: its paragraph still describes an unchanged photographic portrait, and its
kangaroo SHA `27bc4b7…` differs from the inspected committed PNG
`acc1c0d1f6959f66e6c7b44ec05dfb251ec0828d2baf7bc64cb6644f89f16871`.
The current PNG's filename is misleading: `.artwork/export-v5.sh` explicitly
renders the chain `mark.svg` over it. Use actual committed hashes and selected
source provenance in the replacement receipt.

## Fonts and generated content sites

`public/brand/space.woff2` in Composer, Guestbook, Showcase, Hello and State, and
Link Check's separate `public/space.woff2`, all contain the same 6,628-byte
Vietnamese-only subset:
`4539c771f849847bb8a7a8490699750ec1538e10c9060c4e9f154a692808ddfd`.
It lacks basic Latin glyphs. A valid WOFF2 signature and a matching preload do
not prove that intended text uses the face; browsers silently fall back.

Use the already reviewed full Space Grotesk source as the provenance boundary:
`src/assets/fonts/SpaceGrotesk.ttf.bin`, SHA
`acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72`,
from upstream commit `03507d024a01282884232081fc6011c09ff4e849`,
`fonts/ttf/SpaceGrotesk[wght].ttf`. Its OFL and source link are in
`src/assets/fonts/README.md`. Keep the server's verified TTF bytes and licence;
derive and record a browser face with actual required glyph coverage. Correct
preload, CSS source and export templates together, and inspect the resulting
text pixels and line wrapping. Showcase's separate Inter files/OFL come from
the pinned original Linkarooie reference and are not this broken Space subset.

`scripts/font-journey.mjs` provides a bounded browser proof using an existing
Playwright page and selected local font bytes. It loads a temporary `FontFace`
and compares the actual pixels and advance widths of 95 printable ASCII glyphs
under three fallback families. It refuses an indistinguishable calibration and
removes only its own face. The maintained browser regression rejects the old
subset and accepts the complete reviewed TTF, with an optional new web-font
candidate:

```sh
COMPOSER_PLAYWRIGHT_MODULE=/absolute/existing/playwright/index.mjs \
COMPOSER_REVIEWED_WEB_FONT=/absolute/reviewed-font.woff2 \
node --test tests/font-glyphs.browser.mjs
```

This explicit check reuses installed Chromium/WebKit and downloads nothing.
It owns one temporary root, closes its own contexts and removes that root on
success or failure. It is separate from the Node-only `pnpm test` suite; browser
absence fails the explicit check. The negative fixture retains its OFL and must
never return to a public font path. A pass proves the selected glyphs render
without fallback dependence on those browsers, not full Unicode coverage, a
correct active CSS/network selection, line wrapping or typographic quality.

The independent content-site recipe is another consumer:
`lib/content-model/project.mjs` explicitly copies `public/brand/icon.png`,
`space.woff2` and its OFL into generated projects. Its
`site-template/src/layouts/ContentLayout.astro` selects the PNG favicon;
`site-template/src/styles/site.css` selects the browser face. Keep this explicit
package allowlist and source receipt coherent with new reviewed default assets.
This template has a simple owner-labelled header, no Apps launcher, no current
Apple icon/webmanifest and no default `og:image`. Do not claim its independent
customer identity or installation is configured by updating Composer's files.

## Authoring/export paths to retire or reconcile

`.artwork/export-v5.sh` is historical authoring code, not the maintenance command
for the next family. It defaults to owner checkout paths, overwrites stable
creator filenames, replaces the kangaroo with a chain, and reads a private local
avatar. Do not rerun it for the new family. Retain historical evidence in Git;
remove or clearly supersede executable guidance that can recreate the rejected
outputs after all intended consumers move.

The deterministic HTML exports are `.artwork/og/share-card-v5.html`,
`composer-card-v5.html`, `loftwah-card-v5.html` and `postcard-v5.html`.
They all load the broken browser Space file. Product/app cards repeat inline
Composer square geometry. The personal `loftwah-card-v5.html` also labels that
Composer glyph **Linkarooie** and refers to `../../loftwah-avatar.png` instead of
the export script's private avatar input. These need explicit selected assets,
fonts and identity labels before use. The older `share-card.html` still points
at rejected `*-v3.webp`; keep it out of active export instructions.

## Minimal maintenance and acceptance contract

Keep `scripts/public-ui-assets.mjs` / `pnpm ui:assets --check|--write` for the six
shared behavior/style distributions documented in [source maintenance](source-maintenance.md).
It intentionally does not currently own app artwork, icons, creator images or
fonts. Do not expand it to copy all of `public/brand`.

For the selected icon family, extend the same explicit maintenance approach with
one reviewed finite copy plan: six known package identities, chosen master and
derivative source paths, versioned destination paths, SHA-256 and dimensions.
Own-app icon derivatives and local catalogue/launcher copies must be separate
named entries tied to the same chosen app master. Preflight every selected
destination before writes, refuse linked paths, preserve unrelated files and
make repeated writes leave matching bytes untouched. Select absolute checkout
paths explicitly; do not infer owner directories, fetch remote assets or build
unreviewed sources. New source paths remain pending the artwork selection.
Keep already published immutable artwork URLs and bytes intact when moving
active references to a new family. Retiring a visible use does not require
overwriting or deleting an old versioned asset. Previously removed private or
retired files do not gain permission to return through this inventory.

Checks must detect missing/changed bytes, mismatched app identity, wrong raster
dimensions, incomplete glyph coverage, stale declarations and unexpected old
references. Existing `library-assets.test.mjs` and `product-identity.test.mjs`
contain literal reviewed `v4` paths; reconcile them with the new finite plan
rather than weakening them to accept arbitrary artwork. Their current pass is
not approval of the newly requested visual direction.

For mounted Guestbook/Linkarooie, preserve `${base}` prefixes and Worker asset
path stripping. Current inline CSS uses
`.replaceAll("url('/brand/", "url('" + base + "/brand/")`; changing quotes or
moving assets can bypass that rewrite. Verify the actual font/icon/launcher/OG
bytes on both standalone and mounted paths after exact pin promotion. Do not
let an app's missing asset accidentally resolve to Composer's different asset.

The release evidence must name each exact source/Worker identity and include
actual 16/32px favicons, 40/48px headers/launcher rows, 96px derivatives, 512px
touch icons and 1200 × 630 cards in dark/light phone and desktop context. Inspect
silhouette, crop, contrast, readable type, actual network-selected font, focus
and controls. Check crawler-fetchable HTTPS images and downloaded exports;
record any unverified OS installation or external platform rendering. A source
check, a contact sheet or a successful build alone does not establish that
acceptance.

## Selected delivery update, 18 October

Linkarooie uses the qualified accepted workshop master SHA `0928056f6e8a81bd4ea2e10d4424cc449c021a4f8ed1d471810c1878b4e4b1bc`. Its new share, hero, optical header/favicon/install and launcher exports use dated `20261018` filenames. Composer catalogue bytes match the owning app. The old chain remains an immutable historical asset, without active Linkarooie identity consumers. See the owning app’s `docs/brand/artwork-20261018.json` for the finite inventory and crop coordinates. The historical cross-checkout exporter is disabled.

The repaired browser font is `space-latin-20261018.woff2`, SHA `61d00a1c57fcd7d4826c7a69cd85b61d15d133d5471d3c9c4731d70193d9f71f`. Active source/preload/export templates and generated content projects must select it; retaining the old file does not make it an active consumer. The shared maintainer pins this font and the selected Linkarooie thumbnail, allows explicit creation and refuses different bytes at a versioned destination. This is a source inventory update, not a six-app final-art approval or live receipt.

The optical identity family now replaces active app favicon/touch/header and launcher identities with dated action drawings. Exact masters/prompts are in `.artwork/identity-{prompts,exports}-20261018.json`; original heroes remain unchanged except Linkarooie’s accepted workshop. Composer’s new dated product card repairs typography, thumbnail purpose copy and its matching identity. The extension advances to0.1.1 with its actual new128px identity in the rebuilt archive. Installation, external caches and physical-device acceptance remain separate.
