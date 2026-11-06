# Backlog continuation 3 — 6 November 2026

Third delivery batch for the 6 November backlog. It completes the executable
parts of #316 that do not require a production owner session: explicit remote
freshness, native EmDash Stack status, and a local native-admin compatibility
probe. #316 stays open because production Cloudflare Access authentication was
not available in this environment.

## Release identity

| Item | Value |
| --- | --- |
| Source | `edfd9faae5437efe92378d67931254f772ea110c` |
| Worker version | `250bfcfa-2606-4452-972c-338d600efed3` |
| Origin | `https://composer.loftwah.com` |
| Release path | clean pushed `main` → `pnpm deploy` |
| Live `/build.json` | same source commit, verified after release |

Exact fields and command outcomes are in [`release.json`](release.json).

## Remote freshness — opt-in only

`pnpm freshness` is unchanged: local files only, no network, exit codes 0/1/2/3.
`pnpm freshness:remote` is the explicit registry mode:

- compares each locked version with the official npm registry;
- classifies `security-urgent`, `unsupported`, `breaking-major`,
  `feature-opportunity`, `compatible-patch`, `current` or `unknown`;
- sends only public package names and locked versions, with no paths, project
  data, credentials or environment values;
- bounds requests to 8 s and two retries by default, with a maximum of 60 s and
  five retries;
- treats unreachable, malformed, mismatched, older-than-locked or unsupported
  version responses as `unknown` with the reason, never as a fabricated
  `latest`;
- exits `4` only when an advisory names a locked version; an ordinary build is
  never failed by an unavailable registry;
- writes the dated report to `config/dependency-remote.json` for Stack status.

Focused tests: `node --test tests/freshness-policy.test.mjs
tests/freshness-remote.test.mjs tests/stack-status.test.mjs` → 13 passed, zero
skipped. They use a local fake registry (including an advisory response) and
cover success, malformed JSON/objects, an unreachable port, a mismatched package
name, an unsupported version, an older dist-tag, and a bounded 503 retry.

Live read-only observation on the released source:

```text
pnpm freshness
Summary: 27 ok, 0 drift, 0 unknown, 0 unresolved

node scripts/freshness.mjs --remote --json
17 current, 3 patch, 4 feature, 1 breaking, 0 security, 0 unsupported, 0 unknown
Advisory lookup: available
```

The one breaking major is TypeScript 7.0.2. The reviewed policy stays on 6.0.3
because `@astrojs/check` peers on `^5 || ^6`; Stack status shows that exact
policy note instead of recommending a floating upgrade.

## Native Stack status

The existing `composer-stacks` plugin now has a **Stack status** page at
`/_emdash/admin/plugins/composer-stacks/stack-status` and the administrator-only
`stackStatusRead` route. It is generated at build time and makes no registry or
provider request:

- installed `node_modules` version, deployed lockfile version and latest tested
  policy version are separate columns;
- Node and pnpm policy, policy review date and generated snapshot time are shown;
- the deployed source commit comes from the same build identity as `/build.json`;
- the registry snapshot date, source and age are shown; missing, malformed or
  older-than-14-days reports become `unknown` with the reason;
- blockers are limited to security advisories, unsupported deployed versions,
  breaking majors, policy gaps and runtime gaps; patch/minor releases are shown
  as available releases, not warnings;
- no install, update, pin change, deployment or credential access is available
  from the page.

Local native-admin probe at source `edfd9fa`, EmDash 1.4.0, using the existing
fictional fixture and a virtual passkey (not production Access):

| Surface | Observation |
| --- | --- |
| `stackStatusRead` | `200`; snapshot `attention`, 25 packages, registry `available` |
| Stack status page | rendered; installed/deployed/latest-tested, Node/pnpm policy, review date and TypeScript blocker present |
| Settings | `200`, h1 `Settings` |
| Media | `200`, h1 `Media Library` |
| Creator stacks | `200`, h1 `Creator stacks` |
| Plugin Trust Centre | `200`, h1 `Plugin Trust Centre` |
| Brand Studio | `200`, h1 `Brand Studio` |
| Incident Desk | `200`, h1 `Incident Desk` |

The fixture intentionally has no content collections, so content management was
not exercised there; production content remains behind Access. See
[`stack-status-native.json`](stack-status-native.json) and the
[1440 dark capture](stack-status-native-1440-dark.png).

## Live checks

| Check | Result |
| --- | --- |
| `/build.json` | `200`, commit `edfd9faae5437efe92378d67931254f772ea110c` |
| Public routes `/`, `/discover`, `/guide`, `/setup`, `/init`, `/learn`, `/catalogue`, `/s/fictional-trail-notes`, `/s/fictional-launch-board`, `/capabilities.json`, `/plugin-trust` | all `200` |
| Mounted Guestbook/Showcase `/build.json` | `200`; both match `composition.lock.json` |
| Standalone Guestbook/Showcase `/build.json` | `200`; newer independent releases, as expected; not the Composer pins |
| Admin page, plugin API, users API, setup API | `302` to `https://jolly-cake-2b85.cloudflareaccess.com/cdn-cgi/access/login/composer.loftwah.com` |
| Sharing output | deploy verifier passed 1200 × 630 JPEG, declared and actual dimensions |
| Publication privacy | 22 probes, all expected absent/public outcomes, no findings |
| Anonymous administration boundary | deploy verifier passed |

## #316 gate

#316 is not closed. The executable acceptance items are met:

- EmDash and its Cloudflare adapter are on the same 1.4.0 release;
- Node 22.23.4/24.22.1/26.13.0 policy remains reviewed and tested;
- the remote freshness command detects new releases, advisories, unsupported
  versions and fake/unreachable responses without breaking a build;
- deployed source/version is pinned and Stack status is live.

The remaining gate is an actual **authenticated production Cloudflare Access
owner session** for settings, content, media, plugin pages and EmDash MCP/plugin
compatibility. This environment reached the Access login page but had no owner
credential or session, so that interaction is not claimed. The local native
passkey fixture proves the plugin pages at 1.4.0 but is explicitly not Access
proof. The independent mini-app batches remain #321's separate releases.

## Commands and cleanup

- `pnpm deploy` ran `pnpm check` → 431 passed, 0 failed, 0 skipped; then `pnpm build`
  → publication guard 1,290 files / 150 archive members; then migrations, upload,
  live source/pinned-service, sharing, publication-privacy and anonymous-admin
  checks.
- Focused tests and the local fixture were run before release; no dependency was
  updated in this batch.
- Owner zip was moved aside only for the clean-release guard and restored:
  `sha256:f542b8318b5f49a4f75639948d28ece6357f957ccac25c6f280209bd0dd2c3ce`.
- The owned fixture root was removed with `prepare-fixture.mjs --clean`; the
  release staging root was removed by the deploy wrapper. No owned temporary
  root remains.
