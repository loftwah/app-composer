# Local-first delivery profile and dependency refresh

Date: 7 November 2026. Issues:
[#319](https://github.com/loftwah/app-composer/issues/319),
[#321](https://github.com/loftwah/app-composer/issues/321).

## Production identity

- Composer source `d041f6900f63ef8eed0b1d144c866f922f991c75` (`d041f69`).
- Worker version `245bba21-3237-42b1-b756-9a6f23f884dc`.
- Released through `pnpm deploy` from clean pushed `main`. The guard ran the
  dependency audit, full `pnpm check`, production build, remote migrations and
  upload once, then passed live source and pinned services, sharing output,
  publication privacy and the anonymous administration boundary.
- `/build.json` returned the same commit during verification.

The prior production identity was `bbe9e224` / Worker `4c2683dd`.

## Dependency refresh (#321, Composer scope)

The workspace already held a staged, uncommitted refresh. It was completed,
validated and committed rather than discarded:

| Package | Before | After |
| --- | --- | --- |
| `astro` | 7.4.5 | 7.4.7 |
| `@astrojs/cloudflare` | 14.4.4 | 14.4.6 |
| `@astrojs/react` | 7.1.2 | 7.1.4 |
| `@lucide/astro` | 1.69.0 | 1.70.0 |
| `tailwindcss`, `@tailwindcss/vite` | 4.3.4 | 4.3.5 |
| `@cloudflare/workers-types` | 5.20261104.1 | 5.20261107.1 |

Node policy, EmDash `1.4.0`, Wrangler `4.152.0`, React `19.3.1`, TypeScript
`6.0.3` and every other reviewed pin were unchanged.

- A malformed `minimumReleaseAgeExclude` selector
  (`@cloudflare/workers-types@5.20261024.1 || 5.20261107.1`) was split into two
  exact entries.
- `pnpm install --frozen-lockfile`: lockfile passes supply-chain policies and is
  up to date (787 entries).
- `pnpm freshness`: 27 ok, 0 drift, 0 unknown, 0 unresolved.
- `pnpm audit --audit-level low`: no known vulnerabilities.
- Policy and remote freshness recorded `reviewed: 2026-11-07`; the remote
  snapshot observed `2026-11-07T10:28:35Z`.

Independent mini-app repositories were not touched. Their dependency batches
remain per-repository work with their own release guards.

## Init delivery profile (#319 slice)

Init now carries one delivery choice in the portable specification:

```json
"delivery": { "profile": "local", "runner": "" }
```

- `local` is the default and is also what an older specification validates to.
- `existing-runner` requires `jenkins`, `gitlab`, `buildkite` or `other`.
- A local profile with a named runner, an unknown profile, an unknown runner or
  an extra field is refused.
- The copy-to-agent handoff now carries the five runnable commands
  (`pnpm install --frozen-lockfile`, the local journey, `--candidate`,
  `--release`, `--verify`), the selected runner when one is chosen, and the
  preview caveats: a Version URL is not a sandbox; a deployed preview needs its
  own D1/R2/KV; no production service, route or cron bindings; Queue
  producers/consumers and Workflows are refused because they are unqualified.
- The handoff states that local green checks, a merged commit or a selected
  runner are not a production release or a verified journey.

## Checks that ran

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | clean, policies pass |
| `pnpm freshness` | 27 ok, 0 drift, 0 unknown, 0 unresolved |
| `pnpm audit --audit-level low` | no known vulnerabilities |
| `node --test tests/delivery-profile.test.mjs` | 3 passed |
| `node --test tests/delivery-profile.test.mjs tests/core.test.mjs tests/public-pages.test.mjs` | 17 passed |
| `node --test tests/freshness-policy.test.mjs tests/freshness-remote.test.mjs tests/node-runtime-policy.test.mjs tests/stack-status.test.mjs tests/delivery-profile.test.mjs` | 18 passed |
| `pnpm check:types` | 0 errors |
| `pnpm deploy` | all release gates passed |

The first `pnpm deploy` attempt correctly refused at type-check with four
`Spec.delivery` errors because the hand-written declaration file had not been
updated. No remote mutation occurred. After adding the declaration, the full
guard passed.

## Live browser verification

Fresh Chromium session against `https://composer.loftwah.com/init`.

- `/build.json` matched `d041f69`.
- The Delivery fieldset rendered with both options; default `local`, runner
  select hidden and disabled.
- Selecting `existing-runner` revealed the runner select and updated the
  preview note (`Delivery · existing runner: jenkins`), the help text and the
  exported specification (`"profile": "existing-runner"`). Switching the runner
  to GitLab updated the specification again.
- Returning to `local` hid the runner and exported
  `{ "profile": "local", "runner": "" }`.
- 1440 × 1000 and 390 × 844: document width equals viewport, so there is no
  horizontal overflow. One `h1` on the page.
- The only console error was the known CSP block of Cloudflare's injected
  Insights beacon; no application error.
- Screenshots: [desktop](init-delivery-desktop.png) and
  [phone](init-delivery-phone.png). The browser session prefers the dark theme.

## Remaining gates

### #319

- One real external runner run (Jenkins, GitLab CI, Buildkite or another
  existing host) that invokes the same commands and records run id, source,
  checks and result. Selecting a runner in Init is configured intent only.
- EmDash display of the selected runner versus local, what checks actually ran,
  commit, target, release result and independent verification.
- Honest offline, flaky-test, provider-uncertainty, idempotent-retry,
  revoked-credential and rollback-mismatch states on that surface.
- Approval/evidence separation so a changed artefact, account, environment,
  credential or policy cannot reuse an earlier approval.
- EKS path reuse of source/artefact/check metadata (#252).

### #321

- Independent mini-app repositories keep their own batches. LDraw's
  Playwright/React/Excalidraw coupling and TypeScript 7 remain separate
  qualified decisions.
- No cross-repository lockfile or central dependency engine was introduced.
