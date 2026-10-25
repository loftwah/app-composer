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
