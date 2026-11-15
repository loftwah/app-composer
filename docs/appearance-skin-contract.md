# Composer appearance-skin contract

Reviewed 15 November 2026. Owners: [#621](https://github.com/loftwah/app-composer/issues/621)
(design/sensory) and [#353](https://github.com/loftwah/app-composer/issues/353)
(Brand Studio). Release evidence stays in #11.

This is the whole contract for a Composer skin. An owner or a fresh agent can
read this page, write one recipe and know whether it is valid without reading
the Brand Studio plugin first. It is a **reference for adding a skin**, not an
instruction file an imported record can execute.

## What a skin can change

A skin is a finite treatment over the existing native EmDash administration and
the public sample surface. It may change:

- panel surface treatment (none or a set-back plate);
- panel edge (hairline, inline frame or printed top rule);
- corner treatment (square or soft);
- field and action edges;
- the weight of the measured edge, from 1 to 4px;
- where the visible focus ring sits.

It must not change labels, order, actions, permissions, colour roles, type
scale, layout, icons, content, credentials or release authority. It contains no
animation, sound, haptics, image, font, URL or imported CSS. Sound and haptics
are a separate device-local preference described below; they are never part of
a saved skin.

Composer default is **not** a recipe: it emits no layer at all, so every record
saved before skins existed keeps rendering exactly as it did.

## The recipe

One JSON object, exactly these fields and no others:

```json
{
  "schema": "composer.appearance-skin/1",
  "id": "quiet-ledger",
  "name": "Quiet ledger",
  "description": "Hairline panels and underlined fields for a dense ledger",
  "plate": "none",
  "edge": "hairline",
  "radius": "square",
  "field": "underline",
  "action": "outline",
  "focus": "inset",
  "pressure": "field"
}
```

| Field | Allowed values | Meaning |
| --- | --- | --- |
| `schema` | `composer.appearance-skin/1` | The only supported recipe version. |
| `id` | `^[a-z][a-z0-9-]{2,29}$`, unique, not `composer` | Stable saved value. It is also the CSS attribute value. |
| `name` | 2–72 plain-text characters | Shown to the owner in Brand Studio. |
| `description` | 2–72 plain-text characters | One useful sentence; no marketing claims. |
| `plate` | `none`, `inset` | `inset` mixes a 4% current-colour plate and a 1px inset rule into panels. |
| `edge` | `hairline`, `inline`, `top` | `inline` frames the whole surface; `top` prints a rule above each panel; `hairline` uses a 1px top rule. |
| `radius` | `square`, `soft` | 2px or 8px. Corners only. |
| `field` | `outline`, `underline` | `underline` removes the side and top border; the bottom border carries the measured weight. |
| `action` | `outline`, `ridge` | `ridge` adds a 1px bottom rule and an inset pressed state. |
| `focus` | `ring`, `inset` | `inset` moves the focus outline 2px inside the control. |
| `pressure` | `edge`, `field`, `both` | Where the 1–4 weight is measured. Focus always follows the same weight. |

The name, description and id are data, never CSS. The compiler emits only the
declarations listed here.

## Pressure

`skinPressure` is a whole number from 1 to 4. It maps to 1px, 2px, 3px or 4px
and appears in the owner-facing labels **Quiet, Set, Firm, Pressed**. It never
changes colour, spacing scale, type or control order.

## Saved record

The existing `composer.admin-brand/1` record gains two optional fields:

```json
{ "skin": "contact-sheet", "skinPressure": 3 }
```

Older records omit both and normalise to `{ "skin": "composer", "skinPressure": 2 }`.
The fields are validated with the same Zod schema as every other appearance
field. No second table, theme store or migration is involved.

Unknown ids, unknown recipe fields, out-of-range pressure, HTML in a label and a
duplicate id are refused. A saved record never carries CSS. The runtime schema
and `normaliseAppearanceSkin()` live in `src/lib/appearance-skin.ts`, which
re-exports the catalogue; a browser consumer imports the catalogue alone.

## Compile targets

The shared compiler in `src/lib/appearance-skin-catalogue.ts` produces the same parts for
both consumers:

- the signed-in administration stylesheet, scoped to `#admin-root` and versioned
  by the existing saved-version route;
- a public preview sheet, scoped to `[data-composer-skin][data-composer-pressure]`.

Both use `--composer-skin-press`, `--composer-skin-rule`,
`--composer-skin-rule-strong`, `--composer-skin-plate` and
`--composer-skin-radius`. Either consumer can be inspected without the other.

## Add a skin

1. Add one recipe to `appearanceSkinRecipes` in
   `src/lib/appearance-skin-catalogue.ts`.
2. Run `node scripts/appearance-skins.mjs --write` to regenerate
   `src/styles/appearance-skins.generated.css`.
3. Run `node --test tests/appearance-skin.test.mjs tests/admin-brand-skin.test.mjs`
   and `node benchmarks/runner.mjs --suites benchmarks/suites`.
4. Inspect the sample at 390px and a laptop width, in light and dark, keyboard
   only, with reduced motion. Confirm no horizontal scroll and a visible focus
   ring on fields, the action and the checkbox.
5. Add the new name to the owner-facing copy only through the recipe; do not
   rename or reorder an existing action.

A new recipe that merely looks different does not qualify: the sample controls
must stay usable and readable in both themes, and the compiled sheet must stay
under 12 kB for the whole set.

## Optional press feedback

Sound and haptics are deliberately **not** part of a skin record.

- Both are off until the person enables them on that device.
- They are stored under `composer:brand-studio:sensory:v1` in the admin and
  `composer:appearance-lab:sensory:v1` on the public reference, so the two
  surfaces never write each other's choice.
- Only the labelled sample action plays them. There is no autoplay, no typing
  sound and no document-wide listener.
- Sound uses a short locally synthesised triangle tick. Haptics use
  `navigator.vibrate` only when the browser reports it.
- With `prefers-reduced-motion: reduce`, the settle tick and the vibration are
  removed; the direct visual pressed edge remains.
- A browser without Web Audio or vibration keeps every control, shows the
  reason next to the disabled preference and never claims a cue played.
- Audible cues never carry information that the visible state does not.

## Verification commands

```sh
node --test tests/appearance-skin.test.mjs tests/admin-brand-skin.test.mjs
node scripts/appearance-skins.mjs --check
node benchmarks/runner.mjs
```

The focused tests prove: recipe validation, unique ids, a finite CSS grammar,
distinct skins, admin/public compile parity, old records normalising, the
generated sheet staying current, the full local save → reopen → publish →
restore lifecycle against real SQLite, and the off/on/unsupported sensory paths.

## Fresh-agent exercise

A fresh agent was given **only this document** and asked to produce one valid
recipe it does not ship. The result is committed as
`docs/evidence/appearance-skin-20261115/fresh-agent-recipe.json` and validated by
the `appearance-skin` benchmark suite. The exercise does not install the agent,
grant it repository access or treat its output as owner approval.

## See also

- [Brand Studio](brand-studio.md) — the owning surface, persistence and release
  boundary.
- [Tactile skin reference](tactile-skin-20261115.md) — the SPEC-01 study and the
  mechanisms deliberately left out.
- [Design harvest](design-harvest-20261115.md) — the five reviewed sources and
  the compare-slider decision.
- `/appearance` — the public sample that consumes the same compiler.
