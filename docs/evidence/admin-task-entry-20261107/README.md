# Needs attention — direct task-first entry

Scoped #313 slice for the native EmDash **Needs attention** journey. The page now
opens with the retained problem and its primary action, then the scope controls.
Before this change the 390-wide first viewport showed the heading and scope bar;
the first action started below the fold.

## Release identity

| Item | Value |
| --- | --- |
| Source | `0d031e3a26c286b2ecf3da8de7b2950de296cbff` |
| Worker version | `09ae01b9-14e6-4058-bec6-e08356f6e802` |
| Release path | clean pushed `main` → `pnpm deploy` |
| Live `/build.json` | matches the source |

## What changed

- The lead **Next** card renders before the workspace/environment/app scope.
- The card keeps a compact `workspace · environment · Change scope` context line
  beside the action, so the scope remains discoverable without preceding the task.
- The full scope controls stay on the page with an `#co-scope` target and a
  scroll margin; changing scope still uses the same server-confirmed selection.

No route, permission, data or publishing behaviour changed.

## Live verification

Measured on the deployed page in an authenticated owner session. Both themes were
confirmed by the admin theme button and the resulting body background, not only by
a stored preference.

| Viewport | Theme | Next top | Action top → bottom | Scope top | First viewport | Horizontal overflow |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 1440 × 1000 | dark | 208 | 393 → 445 | 586 | yes | none (1440/1440) |
| 1440 × 1000 | light | 208 | 393 → 445 | 586 | yes | none (1440/1440) |
| 390 × 844 | dark | 223 | 526 → 578 | 715 | yes | none (390/390) |
| 390 × 844 | light | 223 | 526 → 578 | 715 | yes | none (390/390) |

Before the change, at 390 × 844 the Next card started at 604 and the primary
action at 907, below the 844 first viewport. After the change the action is at 526.

Keyboard focus: the primary action was reached with a `Shift+Tab` then `Tab`
sequence. Its visible focus outline measured `2px solid rgb(252, 91, 5)` in dark
and `2px solid rgb(199, 68, 0)` in light, with a `3px` offset. The `Change scope`
link stays next to the action.

Captures: [1440 dark](overview-1440-dark.png) · [1440 light](overview-1440-light.png) ·
[390 dark](overview-390-dark.png) · [390 light](overview-390-light.png). Exact
measurements are in [`metrics.json`](metrics.json).

## Release checks

- `pnpm check`: 431 passed, 0 failed, 0 skipped.
- Publication guard: 1,290 files / 150 archive members inspected.
- Live source, pinned services, sharing output, publication privacy and anonymous
  administration boundary all passed in the guarded deploy.

## Scope and remaining gates

This is one admin journey. It does not close the wider #313 epic or claim
screen-reader, physical-device, zoom/reflow or every-admin-page acceptance.
#316's authenticated production owner check now covers settings, Mini-app
catalogue content, media, Creator stacks, Plugin Trust, Stack status, Brand
Studio, Incident Desk and the mini-app admin at EmDash 1.4.0; its earlier
Access-only gate is no longer the blocker.
