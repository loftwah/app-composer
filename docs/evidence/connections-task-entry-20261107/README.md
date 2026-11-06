# Connections — direct task-first entry

Scoped #313 slice for the native EmDash **Connections** journey. The page now
opens with the selected connection, its current status and the supported check
action. Workspace, role, environment and account stay visible in the lead card.
The boundary explanation, encrypted-storage check and full connection facts
follow below.

Before this change the page opened with a metadata scope block and a boundary
paragraph; the check action sat after the guestbook fact list, below the first
390 × 844 viewport. No route, permission, contract or provider behaviour
changed.

## Release identity

| Item | Value |
| --- | --- |
| Source | `1e24b43cee258fee1b74677b5bda3a290867a1f6` |
| Worker version | `13ff7fe8-2c60-44ac-9e97-cf99c2361a1a` |
| Origin | `https://composer.loftwah.com` |
| Release path | clean pushed `main` → `pnpm deploy` |
| Live `/build.json` | matches the source |

## What changed

- A lead **Selected connection** card shows `Owned visitor books`, its status,
  the existing note, the primary `Check an owned visitor-book read` action and
  the selected workspace/role/environment/account context.
- `Refresh metadata` remains available in the page header.
- The hosting boundary, encrypted-settings check and the full per-connection
  facts and dependency detail now follow the lead action.
- The old standalone scope block was removed because the same context now lives
  in the lead card. Its metadata time moved into a disclosure in that card.
- The connection section names use level-three headings under a
  `Connection detail` heading. The page reuses the existing `cn-*` page styles,
  host theme tokens and focus treatment; no new palette or component system was
  added.

## Live verification

Measured in the existing authenticated Cloudflare Access owner session at
`1e24b43`, after switching theme with the native admin theme button. Positions
are viewport pixels from the top.

| Viewport | Theme | Status top | Action top → bottom | Context top → bottom | Boundary top | First viewport | Horizontal overflow |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| 1440 × 1000 | light | 260 | 369 → 413 | 425 → 448 | 579 | yes | none (1440/1440) |
| 1440 × 1000 | dark | 260 | 369 → 413 | 425 → 448 | 579 | yes | none (1440/1440) |
| 390 × 844 | light | 380 | 532 → 594 | 606 → 696 | 823 | yes | none (390/390) |
| 390 × 844 | dark | 380 | 532 → 594 | 606 → 696 | 823 | yes | none (390/390) |

Keyboard focus: focusing the primary action, pressing `Shift+Tab` to
`Refresh metadata`, then `Tab` back produced a visible
`2px solid rgb(199, 68, 0)` outline with a `3px` offset in light and
`2px solid rgb(252, 91, 5)` with a `3px` offset in dark.

The action itself was exercised in production. The lead status changed from
`Not verified` to `Owned-resource read verified`, the note updated, and the
detail recorded outcome `passed` with matched source
`5075d7be53b43aca288d3707fd06851aca91e8c2`. This is a read of one owned
resource; it writes nothing and does not verify provider permissions or
credential expiry. Reloading returns the page to its unpersisted
`Not verified` metadata state.

Captures: [1440 light](overview-1440-light.png) · [1440 dark](overview-1440-dark.png) ·
[390 light](overview-390-light.png) · [390 dark](overview-390-dark.png) ·
[checked at 390 light](checked-390-light.png). Exact measurements are in
[`metrics.json`](metrics.json).

One incidental console error remains: the Cloudflare Insights beacon is blocked
by the existing admin Content Security Policy. It is unrelated to Connections
and no admin API failed.

## Release checks

- `pnpm deploy` ran `pnpm check`: 431 passed, 0 failed, 0 skipped.
- Publication guard: 1,290 files / 150 archive members inspected.
- Live source, pinned services, sharing output, publication privacy and the
  anonymous administration boundary passed.
- `/build.json` returned `200` with commit
  `1e24b43cee258fee1b74677b5bda3a290867a1f6`.

## Scope and remaining gates

This is one admin journey. It does not close #313 or claim screen-reader,
physical-device, zoom/reflow or every-admin-page acceptance. It also does not
change credential lifecycle, provider permissions or owner email transport.
