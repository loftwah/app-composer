# Appearance skin contract — evidence, 16 November 2026

Bounded acceptance for the design/design-system lane of
[#621](https://github.com/loftwah/app-composer/issues/621). It covers the
remaining #621 items (second skin and consumer, device-local sensory proof,
authorised save/reopen/publish/restore, fresh-agent recipe) and the adopted
mechanism from [#622](https://github.com/loftwah/app-composer/issues/622).
Release and issue closure stay outside this lane.

Branch: `codex/batch-design-1115`, based on origin/main `951b313`.

## What shipped

- **Contact sheet** is a second original skin beside Workshop press. It uses
  the same finite recipe compiler but prints top rules, squares fields and puts
  focus inside the control. Composer default is unchanged and emits no layer.
- The recipe catalogue and compiler moved to
  `src/lib/appearance-skin-catalogue.ts`; the runtime schema stays in
  `src/lib/appearance-skin.ts`. `src/styles/appearance-skins.generated.css` is
  generated from the catalogue and checked for staleness.
- The public `/appearance` page is the second consumer. It uses the same
  compiler and shared `SkinSpecimen` with its own storage keys and no publish
  path. It is a reference surface, not a theme editor.
- Brand Studio compares the published version with the saved draft through an
  accessible split wipe (`src/components/SplitCompare.tsx`), with a native range
  as the only control and an explicit text caption. This is the #622 adopted
  mechanism, reimplemented from Velora's MIT compare slider.
- Sensory feedback remains off by default and device-local. The off, on,
  reduced-motion and unsupported paths are proved in unit and browser runs.

## Commands and actual results

| Command | Result |
| --- | --- |
| `node --test tests/appearance-skin.test.mjs tests/admin-brand-skin.test.mjs` | **16 pass, 0 fail** — 6 contract tests and 10 admin/lifecycle/sensory tests |
| `node scripts/appearance-skins.mjs --check` | exit 0 — committed preview sheet matches the catalogue |
| `node benchmarks/runner.mjs --suites benchmarks/suites` | **20 pass, 0 fail, 0 blocked** — includes `appearance-skin` (7 checks), blueprint round-trip, live demo, sandbox save/reopen |
| `pnpm check` | exit 0 — **758 tests pass, 0 fail**; `astro check` reports 0 errors across 742 files; lint and format checks pass |
| `pnpm build` | exit 0 — client build, server build and publication guard passed (1,484 files, 150 archive members) |
| `node docs/evidence/appearance-skin-20261115/capture.mjs` | exit 0 — public page checks below, 15 captures |
| `node docs/evidence/brand-studio-20261025/capture.mjs` | exit 0 — 16 captures; native fixture checks below |

The admin replay creates one owned temporary fixture, removes Access/provider
bindings, uses a virtual passkey and removes its root on success and failure.
The public replay uses the local dev server at `127.0.0.1:4326`.

### Public `/appearance` browser checks (Chromium)

- 390×844, 1440×900 and 1728×1080; dark and light; both skins; no horizontal
  overflow.
- Native radio group moves with arrow keys; pressure reaches 4 with `End` and
  announces “Pressed — 4 of 4”; the sample field shows a visible focus outline.
- The chosen skin and pressure reopen after reload; reset clears them.
- The compare slider is a native range, moves with `ArrowLeft` and its
  `aria-valuetext` names both panes.
- Off path: both sensory preferences start unchecked; pressing reports that
  feedback is off.
- On path: after deliberate enablement one press produced two oscillator starts
  and one 12 ms vibration call.
- Reduced motion: the same press produced one tick and no vibration.
- Unsupported path: with `AudioContext` and `navigator.vibrate` removed, both
  preferences are disabled with the reason and the sample still works.
- Bundle impact of the public page: **6.2 kB** JavaScript and **5.6 kB** CSS
  (minified, uncompressed), from `dist/client/_astro`. No Zod or admin schema is
  in the public chunk.

### Authorised admin lifecycle (local native EmDash fixture)

The existing replay now also proves:

- keyboard-only choice of the second skin, then back to Workshop press;
- save → reload → still selected; published CSS carries the saved skin;
- restored history and default appearance;
- the published/saved-draft compare slider moves and announces its value;
- 390 px and doubled root text with no horizontal overflow;
- the existing unsafe-import refusal and per-request native config checks.

`admin-replay-receipt.json` records the runtime source hashes and every check.
`skin-390-light.png`, `studio-skin-panel-1440-light.png` and
`studio-compare-1440-dark.png` are the committed captures.

One run of this replay timed out after 30 seconds waiting for the native
overview heading, then passed unchanged on the immediate rerun. That is a
fixture timing flake, not a product result; the receipt and captures come from
the passing run.

### Fresh-agent recipe

- Harness: `codex exec`, codex-cli **0.145.0**, model **gpt-5.6-sol**, read-only,
  ephemeral, one owned temporary directory containing only `CONTRACT.md`.
- Prompt: produce one new valid recipe from the contract alone; no repository,
  skill or network access.
- Output: `pressed-folio`, validated by `normaliseAppearanceSkin()` and compiled
  at pressure 2. `fresh-agent-recipe.json`, `fresh-agent-output.txt` and
  `fresh-agent-receipt.json` record the exact input hash, output hash, prompt
  and limits.
- The receipt says the isolation claim is **partial**: the working directory was
  clean, but the Codex host still loads its own skills/config and no
  transcript-level isolation report exists. The recipe was validated, not
  shipped.

## Impeccable

- Resolved skill base: `/Users/deanlofts/.agents/skills/impeccable`.
- Engine version: **4.8.0** (`scripts/VERSION`).
- `impeccable context --target src/plugins/brand-studio-page.tsx` resolved
  `PRODUCT.md`, `DESIGN.md` and
  `.impeccable/surfaces/src-plugins-brand-studio-page-tsx.md`; it reported
  `MANUAL_DETECTOR_REQUIRED`.
- Playbooks applied: `reference/operate.md`, `reference/polish.md` and
  `reference/craft-floor.md`.
- Mechanical detector:
  `impeccable detect --json src/plugins/brand-studio-page.tsx src/components/SkinSpecimen.tsx src/components/SplitCompare.tsx src/components/AppearanceLab.tsx src/pages/appearance.astro`
  returned `[]` (no findings). The detector is not a substitute for the
  rendered inspection below.
- A structured interview was not possible in this subagent brief; the owner
  direction in #621/#622 and the incumbent Brand Studio surface were treated as
  the brief. That substitution is stated rather than presenting invented
  preferences.

## #622 source record

The five-source matrix, pinned commits, licence files and ADOPT/ADAPT/DEFER
decisions are in [the design harvest note](../../design-harvest-20261115.md).
Summary:

- **Velora UI** `2db06124…`, MIT — compare-slider mechanism **ADOPT (adapted)**,
  reimplemented; Velora Pro not used.
- **devl** `4484fc0…`, MIT — **DEFER**; no install or MCP call.
- **useLayouts** `b33d88b…`, MIT — **DEFER**; no animation copied.
- **uiux-orchestrator** `f9fa3ea…`, MIT for the original package; third-party
  skills separately licensed — **DEFER**; Impeccable already resolves locally.
- **MABTU** — **DEFER / reference only**; terms contain draft placeholders and
  screenshots belong to the sites; no account, key or API call.

## Proven

- Two visually distinct skins compile from one finite contract and render on the
  signed-in admin and the public reference.
- Default admin appearance and every older saved record still render, preview,
  restore and export unchanged.
- Local, authorised save → reopen → publish → restore with real SQLite and the
  native admin fixture, including published CSS.
- Keyboard use, both native themes, phone and laptop/desktop widths, reduced
  motion, and browsers without Web Audio or vibration.
- Off/on/unsupported sensory paths, including the deliberate enablement.
- A fresh Codex context can produce a schema-valid recipe from the written
  contract, with the isolation limits stated.
- The compare mechanism is wired to real saved versions, not a static mock.

## Not proven / remaining live gates

- **Production publish and live admin inspection.** The admin route still needs
  the owner's Cloudflare Access sign-in. Publishing was proved against the local
  native EmDash fixture with a virtual passkey, not against production.
- **Physical haptics.** No phone was used; vibration strength and iPhone Safari
  behaviour are unverified. Headless Chromium only.
- **Screen-reader speech.** Names, roles and value text were asserted through the
  accessibility tree, not by listening to VoiceOver/NVDA.
- **Owner acceptance and broader propagation.** No owner visual sign-off, no
  physical-device review, no portfolio-wide rollout.
- **#622 breadth.** The candidate intake UI, MABTU API adaptor, two-library
  composition and export recipe remain open; only the first adopted mechanism
  and its two consumers are covered here.
- **Bundle measurement scope.** The public page delta was measured from the
  build output; no memory, interaction-latency or low-power measurement was
  made.

## Files

- `src/lib/appearance-skin-catalogue.ts` — recipes, compiler, preview sheet.
- `src/lib/appearance-skin.ts` — runtime schema and normalisation.
- `src/lib/admin-brand-contract.ts` — saved record fields and skin layer.
- `src/components/SkinSpecimen.tsx`, `src/components/SplitCompare.tsx`,
  `src/components/AppearanceLab.tsx` — shared UI.
- `src/pages/appearance.astro` — public second consumer.
- `src/plugins/brand-studio-page.tsx` / `.css` — skin choices and compare.
- `scripts/appearance-skins.mjs`, `src/styles/appearance-skins.generated.css`.
- `tests/appearance-skin.test.mjs`, `tests/admin-brand-skin.test.mjs`.
- `benchmarks/suites/appearance-skin.mjs`.
- `docs/appearance-skin-contract.md`, `docs/design-harvest-20261115.md`,
  `docs/brand-studio.md`, `DESIGN.md`, `AGENTS.md`.
- `.impeccable/surfaces/src-plugins-brand-studio-page-tsx.md`.
- `docs/evidence/appearance-skin-20261115/` — this receipt, script, captures.
