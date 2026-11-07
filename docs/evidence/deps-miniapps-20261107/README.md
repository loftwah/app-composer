# First-party mini-app dependency batch — 7 November 2026

Issue: [#321](https://github.com/loftwah/app-composer/issues/321). This is the
independent-repository lane. Composer's own batch is recorded in
[`delivery-profile-20261107`](../delivery-profile-20261107/README.md); each
mini-app keeps its own repository, lockfile, guards and release boundary.

## Shipped revisions and live identities

| App | Commit | Worker version | Live identity | Checks that ran |
| --- | --- | --- | --- | --- |
| Guestbook | `1761ce1` | `a855b32f-778e-492b-8076-cb770fca19c8` | `guestbook.loftwah.com` revision matches | `pnpm check`, `pnpm build`, guarded `pnpm deploy` |
| Linkarooie (showcase) | `a497be9` | `8815d489-eab8-4c14-96f3-7af646b9c198` | `showcase.loftwah.com` revision matches | `pnpm check`, `pnpm build`, guarded `pnpm deploy` |
| Hello World | `c8cb770` | `61aece91-c50d-4588-a551-a19141a981bb` | `ready.loftwah.com` commit matches | `pnpm check`, `pnpm build`, guarded `pnpm deploy` |
| Carry / forward (state) | `30f106d` | `a4bfa115-6b8e-4f6a-bab0-4ae7f24115a2` | `ai.loftwah.com` commit matches | `pnpm check` (29), `pnpm build`, guarded `pnpm deploy` |
| Link Check | `cd63cf5` | `62e60482-07c0-4f9c-8b28-dc39c97b3298` | `share.loftwah.com` sha matches | `pnpm check` (103), `pnpm build`, guarded `pnpm deploy` |
| Launch Kit | `7070796` | `10ea9103-7099-4c09-956f-d4acee1dabcd` | `release.json` sourceSha matches | `pnpm check` (35), `pnpm build`, guarded `pnpm deploy` |
| Paperwork | `5e5f8c3` | `1a437fac-891d-47f4-9308-09c326707435` | `paperwork.loftwah.com` sha matches | `pnpm check` (41), `pnpm build`, guarded `pnpm deploy` |
| LDraw | `1803e60` | `12dd430d-cfa8-4ddd-a0cf-be8a5109115e` | `ldraw.loftwah.com` source matches | `pnpm check` (67, 1 skip), `pnpm build`, fresh `pnpm qualify` (14 browser checks), guarded `pnpm deploy` |
| Ready example (starter) | `aa5037d` | not deployed | template only | `pnpm test` (5) |

## What changed

- Wrangler 4.143.1/4.152.0 → **4.158.0** in every repository that declares it.
- `@cloudflare/workers-types` → **5.20261107.1** (state also regenerated its
  Wrangler-managed `worker-configuration.d.ts`; the only additions are the new
  default module declarations).
- Link Check: Effect **4.0.6 → 4.1.2**; the typed failure, timeout and runtime
  safety cases in its 103-test suite pass.
- Launch Kit, Paperwork and LDraw: Playwright **1.65.0**.
- Paperwork: `pdfjs-dist` **6.5.438**, Vite **8.3.6**.
- LDraw: Vite **8.3.6**, Model Context Protocol client/server **2.4.0**.
- Tailwind, React and TypeScript were already current in these repositories.

## Deliberate holds

| Package | Held at | Reason |
| --- | --- | --- |
| TypeScript | `6.0.3` | 7.0.2 is a major; the toolchain that consumes it needs its own qualified batch. |
| React / React DOM / types | `18.3.1` in LDraw | `@excalidraw/excalidraw@0.18.1` is the installed native editor contract. React 19 needs a compatible Excalidraw upgrade and a real editor/render regression run. |
| Composer Wrangler | `4.152.0` | Get Ready runs that exact Wrangler; re-pinning `lib/get-ready` and its fixtures is a separate Composer change. The mini-apps have no such coupling, so they moved. |

## Repair made while upgrading

Launch Kit's profile test pinned the Chromium major (`/^151\./`). Playwright
1.65 reports `158.0.8127.18`. The assertion now checks an actual four-part
Chromium version instead of one Playwright release. The test's intent — the
local renderer really ran — is unchanged.

## Verified scope and remaining gates

Live `/build.json` (or `/release.json` for Launch Kit) was read after each
release and matched the pushed commit. LDraw's deploy runs the repository's own
fresh qualification at the exact source; that record is in its deploy output.
Physical touch, screen-reader use and human visual acceptance remain separate
general gates and were not claimed here. No Composer composition pins or app
data were changed by this batch.
