# Workflows — direct task-first entry

Scoped #313 slice for the native EmDash **Workflows** journey. The page now
opens with one retained workflow state and the existing action that state
supports, followed by the mode explanation, secondary links, recipe editor and
full history. Before this change the page opened with scope text, secondary
links and a boundary paragraph; no workflow action appeared before the recipe
editor.

## Release identity

| Item | Value |
| --- | --- |
| Source | `8c1e272646485ef3be740a2aa92d6d59286e8744` |
| Worker version | `a18c4480-4187-4391-aae0-eed75997f273` |
| Origin | `https://composer.loftwah.com` |
| Release path | clean pushed `main` → `pnpm deploy` |
| Live `/build.json` | matches the source |
| Stack status | deployed source `8c1e27264648` |

## What changed

- A lead **Next** card selects the single most relevant real state from the
  existing snapshot:
  - a retryable needs-attention run shows its recipe, event, observation time
    and state, with the existing **Recheck source & retry** action and
    **Open result** when a result exists;
  - otherwise the latest finished run shows its result, with **Open result**
    and the existing **Scan now** option while its recipe is enabled;
  - otherwise an enabled recipe waiting for events leads with **Scan now**;
  - otherwise a paused recipe leads with its existing **Save & turn on**
    action.
- Sample runs never become the lead. They stay labelled in history because
  they are deterministic fictional activity, not the workspace's current
  state. Production currently has only sample runs and both recipes paused, so
  the live lead is **A summary after publication · Paused · Save & turn on**.
- The lead repeats workspace, role, environment and account context inline
  instead of the former standalone scope block.
- The mode/boundary explanation, secondary links, recipe editor, full recent
  run history and manual-copy fallback now follow the lead.
- The retry, scan and save calls reuse the existing `composer-workflows` action
  contract, routes, expected-revision checks and notices. No workflow
  execution, permission, persistence, route or deep-link behaviour changed.

The selection logic is `src/lib/workflow-lead.ts`; the page reuses the existing
`cw-*` styles and host theme tokens. The only new state is presentation.

## Live verification

Measured in the existing authenticated Cloudflare Access owner session
(`dean`, owner) at `8c1e272`, after switching theme with the native admin theme
button. Positions are viewport pixels from the top. Both themes were confirmed
by the resulting body background, not only by a stored preference.

| Viewport | Theme | Lead top → bottom | Title top | Action top → bottom | Meta top → bottom | Mode top | Editor top | History top | First viewport | Horizontal overflow |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1440 × 1000 | light | 241 → 592 | 305 | 415 → 459 | 537 → 559 | 612 | 799 | 1,338 | yes | none (1440/1440) |
| 1440 × 1000 | dark | 241 → 592 | 305 | 415 → 459 | 537 → 559 | 612 | 799 | 1,338 | yes | none (1440/1440) |
| 390 × 844 | light | 330 → 842 | 390 | 554 → 598 | 726 → 813 | 862 | 1,244 | 2,849 | yes | none (390/390) |
| 390 × 844 | dark | 330 → 842 | 390 | 554 → 598 | 726 → 813 | 862 | 1,244 | 2,849 | yes | none (390/390) |

Keyboard focus: focusing **Refresh** and pressing `Tab` once reached the lead
action. Its visible outline was `2px solid rgb(199, 68, 0)` with a `3px` offset
in light and `2px solid rgb(252, 91, 5)` with a `3px` offset in dark, at both
viewports.

The lead action was not exercised against production workflow data: the live
workspace has no real runs and both recipes are paused, and this slice does not
create a run or change execution state. The existing **Save & turn on** action
was left ready rather than toggled. The four selection branches are covered by
focused contract tests.

Captures: [1440 light](overview-1440-light.png) · [1440 dark](overview-1440-dark.png) ·
[390 light](overview-390-light.png) · [390 dark](overview-390-dark.png). Exact
measurements and capture hashes are in [`metrics.json`](metrics.json).

The only console error is the existing Cloudflare Insights beacon blocked by
the admin Content Security Policy; no workflow API request failed.

## Release checks

- `pnpm check:fast -- tests/workflow-lead.test.mjs`: types, semantic lint,
  format and 8 focused tests passed.
- `pnpm deploy` ran `pnpm check`: 447 passed, 0 failed, 0 skipped.
- Publication guard: 1,290 files / 150 archive members inspected.
- Live source, pinned services, sharing output, publication privacy and the
  anonymous administration boundary passed.
- `/build.json` returned `200` with commit
  `8c1e272646485ef3be740a2aa92d6d59286e8744`.
- Stack status showed deployed source `8c1e27264648`.

## Scope and remaining gates

This is one admin journey. It does not close #313 or claim screen-reader,
physical-device, browser zoom/reflow or every-admin-page acceptance. It does
not add a runner, schedule, automatic retry, provider health claim or second
dashboard, and it changes no workflow permission or persisted record. Guestbook
release, composition promotion and the #412 mutation remain separate work.
