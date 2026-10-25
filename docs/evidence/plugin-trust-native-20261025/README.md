# Plugin Trust Centre — actual native qualification

25 October 2026. This run opens the real `PluginTrustPage` through the integrated
native EmDash 1.3.1 administration and reads its real local D1 plugin-state table.
It does not render copied markup or intercept API responses. The native receipt
identifies source `22660f69ecc65f0a18c5c9e91a49deaa5ce37afc` plus its dirty state
and exact runtime-source hashes, including the small foreground-token correction
in `plugin-trust-page.css`.

The production profile is **emulated locally** at the receipt's localhost
origin. Only the request-origin checks in the copied handler are redirected;
its explicit production-profile metadata remains visible. Production Access
is replaced with native EmDash authentication in the copied fixture. Provider
bindings, routes and cron are absent. No production inventory is read.

## Observed

- The maintained native-actor helper creates an operator, two creators and a
  subscriber using real invitation, virtual-passkey registration, logout and
  sign-in endpoints. No user/session row is inserted by the harness.
- The actual private API returns HTTP200 and an available inventory. Its six
  selected columns exist in the installed core `_plugin_state` schema. The four
  returned rows exactly match an independent SQLite read: `composer-members`,
  `composer-miniapps`, `composer-resend`, `composer-stacks`, each active at
  1.0.0 from build configuration. No settings, consent or plugin-storage field
  is returned. Native plugins remain explicitly unrated.
- The two curated exact releases retain their recorded DIDs, versions and CIDs.
  Their results are RED (local policy blocked) and AMBER (needs review), with
  no manufactured GREEN or publisher-maliciousness claim.
- Subscriber and creator sessions receive HTTP403; anonymous read gets HTTP401.
  A target override is HTTP400 and an installation-shaped POST is HTTP405.
- A fictional creator is promoted to administrator through the real native user
  API and can read (HTTP200). The operator then disables that account through
  the real disable API. Its **existing session** immediately receives HTTP401;
  the unaffected operator still receives HTTP200. This confirms the installed
  native authentication layer checks disabled status, rather than treating the
  handler's role check as sufficient by itself.
- The native page loads its actual inventory and evidence. Space opens the
  focused evidence disclosure. Desktop 1440×1000 and phone 390×844 are inspected
  in both modes using EmDash's actual theme button; document width stays within
  the viewport. The public read-only explanation is captured at 390px.
- There is no install/mutation button in the loaded evaluator. The four core
  plugin-state rows remain unchanged. No real plugin is installed, updated,
  enabled, disabled or uninstalled. The disabled record is a disposable local
  **user**, not a plugin or the real owner.

The expected HTTP400/405 negative probes produce the two recorded browser-console
resource messages. There are no page-script errors. The panel's rating text now
uses EmDash's semantic **text** danger/warning roles, not fill colours.
The inspected Policy blocked badge’s full-coverage foreground/background pixels
measure 6.20:1 in light and 7.02:1 in dark (`rating-contrast.json`); that measurement
does not certify every colour or the shell. The actual
native shell's dark sidebar still has low-contrast labels without the separately
published Brand Studio appearance; this receipt does not claim complete native
shell or assistive-technology acceptance.

## Reproduce and cleanup

Run `node docs/evidence/plugin-trust-native-20261025/run.mjs`. It creates one
owned root and uses the maintained admin fixture, then removes that root on
success or failure. No package installation occurs. Existing dependencies are
copied with APFS when necessary, and the copied `.astro` directory is removed
before startup so an inherited daemon lock cannot name the source server.

The first attempt exposed that copied-lock failure: `astro dev stop` followed a
copied `.astro/dev.json` and stopped the source's local 4341 preview. No source
files or production service changed. The narrow process guard now checks the
lock PID's actual working directory before any stop. Its real-child regression
proves a source process stays alive when its lock is copied into another app.
The final run uses this guard, has its own dynamic localhost port and confirms
owned-root removal in `cleanup.json`.

Checks rerun:

`node --test tests/plugin-trust.test.mjs tests/plugin-readiness.test.mjs tests/native-fixture-process.test.mjs`

12 pass, 0 fail. Root owns the normal full check/build and clean pushed-main
release. This receipt establishes neither production Access/MFA nor provider
entitlement, Worker Loader/sandbox installation, a signed native lifecycle,
physical devices or screen-reader acceptance.
