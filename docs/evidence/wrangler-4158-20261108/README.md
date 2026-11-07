# Get Ready on Wrangler 4.158.0 — 8 November 2026

Issue: [#321](https://github.com/loftwah/app-composer/issues/321). This removes
the last deliberate Composer dependency hold recorded in continuation 18.

## Production identity

- Composer source `4092c2f59c1fd6f03e891dcfadb7b1636de7c15a` (`4092c2f`).
- Worker version `1a1df1b7-65ec-4997-91a2-80aab6a0e9e4`.
- Released through `pnpm deploy` from clean pushed `main`: dependency audit,
  full `pnpm check` (487 passed, 0 failed, 0 skipped), production build, remote
  migrations, upload and every live gate passed.
- `/build.json` returned the same commit.

The prior release was `0f95ada` / `04a3866a`. A first deploy attempt was
refused before upload because three promotion-boundary tests still built a
synthetic Wrangler package at `4.152.0`; the fixture was corrected in `4092c2f`
and the complete check then passed. No remote mutation occurred on the failed
attempt.

## What moved

| Surface | Before | After |
| --- | --- | --- |
| Workspace `wrangler` | 4.152.0 | **4.158.0** |
| `lib/get-ready/local.mjs` exact check | 4.152.0 | 4.158.0 |
| `lib/get-ready/local-checks.mjs` exact check | 4.152.0 | 4.158.0 |
| Get Ready MCP preparation evidence | 4.152.0 | 4.158.0 |
| Readiness and promotion fixtures | 4.152.0 | 4.158.0 |
| Dependency policy and remote snapshot | `^4.152.0` | `^4.158.0`, reviewed 2026-11-07 |
| Current operator docs | 4.152.0 | 4.158.0 |

The mini-app lane already exercised Wrangler 4.158.0 in Guestbook, Linkarooie,
Hello, Carry / forward, Link Check, Launch Kit, Paperwork, LDraw and the
starter. This change lets Get Ready run the same tested release instead of
pinning the older one.

Historical records (`docs/research/`, dated evidence, lab fixtures and their
locks) keep their original versions on purpose. They describe runs at those
versions, not the current pin.

## Checks that ran

| Check | Result |
| --- | --- |
| `node --test tests/readiness-state.test.mjs tests/core.test.mjs tests/readiness-report.test.mjs` | 23 passed |
| `node --test tests/readiness-engine.test.mjs tests/readiness-owned-tools.test.mjs tests/readiness-mcp.test.mjs tests/readiness-target.test.mjs tests/readiness-storage.test.mjs tests/readiness-package.test.mjs tests/freshness-policy.test.mjs` | 61 passed |
| `node --test tests/promotion-boundary.test.mjs tests/local-secret-precedence.test.mjs` | 7 passed |
| `pnpm check:types` | 0 errors |
| `pnpm freshness` | 27 ok, 0 drift, 0 unknown, 0 unresolved |
| `pnpm freshness:remote` | Wrangler `current`; one TanStack feature and TypeScript 7 breaking-major remain separately recorded |
| `pnpm deploy` | full check 487/487, build, migrations, upload and live gates passed |
| Live `/downloads/get-ready-core.tgz` | 0 occurrences of `4.152.0`, 4 occurrences of `4.158.0` |
| Live `/build.json` | `4092c2f…` |

## Remaining gates

- The native **Stack status** admin page renders the generated status, which
  reads the installed version and now records 4.158.0 as declared, installed,
  latest tested and supported. The automation browser used for this run had no
  Cloudflare Access session, so the signed-in admin page was **not** re-opened
  and is not claimed. Owner action: open
  `/_emdash/admin/plugins/composer-stacks/stack-status` in the signed-in Chrome
  session and confirm Wrangler 4.158.0.
- TanStack Router remains pinned to the EmDash admin's exact version.
  TypeScript 7 remains a separate major qualification.
- Physical devices, screen readers and provider-account operations remain
  separate gates.
