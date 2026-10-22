# App Composer identity and PHP2Shell campaign

Approved by MP on 22 October 2026. This record accompanies the supplied source files, the editable vector and the shipped derivatives. The icon and campaign artwork are MP-supplied; the square and vertical campaign cards are deliberate reflows of the same approved copy, not new art direction. The icon's sampled orange `#fc5b05` is the canonical brand orange. The supplied campaign master uses a nearby orange; exported derivatives are colour-corrected to the icon orange, while the supplied master is retained unchanged.

## Supplied masters

| File | SHA-256 | Notes |
| --- | --- | --- |
| `docs/assets/brand/app-composer-mark-master-20261022.png` | `a1b205ebed6804b0aaecc47f474ea1518c22064f468c1eb3f5a35dda7ababa80` | Original 1254 × 1254 RGBA icon supplied by MP. Orange `#fc5b05`; transparent field. This sampled icon orange is the canonical brand orange. |
| `docs/assets/brand/php2shell-australia-master-20261022.jpg` | `d6fd1f40d2ea8552dde39d01cab2ed161ec6b612c3df6045da6a4ace280f8778` | Original 1730 × 909 approved PHP2Shell artwork. |

The supplied files are retained unchanged. The vector master is an editable reconstruction, not a replacement raster. The `20261022b` suffix marks the orange-consistency export after MP's review; the initial `20261022` references remain historical and are not active consumers.

## Icon system

`public/brand/composer-icon-20261022b.svg` is the canonical vector master. It uses the supplied rounded blocks and a traced white joining path and arrow. The reverse mark, orange tile and wordmark lockups are derived from that master.

Shipped derivatives:

- `composer-icon-20261022b-16.png`, `-32.png`, `-48.png` and `favicon-20261022b.ico`
- `composer-icon-20261022b-96.png`
- `composer-icon-20261022b-180.png` (Apple touch)
- `composer-icon-20261022b-192.png`, `-512.png` (PWA any)
- `composer-icon-20261022b-maskable-512.png` (orange field; mark inside the safe zone)
- `composer-icon-tile-20261022b.svg`, `composer-mark-reverse-20261022b.svg`
- `composer-logo-20261022b.svg`, `composer-logo-dark-20261022b.svg`, `composer-logo-reverse-20261022b.svg`
- `src/assets/composer-icon-20261022b-96.png.bin` for the server-rendered stack card
- `extension/icon.png` (128 × 128)

The icon is used by the header, favicon links, manifest, launcher, extension and generated content projects. Independent mini-app identities are unchanged.

## Campaign assets

Source files: `.artwork/campaign/php2shell-square.html`, `.artwork/campaign/php2shell-vertical.html`, `.artwork/campaign/product-og.html`, `.artwork/campaign/render.sh`.

| Export | Dimensions | Use |
| --- | --- | --- |
| `public/brand/campaign/php2shell-australia-20261022b-1200x630.jpg` | 1200 × 630 | Article Open Graph and X/Twitter card. Centred resize of the supplied landscape master. |
| `public/brand/campaign/php2shell-australia-20261022b-1080x1080.jpg` | 1080 × 1080 | Square social card. Deliberate reflow of the approved copy. |
| `public/brand/campaign/php2shell-australia-20261022b-1080x1920.jpg` | 1080 × 1920 | Vertical social card. Deliberate reflow of the approved copy. |
| `public/brand/campaign/php2shell-australia-20261022b-1200x630.webp` and smaller widths | 1200/800/480 wide | Responsive in-page landscape artwork. |
| `public/brand/campaign/php2shell-australia-20261022b-1080x1080.webp` | 1080 × 1080 | Mobile in-page artwork. |
| `public/brand/campaign/product-og-20261022b.jpg` | 1200 × 630 | Product-focused homepage and default sharing card. |
| `public/brand/campaign/product-og-20261022b.png` | 1200 × 630 | Editable-render source for the product card. |
| `public/brand/campaign/product-x-banner-20261022b.jpg` | 1500 × 500 | Product X profile banner. Keeps the lockup, headline and URL inside the central crop and away from the avatar overlap. |
| `public/brand/campaign/product-x-banner-20261022b.png` | 1500 × 500 | Editable-render source for the X banner. |

The 1500 × 500 X banner is a product asset, not a third campaign card. It uses the approved reverse mark, the existing product line and the clean product address. The address sits at the lower right, clear of the lower-left profile-avatar zone. The JPEG is 40 KB; the editable HTML source is `.artwork/campaign/x-banner.html`. The article does not publish campaign production notes or link the profile export.

The product card uses the approved mark and the existing product line, "Make software. Keep it yours." It is separate from the campaign card so the homepage retains a product sharing identity.

## Export commands

The campaign reflows are rendered by:

```sh
.artwork/campaign/render.sh
```

The script uses the locally installed Chrome, ImageMagick and the self-hosted Space Grotesk font. It requires no network access, account or paid service. The supplied landscape master is resized and cropped with ImageMagick. The icon derivatives are rendered from the vector with ImageMagick and packed with PNG32 output so the extension guard keeps 8-bit RGBA. The banner JPEG is flattened onto the canonical orange before compression.

## Verification boundary

Inspected at full size, 600 px and approximately 300 px; icon pixels inspected at 16, 32, 48 and 96 px on light and dark fields. The square and vertical cards were checked for clipped copy and safe margins. The article and homepage were checked at phone and desktop widths in both themes. Social-platform unfurl rendering remains a separate external check; the served metadata and image files are verified locally and after deployment.
