# Plugin Trust Centre — direct installed-plugin review

Scoped #313 slice for the native EmDash **Plugin Trust Centre**. The installed
plugin review now leads the page: the selected plugin's name, installed version,
native/build-time comparison and supported review action are visible before the
registry links and the full inventory. The installed list becomes the selector
for another plugin, and the dated curated releases remain below unchanged.

Before this change the page opened with the header, registry links and a
four-row inventory where every row carried the same full action paragraph. The
page now has one selected review at a time and keeps the other rows as a compact
selection list.

## Release identity

| Item | Value |
| --- | --- |
| Source | `1948902c16ef602d85d6081cc90e4aed04303bab` |
| Worker version | `a12b9394-6dcc-40a1-8d4d-c7c89c600893` |
| Origin | `https://composer.loftwah.com` |
| Release path | clean pushed `main` → `pnpm deploy` |
| Live `/build.json` | matches the source |
| Stack status | deployed source `1948902c16ef` |

## What changed

- The lead **Installed plugin review** card shows the selected plugin's
  installed version and status, the existing native/build-time comparison, the
  supported review action and a primary link to the owning repository.
- The existing header still states `Composer production · administrator-only ·
  read-only`; the lead repeats that identity with the installed count and the
  inventory read time.
- The installed list is now a compact selector. Choosing a row or the dropdown
  changes the lead review and writes `?plugin=<id>` to the URL. Reloading that
  URL restores the same selection, and browser back is handled through the
  existing `popstate` path.
- The registry links, `What this comparison can and cannot prove`, all installed
  rows, the dated curated releases and the unqualified-installation section now
  follow the lead review.
- No API, permission, install, update, enable, disable or uninstall behaviour
  changed. No provider health was inferred.

The four reported plugins are `composer-members`, `composer-miniapps`,
`composer-resend` and `composer-stacks`; all reported `Installed 1.0.0`,
`active` and `Native / build-time`. The page makes no claim about registry
installation, signatures, provider permissions or current plugin price.

## Live verification

Measured in the existing authenticated Cloudflare Access owner session at
`1948902`, after switching theme with the native admin theme button. Positions
are viewport pixels from the top.

| Viewport | Theme | Status top | Action top → bottom | Selector top | Context top | Inventory top | First viewport | Horizontal overflow |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1440 × 1000 | light | 298 | 443 → 497 | 513 | 597 | 803 | yes | none (1440/1440) |
| 1440 × 1000 | dark | 298 | 443 → 497 | 513 | 597 | 803 | yes | none (1440/1440) |
| 390 × 844 | light | 396 | 618 → 671 | 687 | 772 | 1,073 | yes | none (390/390) |
| 390 × 844 | dark | 396 | 618 → 671 | 687 | 772 | 1,073 | yes | none (390/390) |

Keyboard focus: focusing the primary action, pressing `Shift+Tab` to the
previous control, then `Tab` back produced a visible
`2px solid rgb(199, 68, 0)` outline with a `3px` offset in light and
`2px solid rgb(252, 91, 5)` with a `3px` offset in dark.

Selection was exercised live:

- choosing `composer-stacks` changed the lead heading, dropdown value and
  highlighted row, and wrote `?plugin=composer-stacks`;
- reloading that URL restored `composer-stacks`;
- choosing `Review composer-members` from the list changed the lead to
  `composer-members` and wrote `?plugin=composer-members`.

Captures: [1440 light](overview-1440-light.png) · [1440 dark](overview-1440-dark.png) ·
[390 light](overview-390-light.png) · [390 dark](overview-390-dark.png). Exact
measurements are in [`metrics.json`](metrics.json).

The only console error is the existing Cloudflare Insights beacon blocked by the
admin Content Security Policy; no Plugin Trust API request failed.

## Release checks

- `pnpm deploy` ran `pnpm check`: 431 passed, 0 failed, 0 skipped.
- Publication guard: 1,290 files / 150 archive members inspected.
- Live source, pinned services, sharing output, publication privacy and the
  anonymous administration boundary passed.
- `/build.json` returned `200` with commit
  `1948902c16ef602d85d6081cc90e4aed04303bab`.

## Scope and remaining gates

This is one admin journey. It does not close #313 or claim screen-reader,
physical-device, zoom/reflow or every-admin-page acceptance. Registry
installation, plugin lifecycle, provider permissions and the existing
independent mini-app releases remain separate gates.
