# Design harvest reference — 15 November 2026

Bounded answer to [#622](https://github.com/loftwah/app-composer/issues/622):
five named sources inspected, one mechanism adopted in a real saved Composer
workflow, and one independent second consumer. This note records provenance,
licence and the decision. It authorises no bulk import, no component marketplace,
no second design system and no paid account.

Inspection date: 15 November 2026. The live pages and the primary repository
licence files were read directly. Nothing below was installed, executed or
copied into the product.

## Source decisions

| Source | Pinned source | Licence, from the primary source | Mechanism worth learning | Platform fit | Accessibility / performance cost | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| [grayxcviii/uiux-orchestrator](https://github.com/grayxcviii/uiux-orchestrator) | `f9fa3eab75568b6562b46978e22a1349ab247057`, [LICENSE](https://github.com/grayxcviii/uiux-orchestrator/blob/f9fa3eab75568b6562b46978e22a1349ab247057/LICENSE), [THIRD_PARTY_NOTICES](https://github.com/grayxcviii/uiux-orchestrator/blob/f9fa3eab75568b6562b46978e22a1349ab247057/THIRD_PARTY_NOTICES.md) | MIT for the original package. The 47 specialist skills are separately licensed upstream. | Route an existing design review through explicit design/UX/motion/review roles and require source/quality evidence. | Skill/orchestration only; no runtime dependency. | None at runtime. The real cost is review time and installing third-party instructions with their own terms. | **DEFER.** Impeccable 4.8.0 already resolves in this harness and the review lane used it. Installing 47 skills globally would duplicate it and cross Woodhouse #268's ownership. |
| [devl](https://devl.dev) | `sean-brydon/devl.dev` @ `4484fc08d1a461c08772b74612e1a2b5f725dcfd`, [LICENSE](https://github.com/sean-brydon/devl.dev/blob/4484fc08d1a461c08772b74612e1a2b5f725dcfd/LICENSE) | MIT repository and registry. Individual items declare their own npm and coss UI dependencies. | Split-shell workbench, filter bar and run-replay arrangements that keep an agent's real state visible. | React/Tailwind/coss UI; would need adaptation to Astro islands and EmDash's native chrome. | Every item brings Tailwind/coss UI and often Motion; the visual weight is not the cost, the dependency and review surface is. | **DEFER.** Useful for #603/Studio layout work, but this slice's saved workflow is Brand Studio and adding a second kit would not prove the skin contract. No install or MCP call was made. |
| [Velora UI](https://velora.colorlib.com) | `ColorlibHQ/velora-ui` @ `2db06124f44196264d89354cba1a8013ea151066`; files read: `src/components/velora/compare-slider.tsx`, `src/content/components/compare-slider/meta.json`, `public/r/compare-slider.json`; [LICENSE](https://github.com/ColorlibHQ/velora-ui/blob/2db06124f44196264d89354cba1a8013ea151066/LICENSE) | MIT for the free source. **Velora Pro is separately paid and was not used.** | A before/after wipe whose only control is a native range input, with a clipped layer and an `aria-hidden` painted divider. No dependencies. | Framework-neutral behaviour; reimplemented as a Composer React component instead of importing Next/Tailwind source. | None beyond the component: no animation, no library, keyboard and screen-reader behaviour come from the native range. | **ADOPT (adapted).** It directly improves a real appearance decision: comparing the published version with the saved draft before publishing. Reimplemented, not copied. |
| [useLayouts](https://uselayouts.com) | `iurvish/uselayouts` @ `b33d88bb787867d1c2d2db89ca175855c6daf01e`, [LICENSE](https://github.com/iurvish/uselayouts/blob/b33d88bb787867d1c2d2db89ca175855c6daf01e/LICENSE) | MIT repository; the live site's structured data also states MIT. | Create-menu, accessible action and active collection patterns with deliberate press/undo states. | React + Motion + Tailwind. Motion is the point of most items, so it is a poor fit for a quiet admin form. | Animation and gesture handling would need a reduced-motion path and touch testing for every item; not justified by this slice. | **DEFER.** The useful press/undo idea belongs to #617's behaviour lane. No install, no copied animation. |
| [MABTU](https://mabtu.com) | Public pages only; no repository. [MCP/API](https://mabtu.com/mcp), [pricing](https://mabtu.com/pricing), [terms](https://mabtu.com/terms), inspected 15 November 2026. | **Unknown/unverified for reuse.** Terms explicitly prohibit bulk scraping/resale; screenshots belong to the sites shown; the visible terms still carry draft placeholders (`[COMPANY NAME]`, `[ADDRESS]`, `[CONTACT EMAIL]`). | Reference shelf: page type, palette, font pairing and section structure as research cues. | Research only. A key-bearing MCP URL would be a secret and no account/key was created. | No runtime cost because nothing is ingested. The cost is legal uncertainty while the terms are drafts. | **DEFER / reference only.** No screenshots or page structures were copied, no API call was made, and no paid plan is implied. A future adaptor needs clear terms and an owner decision. |

Source counts and prices were not treated as acceptance evidence. No "free"
badge on a gallery licenses the screenshots or the underlying sites.

## The adopted mechanism

**Accessible split comparison**, adapted from Velora's free compare slider.

- Component: `src/components/SplitCompare.tsx`. A native `<input type="range">`
  covers the frame and is the only control. Arrow keys, Home and End work without
  custom key handling. The painted divider is `aria-hidden`; the panes are
  presentational copies; a visible caption and `aria-valuetext` say which exact
  versions are on each side.
- No animation, no dependency, no pointer-only path. The wrapper adds
  pointer-drag as a convenience; the range still owns the value.
- It was reimplemented against Composer's own tokens and markup. No Velora
  source, class names, Tailwind configuration or artwork is present.

### Consumer 1 — Brand Studio, real saved state

Brand Studio (`src/plugins/brand-studio-page.tsx`) compares:

- the **published version** from the saved `composer.admin-brand/1` record, and
- the **saved draft** revision,

using the actual compiled skin layer for each version. The comparison is
read-only; it cannot publish, restore or edit. The existing text diff remains and
continues to name each changed field. This is a real saved workflow: the values
come from D1 through the existing authorised `brandRead`/`brandWrite` path, and
the full save → reopen → publish → restore lifecycle is exercised against real
SQLite in `tests/admin-brand-skin.test.mjs`.

### Consumer 2 — public `/appearance` reference

`src/pages/appearance.astro` and `src/components/AppearanceLab.tsx` compare
Composer default with the skin chosen on that device. The choice is saved under
`composer:appearance-lab:v1`; it never touches the admin record, never publishes
and never implies an owner decision. The same `SplitCompare` component and the
same `SkinSpecimen` component are used, which is the portability proof.

## What this does not establish

- No paid Velora Pro, MABTU plan, devl service or third-party account was used.
- No upstream component was installed or vendored. The only adopted mechanism is
  an original reimplementation under MIT-compatible terms; no notice needs to be
  redistributed because no source is copied.
- MABTU's terms are not final and its screenshots are not licensed for reuse.
- Visual similarity is not the acceptance test. The comparison is wired to real
  saved versions and its control is keyboard/screen-reader operable.
- Broad portfolio adoption, a design harvesting UI and MABTU API integration
  remain #622 work; this slice covers the five-source decision and the first
  adopted consumer pair only.

## Evidence

- `tests/appearance-skin.test.mjs` — recipe and compile checks.
- `tests/admin-brand-skin.test.mjs` — real SQLite save → reopen → publish →
  restore, sensory off/on/unsupported paths.
- `benchmarks/suites/appearance-skin.mjs` — the existing #601 runner path.
- `docs/evidence/appearance-skin-20261115/` — browser and fresh-agent receipts.
- [Appearance skin contract](appearance-skin-contract.md) — the recipe a new
  consumer or agent implements.
