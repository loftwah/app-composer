# Tactile skin reference note — 15 November 2026

Composer-owned, bounded slice for [#621](https://github.com/loftwah/app-composer/issues/621).
Records which parts of an external expressive-UI reference were studied, what
was built, and what was deliberately left out. It authorises no portfolio-wide
redesign, no shared theme engine and no new release gate.

## Source pin

- [shuding/spec-01](https://github.com/shuding/spec-01) at
  [`b8f91b6646d9280d9de8e0f5b2c6453cb4f237cb`](https://github.com/shuding/spec-01/tree/b8f91b6646d9280d9de8e0f5b2c6453cb4f237cb),
  MIT, inspected 15 November 2026 (upstream last push 14 November 2026).
- Files read: `registry/hardware/ui/hardware.tsx`,
  `registry/hardware/ui/hardware/tokens.css`, `registry/hardware/ui/slider.tsx`
  and `registry/hardware/lib/sound.ts`.
- Licence terms: MIT. Only mechanisms were studied. No SPEC-01 source, CSS
  tokens, component API, sound design, artwork or screen layout is copied into
  Composer, so the MIT notice is not redistributed.
- Issue context: #621 asks for study of the mechanisms, explicitly not a visual
  clone, not a second theme editor and not compulsory sound or haptics.

## What this slice actually shipped

Brand Studio gains one optional skin, **Workshop press**, as a saved
`composer.admin-brand/1` setting (`skin`, `skinPressure`). It renders through
the existing versioned appearance path: save draft → saved preview → publish →
restore. The default skin is unchanged Composer branding, and every record saved
before this change normalises to it.

## ADOPT

- **A scoped skin layer over unchanged semantics.** SPEC-01 scopes its look
  under `[data-skin="hardware"]` while the controls keep their own roles. Here
  the skin is a finite CSS layer emitted from the saved record; it changes
  edges, radius, inset rules and focus weight. No label, order, action or
  permission changes, and no markup is swapped.
- **Deliberate, remembered sensory opt-in.** `sound.ts` ties each haptic to a
  matching cue and remembers muting. Composer keeps a device-local preference
  (off by default) and never enables feedback on behalf of the next
  administrator.
- **Locally synthesised, gesture-bound earcons.** No audio files, no autoplay,
  no listeners on the document.

## ADAPT

- **Fixed brand palette instead of a derived key colour.** `tokens.css` derives
  a whole palette from one OKLCH key. Composer's palette and mark are fixed by
  [design commitments](../DESIGN.md), so the skin varies only edge weight (1–4) and
  a plate tint mixed from `currentColor`, which keeps both native themes legible
  without inventing a second brand.
- **Two-part press, reduced.** SPEC-01 separates down and release sounds for
  keyboard-like keys. The plate plays a 24 ms tick then a 16 ms settle; reduced
  motion keeps the direct tick and drops the settle and the vibration.
- **`navigator.vibrate` only, and only when reported.** No custom haptic
  component, no inferred device capability. Unsupported browsers get a disabled
  control with the reason stated, not a silent no-op.

## DEFER

- **Typing, hover and navigation sounds.** An administration form must stay
  quiet; per-keystroke audio is noise, and hover audio needs document-wide
  listeners this slice refuses.
- **The 61-component kit, device shells and the dial/slider SDK.** The existing
  native EmDash controls already carry the behaviour; a component kit would be
  the "new theme engine" #621 rules out.
- **Key-colour derivation, glow and lamp roles, P3 colour.** The approved
  direction avoids glows and gradients as decoration, and a colour picker is
  outside #353's finite palette.
- **Physical haptics acceptance.** No supported physical device was exercised.
  Chromium here exposes `navigator.vibrate`, but whether a real phone vibrates,
  and how strongly, is unverified. iPhone Safari does not implement it.

## See also

- [Brand Studio](brand-studio.md) — the owning surface, its persistence and
  release boundaries.
- `tests/admin-brand-skin.test.mjs` — normalisation, CSS bounds, preference and
  save/reopen coverage.
- `docs/evidence/brand-studio-20261025/capture.mjs` — replay including the skin,
  keyboard range, phone and doubled-text reflow.
