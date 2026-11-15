// Runtime validation for the appearance-skin catalogue.
//
// Kept separate from the recipes and compiler so a public consumer can import
// the catalogue without shipping Zod or the administration's schema.
import { z } from "zod";
import {
  appearanceSkinRecipes,
  compileAppearanceSkin,
  skinActions,
  skinEdges,
  skinFields,
  skinFocuses,
  skinPlates,
  skinPressures,
  skinRadii,
  type AppearanceSkinRecipe,
} from "./appearance-skin-catalogue.ts";

export * from "./appearance-skin-catalogue.ts";

const text = z
  .string()
  .trim()
  .min(2)
  .max(72)
  .regex(/^[^<>\u0000-\u001f\u007f]+$/);

/** The exact schema a fresh agent must satisfy. Every field is required:
 * defaults would let an incomplete recipe look reviewed. */
export const appearanceSkinRecipe = z
  .object({
    schema: z.literal("composer.appearance-skin/1"),
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]{2,29}$/)
      .refine((id) => id !== "composer", "The default skin is not a recipe."),
    name: text,
    description: text,
    plate: z.enum(skinPlates),
    edge: z.enum(skinEdges),
    radius: z.enum(skinRadii),
    field: z.enum(skinFields),
    action: z.enum(skinActions),
    focus: z.enum(skinFocuses),
    pressure: z.enum(skinPressures),
  })
  .strict();
/** Validate a recipe exactly as a reviewer would: the shared schema plus the
 * two rules the schema cannot say on its own — a unique id and a documented
 * compile. Throws with the first useful problem. */
export function normaliseAppearanceSkin(value: unknown): AppearanceSkinRecipe {
  const recipe = appearanceSkinRecipe.parse(value);
  const duplicate = appearanceSkinRecipes.find(
    (entry) => entry.id === recipe.id,
  );
  if (duplicate) throw new Error(`The skin id "${recipe.id}" is already shipped.`);
  compileAppearanceSkin(recipe, 2);
  return recipe;
}


