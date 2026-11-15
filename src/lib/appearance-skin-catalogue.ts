// Composer's portable appearance-skin contract.
//
// A skin is a finite, reviewed recipe, not a stylesheet an owner or an imported
// file can write. The recipe selects from measured treatments; the compiler
// turns that selection into ordinary Composer tokens and edges. Both consumers
// (the signed-in administration and a public specimen) compile the same parts,
// so a saved skin cannot look one way in Brand Studio and another way in a
// published surface.
//
// Adding a skin means adding one recipe to the catalogue, regenerating the
// preview sheet and running the focused checks. The validator lives in
// appearance-skin.ts so a browser consumer can import the catalogue alone.
// Nothing in a skin can carry user text, a URL, an image, a font, an animation
// or an authority change.
export const skinPlates = ["none", "inset"] as const;
export const skinEdges = ["hairline", "inline", "top"] as const;
export const skinRadii = ["square", "soft"] as const;
export const skinFields = ["outline", "underline"] as const;
export const skinActions = ["outline", "ridge"] as const;
export const skinFocuses = ["ring", "inset"] as const;
/** Where the measured 1–4px weight is visible: the panel edge, the field
 * border, or both. Focus always follows the same measured weight. */
export const skinPressures = ["edge", "field", "both"] as const;

export type SkinPlate = (typeof skinPlates)[number];
export type SkinEdge = (typeof skinEdges)[number];
export type SkinRadius = (typeof skinRadii)[number];
export type SkinField = (typeof skinFields)[number];
export type SkinAction = (typeof skinActions)[number];
export type SkinFocus = (typeof skinFocuses)[number];
export type SkinPressure = (typeof skinPressures)[number];

/** The exact recipe shape. The runtime schema in appearance-skin.ts checks it;
 * keeping the type here lets a public consumer import the catalogue alone. */
export interface AppearanceSkinRecipe {
  schema: "composer.appearance-skin/1";
  id: string;
  name: string;
  description: string;
  plate: SkinPlate;
  edge: SkinEdge;
  radius: SkinRadius;
  field: SkinField;
  action: SkinAction;
  focus: SkinFocus;
  pressure: SkinPressure;
}

export const workshopPress: AppearanceSkinRecipe = {
  schema: "composer.appearance-skin/1",
  id: "workshop-press",
  name: "Workshop press",
  description:
    "A set-back panel plate, heavier rules and a firmer press",
  plate: "inset",
  edge: "inline",
  radius: "square",
  field: "outline",
  action: "ridge",
  focus: "ring",
  pressure: "both",
};

/** The second original skin proves the contract is portable. A contact sheet
 * frames panels with a printed top rule instead of setting them into a plate;
 * it is still the same orange/neutral Composer world, not a second brand. */
export const contactSheet: AppearanceSkinRecipe = {
  schema: "composer.appearance-skin/1",
  id: "contact-sheet",
  name: "Contact sheet",
  description:
    "Printed top rules, square fields and a quiet caption line",
  plate: "none",
  edge: "top",
  radius: "square",
  field: "outline",
  action: "outline",
  focus: "inset",
  pressure: "edge",
};

export const appearanceSkinRecipes = [workshopPress, contactSheet] as const;

/** Composer default is deliberately not a recipe: it emits no layer at all. */
export const skinIds = [
  "composer",
  ...appearanceSkinRecipes.map((recipe) => recipe.id),
] as const;
export type SkinId = (typeof skinIds)[number];

export const skinPressureNames = ["Quiet", "Set", "Firm", "Pressed"] as const;
export const skinDefaults = { skin: "composer", skinPressure: 2 } as const;

/** Owner-facing choices. Kept beside the recipes so a public consumer does not
 * need the admin validation module or its schema. */
export const appearanceSkinChoices = [
  {
    id: "composer",
    name: "Composer default",
    description: "Warm surfaces, orange actions, quiet rules",
  },
  ...appearanceSkinRecipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
  })),
] as const;
export function appearanceSkinName(skin: SkinId): string {
  return appearanceSkinChoices.find((item) => item.id === skin)!.name;
}

export function skinRecipe(skin: SkinId) {
  return appearanceSkinRecipes.find((recipe) => recipe.id === skin) ?? null;
}

export interface SkinParts {
  /** Custom properties, placed on the skin root. */
  tokens: string;
  /** Root edge, e.g. the inline frame around the whole administration. */
  root: string;
  /** A panel/surface inside the root. */
  panel: string;
  /** Text fields, selects and textareas. */
  field: string;
  /** Ordinary actions. */
  action: string;
  /** The pressed action. */
  actionActive: string;
  /** Visible keyboard focus. */
  focus: string;
}

const radius = { square: "2px", soft: "8px" } as const;

/** Compile one recipe at one pressure. Pressure only changes measured edge
 * weight (1-4px). It never changes colour, type, layout or behaviour. */
export function compileAppearanceSkin(
  recipe: AppearanceSkinRecipe,
  pressure: number,
): SkinParts {
  if (!Number.isInteger(pressure) || pressure < 1 || pressure > 4)
    throw new Error("Edge pressure must be a whole number from 1 to 4.");
  const press = `${pressure}px`;
  const rule = "color-mix(in srgb, currentColor 18%, transparent)";
  const strongRule = "color-mix(in srgb, currentColor 34%, transparent)";
  const plate = "color-mix(in srgb, currentColor 4%, transparent)";
  const edge =
    recipe.edge === "inline"
      ? `border-inline:${
          recipe.pressure === "field"
            ? "1px"
            : "var(--composer-skin-press)"
        } solid var(--composer-skin-rule)`
      : "";
  const panel = [
    recipe.plate === "inset"
      ? "background:var(--composer-skin-plate);box-shadow:inset 0 0 0 1px var(--composer-skin-rule)"
      : "",
    recipe.edge === "top"
      ? `border-block-start:${
          recipe.pressure === "field"
            ? "1px"
            : "var(--composer-skin-press)"
        } solid var(--composer-skin-rule-strong)`
      : "",
    recipe.edge === "hairline"
      ? "border-block-start:1px solid var(--composer-skin-rule)"
      : "",
  ]
    .filter(Boolean)
    .join(";");
  const field =
    recipe.field === "underline"
      ? "border-width:0 0 var(--composer-skin-press);border-radius:0;background:transparent;box-shadow:none"
      : `border-radius:var(--composer-skin-radius);${
          recipe.pressure === "edge"
            ? "border-width:1px"
            : "border-width:var(--composer-skin-press)"
        }`;
  const action =
    recipe.action === "ridge"
      ? "border-radius:var(--composer-skin-radius);box-shadow:0 1px 0 var(--composer-skin-rule)"
      : "border-radius:var(--composer-skin-radius)";
  return {
    tokens: `--composer-skin-press:${press};--composer-skin-rule:${rule};--composer-skin-rule-strong:${strongRule};--composer-skin-plate:${plate};--composer-skin-radius:${radius[recipe.radius]}`,
    root: edge,
    panel,
    field,
    action,
    actionActive:
      recipe.action === "ridge"
        ? "box-shadow:inset 0 1px 0 var(--composer-skin-rule)"
        : "",
    focus:
      recipe.focus === "inset"
        ? "outline-width:var(--composer-skin-press);outline-offset:2px"
        : "outline-width:var(--composer-skin-press)",
  };
}

const declarations = (value: string) => (value ? `${value}` : "");

/** The administration's versioned stylesheet layer. Scope and token scope are
 * parameters so a second consumer can compile the same parts without a second
 * grammar. `#admin-root` remains the shipped administration scope. */
export function appearanceSkinCss(
  recipe: AppearanceSkinRecipe,
  pressure: number,
  {
    scope = "#admin-root",
    tokenScope = "html[data-theme]",
  }: { scope?: string; tokenScope?: string } = {},
): string {
  const parts = compileAppearanceSkin(recipe, pressure);
  const lines = [
    `${tokenScope}{${parts.tokens}}`,
    parts.root ? `${scope}{${declarations(parts.root)}}` : "",
    parts.panel
      ? `${scope} :is(.co-overview,.composer-workflows,.composer-connections,.ce-inbox,.ca-stacks){${parts.panel}}`
      : "",
    parts.field
      ? `${scope} :is(input,textarea,select){${parts.field}}`
      : "",
    parts.action ? `${scope} button{${parts.action}}` : "",
    parts.actionActive ? `${scope} button:active{${parts.actionActive}}` : "",
    parts.focus ? `${scope} :focus-visible{${parts.focus}}` : "",
  ];
  return `${lines.filter(Boolean).join("\n")}\n`;
}

/** The finite public preview sheet, generated from the recipes. It is applied
 * only under `[data-composer-skin]`, so no page inherits a skin by accident and
 * no owner string enters CSS. */
export function appearanceSkinPreviewCss(): string {
  const blocks: string[] = [];
  for (const recipe of appearanceSkinRecipes) {
    for (let pressure = 1; pressure <= 4; pressure += 1) {
      const parts = compileAppearanceSkin(recipe, pressure);
      const root = `[data-composer-skin="${recipe.id}"][data-composer-pressure="${pressure}"]`;
      const rules = [
        `${root}{${parts.tokens}}`,
        parts.root ? `${root}{${parts.root}}` : "",
        parts.panel
          ? `${root} .skin-specimen-panel{${parts.panel}}`
          : "",
        parts.field
          ? `${root} :is(input,textarea,select){${parts.field}}`
          : "",
        parts.action ? `${root} button{${parts.action}}` : "",
        parts.actionActive
          ? `${root} button:active{${parts.actionActive}}`
          : "",
        parts.focus ? `${root} :focus-visible{${parts.focus}}` : "",
      ];
      blocks.push(rules.filter(Boolean).join("\n"));
    }
  }
  return `${blocks.join("\n\n")}\n`;
}

/** One-line, human-readable policy used by docs and tests. */
export const appearanceSkinPolicy = [
  "A skin changes edge weight, radius and surface treatment only.",
  "Labels, order, actions, permissions, colour roles and type scale stay unchanged.",
  "No animation, sound, image, font, URL or imported CSS belongs to a skin.",
  "Composer default emits no layer; every saved record without a skin renders it.",
  "Pressure is a whole number from 1 to 4 and only sets measured edge weight.",
] as const;
