# Brand Studio native acceptance — 25 October 2026

**Local native runtime passed. Production appearance was not changed by this
fixture.** The captures show actual EmDash 1.3.1, its native React plugin page,
API dispatcher, session authentication and local D1. All displayed identities
and records are fictional.

Runtime source is `a42f2473942857e510138def2e3af7caf9bf8ed6`; `receipt.json`
records exact SHA-256 values for the five runtime/configuration source files.
`sourceDirty:true` reflects the untracked evidence being authored in the
checkout, not an uncommitted runtime variation. Three temporary integration
seams register the native page/routes, call the branding middleware helpers and
select the existing native-passkey fixture instead of production Access. No
seam is written back into the source checkout. Root integration and production
release require their own exact-source checks.

## Actual journey

`node docs/evidence/brand-studio-20261025/capture.mjs` passed:

- Native EmDash first-account setup with a virtual authenticator, ordinary
  **Get Started** dismissal, and the real Needs attention screen before styling.
- The Brand Studio form saved version 1 with a new name and footer. Its actual
  desktop preview used the changed native title and fetched the protected orange
  stylesheet. Deliberate publication created version 2.
- A second form edit kept the first name, changed the footer and selected
  compact spacing/18px text. The actual phone preview displayed that saved
  draft; deliberate publication created version 4 after draft version 3.
- **Restore version 2** created version 5 with the original configuration.
  Versions 1–4 remained unchanged in the saved history.
- An unsupported CSS import was refused with the working form retained.
  Anonymous stylesheet access returned 403; authenticated native stylesheet
  access succeeded. The keyboard field path passed.
- Brand Studio and settled native screens were captured at 1440/390 in both
  themes and inspected visually. There was no horizontal document overflow.
  A separate double-root-text reflow passed at 390px; this is a CSS text-size
  check, not physical-device or native browser-zoom acceptance.
- The browser recorded no page errors. The one owned temporary root, cloned
  dependencies, local database and downloads/staging were removed on completion.

The screenshot pair `before-native-1440-dark.png` /
`after-native-1440-dark.png` shows the native logo/name, footer and semantic
accent change. `studio-*` shows the actual authoring page;
`second-draft-native-phone.png` shows the large-text saved preview with its
explicit banner; `history-390-light.png` shows the retained versions.

## Reproduction and useful failures

The runner uses the existing `admin-journey` preparation script and an APFS
clone of the installed dependency tree within the owned root. No dependency is
installed. An external `node_modules` symlink produced real deep-admin 404s in
an earlier fixture attempt; containing the same dependencies fixed that route
failure. The first-account welcome dialog was dismissed through its actual
button rather than removing modal attributes.

The first stylesheet attempt correctly failed: a normal link cannot send the
custom header required by EmDash private plugin GET routes, and the installed
raw plugin response contract expects `pluginResponse()`. The final implementation
serves finite CSS through existing authenticated Composer middleware, with
explicit local-user/target checks and anonymous denial. It adds no public
plugin route, frame exemption or CSP relaxation.

Focused checks:

```sh
node --test tests/admin-brand.test.mjs
pnpm check:types
```

Five store/security/concurrency tests passed. Types reported zero errors and
warnings (66 informational hints). The root integrator owns the full required
check/build, native integration review and clean pushed-main release.

The design detector reported only advisory literal-colour findings: charcoal
`#17181b` and hover orange `#ff7a33` are already documented semantic values;
`#b63a28` is an intentional danger fallback used only without the native danger
token. This extends the existing native visual world; it introduces no new
identity or design system.

Cloudflare Access, real IdP/MFA, physical passkeys, screen readers, other owned
apps, complete native visual finishing and downstream screenshot/video/portfolio
propagation remain separate gates under #353/#285/#11.
