# Brand Studio

First Composer-native slice, 25 October 2026. Owners: #353 / #285; release and
production receipts remain #11.

Brand Studio configures the **actual native EmDash admin** for the selected
Composer account and environment. It does not recolour public pages or change
the independently owned mini-apps. The private page is
`/_emdash/admin/plugins/composer-stacks/brand-studio`.

An enabled EmDash administrator can give the admin a name and footer label,
choose comfortable/compact Composer panel spacing and standard/large text, then
save a draft. The approved merging-block mark and orange semantic palette are
curated defaults; arbitrary CSS, HTML, external logo URLs, uploads and unreviewed
palettes are rejected. Native chrome keeps EmDash's existing Phosphor icons.
Composer action buttons pair canonical orange with charcoal text; native
white-text controls use the accessible darker orange.

## Author, preview and recover

1. Edit the existing Composer form and **Save draft**. This stores a versioned
   `composer.admin-brand/1` configuration in this account/environment's D1.
2. Select an existing admin screen: Needs attention, Inbox, Workflows,
   Connections, Analytics or Creator stacks. **Open Desktop preview** and
   **Open Phone preview** open that real screen with the saved draft. The
   browser may use a tab instead of a sized window. Preview is administrator
   only, is labelled as a preview and never publishes itself.
3. Review the actual screen and both native themes. The checkbox records the
   operator's explicit review before **Publish saved appearance** is enabled.
   This is an acknowledgement, not an automated accessibility certification.
4. Reload an admin tab to see the published result. A later draft leaves the
   current published appearance in place until its own explicit publication.
5. **Restore version** selects a previously published configuration and records
   a new published version. It preserves earlier versions and operational data.
   Export downloads the versioned configuration; importing validates it into
   the current form and requires a new draft/publication. A foreign account,
   environment or app is refused rather than silently reassigned.

Every write carries the exact saved revision. Competing saves, stale publication
and a rollback from a never-published draft are refused. Unsaved entries survive
a failure; reload/compare deliberately before retrying. The native router's
existing navigation guard protects dirty/pending forms. All version rows remain
in D1; the interface currently shows the latest 25.

## Native integration and boundaries

The existing `composer-stacks` native plugin owns the page and two private
routes: `brandRead`, `brandWrite` (`plugins:manage` plus an enabled role-50
administrator check). The existing Composer middleware serves the same-origin
`/_emdash/composer-admin-brand.css` stylesheet after native authentication,
rechecking the authenticated local user and exact configured target.
Styles for saved drafts require an administrator; published styles can be read
by an authenticated user. Every operation selects the server-configured
`RESOURCE_ACCOUNT_ID`, `RESOURCE_ENVIRONMENT`, `PUBLIC_ORIGIN` and `DB` binding.
The client cannot select a different target by query or imported configuration.

`prepareAdminBrand()` runs after native EmDash authentication and before the
route. It clones `locals.emdash`, its config and its `admin` object for that
request, using EmDash 1.3.1's supported `siteName`, `logo`, `footerLabel` and
`favicon` fields. It never mutates the shared build configuration. Both the
admin HTML and native manifest read that per-request config. Saved previews
carry their version through the same-origin document/manifest request; preview
selection never supplies a user or permission.

`brandAdminResponse()` adds a same-origin stylesheet link to native admin HTML.
The protected stylesheet has a finite semantic-token grammar and no interpolated
user text, URLs or inline styles. It respects existing CSP and frame protection;
no iframe exemption or second admin shell is introduced. Private native plugin
routes require a custom request header even on GET, which an ordinary stylesheet
link cannot send; this is why the CSS uses the existing authenticated middleware
instead of a public plugin route or an unsupported raw `Response`. A missing/invalid
brand store leaves the existing native admin operational. Brand Studio reports
the unavailable state rather than pretending it has loaded the current config.

Official references checked against the installed 1.3.1 source:

- [Native React administration](https://docs.emdashcms.com/plugins/creating-native-plugins/react-admin/)
  for page registration, route permission and the host-owned navigation.
- [EmDash configuration](https://docs.emdashcms.com/reference/configuration/)
  and installed `src/astro/integration/runtime.ts` for supported admin branding.
- Installed `src/astro/routes/admin.astro` and `api/manifest.ts` both read
  `locals.emdash.config.admin`; the latter explicitly documents per-request
  branding propagation. The local browser journey exercises those real routes.

## Verification scope and remaining work

`tests/admin-brand.test.mjs` exercises real SQLite-backed draft/publication,
second-change retention, immutable history, rollback, exact-target denial,
disabled/non-admin refusal, CSRF/origin checks, unsafe import fields, stale and
interleaved saves, private styles and concurrent request/global-config isolation.
It includes a manifest preview selection and the finite HTML/CSS response.

The labelled native browser receipt and before/after captures belong in
`docs/evidence/brand-studio-20261025/`. It uses native EmDash setup and a virtual
passkey against a disposable local D1. The fixture removes Cloudflare Access
and provider bindings; it does not prove production Access/MFA, physical
devices, screen readers or owner acceptance. Owned temporary files and the
APFS-cloned dependency tree are removed on success/failure.

This first slice is intentionally Composer itself. Per-owned-application
appearance authoring, more curated identities, fuller native screen finishing,
portfolio icon inventory, video and screenshot/marketing propagation remain
#353 work. A source commit is not a production appearance change. Broader #285
does not close from this one configuration path: the native form/draft and a
second useful change must be observed, with production evidence separate.

## Completion continuation

The native form now offers three reading presets using the existing approved
mark, palette and schema. Presets change spacing/text only and preserve owner
names, footer, account and environment. A field comparison shows the current
form against the published appearance before save/publication; unsaved forms
still preview only the saved draft. The semantic-colour disclosure explains
signal, native action and light/dark focus roles without allowing arbitrary CSS.
Restoring an older publication now shows its actual differences and requires an
explicit Confirm restore. Cancel performs no write. Version 5 and all its prior
rows remain compatible and are not migrated or replaced by these controls.

The [continuation receipt](evidence/product-completion-20261025/brand-local-receipt.json)
records the actual local native save/preview/publish/second-change/restore,
unsafe-import refusal, keyboard and reflow journey. The maintained replay is
`node docs/evidence/brand-studio-20261025/capture.mjs`; new captures default to
ignored `output/brand-studio-acceptance/` and never overwrite the historical
production evidence. Production identity and owner-state continuity are recorded
separately in #11.

## Workshop press skin — 15 November 2026

Brand Studio offers one optional skin beside the reading presets. **Composer
default** is the unchanged approved identity; **Workshop press** sets the
Composer panels into a pressed plate with a heavier rule, a squarer control edge
and a plate tint mixed from the host text colour, so both native themes stay
legible. The skin changes only presentation: labels, order, actions, permissions
and native icons are untouched.

Two optional fields extend the existing versioned record, not a second store:

- `skin`: `composer` (default) or `workshop-press`.
- `skinPressure`: integer 1–4, the finite edge weight shown as Quiet, Set, Firm,
  Pressed.

Both are optional inside `composer.admin-brand/1` and are validated by
`normaliseAdminBrandConfig()`. Every version saved before this slice has neither
field, takes the Composer defaults on read, and remains previewable, restorable
and exportable. Publication comparison reports the skin, and reports edge
pressure only while the press skin is actually in play. `adminBrandCss()` emits
the skin as a finite token-and-edge layer with no interpolated user text.

Press feedback is separate from the shared appearance record. Sound and haptics
are off by default, stored per device under
`composer:brand-studio:sensory:v1`, and never published to other administrators.
Only the labelled **Press the sample** specimen control can play them: a short Web
Audio tick on the gesture, plus one `navigator.vibrate` pulse when the browser
reports support. There is no autoplay, no typing sound and no document-level
listener. Unsupported browsers show a disabled control with the reason.
Reduced motion keeps the direct visual pressed edge and drops the settle tick
and the vibration. The skin itself adds no animation.

Verification for this slice: `node --test tests/admin-brand-skin.test.mjs`
(normalisation of a retained pre-skin row, bound rejection, CSS bounds, device
preference parsing, reduced-motion cue plan) and the maintained native replay,
which now also checks keyboard-only skin choice and range, the saved preview's
`--composer-skin-press` value, save → reload → the skin still selected, restore
to the default skin, and 390px plus doubled root text without horizontal
scrolling. Physical vibration, iPhone Safari, screen-reader speech and
production remain unverified; see
[the reference note](tactile-skin-20261115.md).

## A portable skin contract and a second consumer — 15 November 2026

The skin layer is now one contract with two shipped recipes, not one hard-coded
surface. **Contact sheet** joins **Workshop press**: printed top rules, square
fields and an inset focus ring instead of the press plate. Both compile through
the same function in `src/lib/appearance-skin-catalogue.ts`, and the default still emits no
layer.

The public [`/appearance`](/appearance) reference consumes the same compiler
with its own tokens and its own device-local choice. It is a reference surface,
not a second theme editor: it cannot save or publish an appearance, and its
storage keys are separate from Brand Studio's. A shared sample component keeps
the field, action and checkbox identical in both consumers.

Brand Studio also compares the **published version** with the **saved draft**
using an accessible split wipe. The two panes are the real generated skin
layers; the native range is the only control, it announces its position, and the
comparison never edits or publishes either version. This mechanism is an
original reimplementation of the reviewed accessible compare-slider pattern in
[the design harvest note](design-harvest-20261115.md).

The written recipe contract — every field, allowed value, compile target and
verification command — is
[the appearance skin contract](appearance-skin-contract.md). A fresh Codex
context produced a valid new recipe from that page alone; the output and its
limits are in
[the evidence receipt](evidence/appearance-skin-20261115/README.md).
