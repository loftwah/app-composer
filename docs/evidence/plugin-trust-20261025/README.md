# Plugin Trust Centre implementation — 25 October 2026

Base: `473b8b9` (`loftwah/app-composer`). Owning issues: #365 / #369. This is a read-only implementation over the already collected [dated registry evidence](../../research/2026-10-25/365-plugin-trust-readiness.md), not a new marketplace or installation service.

The normalized, bounded snapshot in `src/data/plugin-trust-20261025.json` carries two exact release identities and their inspection receipts. It contains no publisher prose, executable code, personal inventory or credentials. The native administrator page shows exact package/release/profile identity, inspected permissions/hosts, digest, declared compatibility, index and observation dates, evidence gaps and reasons. Freeform is policy-blocked for unrestricted egress; Stripe needs review for writes and restricted network requests. Neither label accuses a publisher of malicious behaviour. No advisory feed or native lifecycle receipt exists, so no overall Green is possible. Evidence older than 14 days or marked failed-refresh becomes Unknown while retaining adverse reasons.

The private handler reads only six allowlisted `_plugin_state` columns in this selected production installation. Native/config plugins are explicitly unrated, query failure is unavailable rather than empty, and no write or target override exists. EmDash remains responsible for signed-record verification, permission consent and lifecycle operations. Owner exceptions, live refresh, advisory coverage and installed/candidate manifest comparison are outside this first slice.

## Validation

- `node --test tests/plugin-trust.test.mjs`: 11 tests pass. Negative cases cover forged identity/digest, withdrawal labels, incompatible/unknown ranges, stale/failed evidence, unmatched inspection receipts, no manufactured Green, unsafe links and injected/oversize snapshot input, anonymous/editor/write/origin/environment denial, private query failure, allowlisted reads, and no source-only installation-ready promotion.
- `pnpm check:types`: 0 errors, 0 warnings (63 pre-existing hints).
- `pnpm build`: passes; publication guard 1,267 files / 150 archive members. Existing bundle-size warning remains.
- `node scripts/plugin-readiness.mjs --environment production --json` and the same for `preview`: both `not-configured`. D1 DB, R2 MEDIA and exported PluginBridge are declared; registry, runner and LOADER are missing. Preview bindings are selected independently, with no inheritance from production. The command makes no network/provider call, evaluates no configuration code and reads no secret file.
- Component/browser harness: 390px and 1440px, dark/light, actual keyboard disclosure/focus and API failure → Retry → recovery pass. All four pages have no horizontal overflow. These rendered captures were inspected visually. This harness exercises the actual React component and read handler with one synthetic inventory row; it does **not** exercise native EmDash authentication, Access, an installation or production.

Reproduce component captures using an existing installed Playwright module and Chromium binary:

```sh
PLAYWRIGHT_MODULE=/absolute/existing/playwright/index.mjs \
CHROMIUM_PATH=/absolute/existing/chromium \
node docs/evidence/plugin-trust-20261025/capture.mjs
```

The harness owns one temporary root, registers cleanup before work, closes its browser/server and removes that root on success/failure. It reuses the repository's existing esbuild and Playwright; no dependency is installed. Bounded screenshots/receipt remain under ignored `output/plugin-trust-20261025/`. No owner project, browser profile, database, provider or credential was touched.

## Native integration interface

The shared integration owner adds these declarations to the existing `composer-stacks` plugin, without adding a plugin:

```ts
// src/lib/creator-plugin.ts
import { managePluginTrust } from "./plugin-trust.ts";
// admin.pages
{ path: "/plugin-trust", label: "Plugin Trust Centre", icon: "shield-check" }
// routes
pluginTrustRead: {
  methods: ["GET"], permission: "plugins:manage",
  handler: (ctx) => managePluginTrust(ctx, runtime),
}

// src/plugins/stacks-admin.tsx
import { PluginTrustPage } from "./plugin-trust-page";
// pages map
"/plugin-trust": PluginTrustPage,
```

The handler returns data and throws EmDash's `PluginRouteError` for denials. The native dispatcher supplies the API envelope, HTTP error status and private no-store policy. `apiFetch` and `parseApiResponse` use that supported contract. The public `/plugin-trust` explanation exposes no installed inventory or policy exception.

## Exact remaining installation gates

No plugin has been installed, updated, disabled or uninstalled. Composer production remains unchanged by this lane. A real lifecycle exercise needs an explicitly authorised isolated application with independent storage, a reviewed exact release, configured sandbox runner and Worker Loader, actual Workers Paid / Dynamic Workers entitlement and an authenticated administrator. Source declarations and a virtual/browser fixture prove none of those provider/identity facts. No production IdP, provider, entitlement or resource change was attempted.

Official APIs rechecked on 25 October 2026: [native React pages](https://docs.emdashcms.com/plugins/creating-native-plugins/react-admin/), [registry queries](https://docs.emdashcms.com/plugins/registry-client/), [sandbox configuration](https://docs.emdashcms.com/deployment/plugin-sandbox/), [installation](https://docs.emdashcms.com/plugins/installing/). The two official package links were opened successfully; both still show the selected versions. The installed implementation inspected is EmDash 1.3.1 / Cloudflare adapter 1.3.1 / Astro 7.4.2.
