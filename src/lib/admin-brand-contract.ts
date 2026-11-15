import { z } from "zod";

const label = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[^<>\u0000-\u001f\u007f]+$/);
export const brandTarget = z
  .object({
    account: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
    app: z.literal("composer"),
    environment: z.enum(["production", "preview"]),
  })
  .strict();
export const brandSkins = ["composer", "workshop-press"] as const;
export type BrandSkin = (typeof brandSkins)[number];
export const adminBrandSkins = [
  {
    id: "composer",
    name: "Composer default",
    description: "Warm surfaces, orange actions, quiet rules",
  },
  {
    id: "workshop-press",
    name: "Workshop press",
    description: "A set-back panel plate, heavier rules and a firmer press",
  },
] as const;
export function brandSkinName(skin: BrandSkin): string {
  return adminBrandSkins.find((item) => item.id === skin)!.name;
}
/** Edge pressure 1–4. Finite labels keep the saved value readable. */
export const skinPressureNames = ["Quiet", "Set", "Firm", "Pressed"] as const;
export const adminBrandConfig = z
  .object({
    schema: z.literal("composer.admin-brand/1"),
    target: brandTarget,
    siteName: label,
    footerLabel: label,
    mark: z.literal("composer-approved"),
    palette: z.literal("composer-orange"),
    density: z.enum(["comfortable", "compact"]),
    typeScale: z.enum(["standard", "large"]),
    // Optional in composer.admin-brand/1. Records saved before the Workshop
    // press slice have neither field and keep the Composer default skin.
    skin: z.enum(brandSkins).default("composer"),
    skinPressure: z.number().int().min(1).max(4).default(2),
  })
  .strict();
export type AdminBrandConfig = z.infer<typeof adminBrandConfig>;
export type BrandTarget = z.infer<typeof brandTarget>;
export const approvedMark = "/brand/composer-icon-20261022b-96.png";
export const approvedFavicon = "/brand/composer-icon-20261022b.svg";
export const brandDefaults = (target: BrandTarget): AdminBrandConfig => ({
  schema: "composer.admin-brand/1",
  target,
  siteName: "App Composer",
  footerLabel: "App Composer",
  mark: "composer-approved",
  palette: "composer-orange",
  density: "comfortable",
  typeScale: "standard",
  skin: "composer",
  skinPressure: 2,
});
/** One validation path for both new input and stored version rows. Missing
 * skin fields from earlier composer.admin-brand/1 records take the current
 * defaults, so every retained version stays readable and restorable. */
export function normaliseAdminBrandConfig(value: unknown): AdminBrandConfig {
  const schema =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { schema?: unknown }).schema
      : undefined;
  if (schema !== "composer.admin-brand/1")
    throw new Error("Unsupported Composer appearance record.");
  return adminBrandConfig.parse(value);
}
export const brandVersion = z
  .object({
    version: z.number().int().positive(),
    config: adminBrandConfig,
    event: z.enum(["draft", "publish", "rollback"]),
    actor: z.string().min(1).max(128),
    createdAt: z.string().max(40),
  })
  .strict();
export const brandSnapshot = z
  .object({
    ok: z.literal(true),
    target: brandTarget,
    revision: z.number().int().min(0),
    draft: adminBrandConfig,
    publishedVersion: z.number().int().positive().nullable(),
    published: adminBrandConfig.nullable(),
    history: z.array(brandVersion).max(25),
  })
  .strict();
export type BrandVersion = z.infer<typeof brandVersion>;
export type BrandSnapshot = z.infer<typeof brandSnapshot>;

/** Compare only supported appearance fields; scope can never be imported away.
 * Edge pressure is reported only when the Workshop press skin is in play, so
 * the review never claims a visible change the saved skin ignores. */
export function compareAdminBrand(
  before: AdminBrandConfig,
  after: AdminBrandConfig,
) {
  const pressure = (config: AdminBrandConfig) =>
    `${skinPressureNames[config.skinPressure - 1]} (${config.skinPressure} of 4)`;
  const fields = [
    {
      key: "siteName",
      label: "Admin name",
      format: (c: AdminBrandConfig) => c.siteName,
    },
    {
      key: "footerLabel",
      label: "Footer label",
      format: (c: AdminBrandConfig) => c.footerLabel,
    },
    {
      key: "density",
      label: "Spacing",
      format: (c: AdminBrandConfig) => c.density,
    },
    {
      key: "typeScale",
      label: "Text size",
      format: (c: AdminBrandConfig) => c.typeScale,
    },
    {
      key: "mark",
      label: "Identity mark",
      format: (c: AdminBrandConfig) => c.mark,
    },
    {
      key: "palette",
      label: "Palette",
      format: (c: AdminBrandConfig) => c.palette,
    },
    {
      key: "skin",
      label: "Skin",
      format: (c: AdminBrandConfig) => brandSkinName(c.skin),
    },
    {
      key: "skinPressure",
      label: "Edge pressure",
      format: pressure,
      used: (c: AdminBrandConfig) => c.skin === "workshop-press",
    },
  ];
  return fields
    .filter((field) => {
      if (field.used && !field.used(before) && !field.used(after)) return false;
      return field.format(before) !== field.format(after);
    })
    .map((field) => ({
      key: field.key,
      label: field.label,
      before: field.format(before),
      after: field.format(after),
    }));
}

export const adminReadingPresets = [
  {
    id: "everyday",
    name: "Everyday",
    description: "Comfortable spacing, standard text",
    density: "comfortable",
    typeScale: "standard",
  },
  {
    id: "reading",
    name: "Room to read",
    description: "Comfortable spacing, larger text",
    density: "comfortable",
    typeScale: "large",
  },
  {
    id: "focused",
    name: "Focused work",
    description: "Compact spacing, standard text",
    density: "compact",
    typeScale: "standard",
  },
] as const;

/** Finite CSS grammar. User text and imported strings never enter CSS. */
export function adminBrandCss(config: AdminBrandConfig): string {
  const fontSize = config.typeScale === "large" ? "18px" : "16px";
  const rhythm = config.density === "compact" ? "16px" : "24px";
  return `html[data-theme]{--color-kumo-brand:#c74400;--color-kumo-brand-hover:#a63a00;--color-kumo-focus:#c74400;--text-color-kumo-brand:#c74400;--text-color-kumo-link:#c74400;--kumo-button-emphasis-bg:#c74400;--kumo-button-emphasis-ring:#c74400;font-size:${fontSize};--composer-admin-rhythm:${rhythm}}
html[data-theme][data-mode="dark"]{--color-kumo-focus:#fc5b05;--text-color-kumo-brand:#fc5b05;--text-color-kumo-link:#fc5b05}
#admin-root :is(.co-overview,.composer-workflows,.composer-connections,.ce-inbox,.ca-stacks){padding:var(--composer-admin-rhythm)}
#admin-root :is(input,textarea,select){font-size:max(16px,1rem)}
#admin-root :focus-visible{outline:2px solid var(--color-kumo-focus);outline-offset:3px}
${brandSkinCss(config)}.composer-brand-preview{padding:12px;font:16px system-ui;background:#fc5b05;color:#17181b}
@media(prefers-reduced-motion:reduce){#admin-root{scroll-behavior:auto}}
`;
}

/** Workshop press is a token-and-edge layer over the same native controls.
 * It never renames, hides or reorders an action, and adds no motion. */
const pressWidths = ["1px", "2px", "3px", "4px"] as const;
export function brandSkinCss(config: AdminBrandConfig): string {
  if (config.skin !== "workshop-press") return "";
  const press = pressWidths[config.skinPressure - 1];
  return `html[data-theme]{--composer-skin-press:${press};--composer-skin-rule:color-mix(in srgb,currentColor 18%,transparent);--composer-skin-plate:color-mix(in srgb,currentColor 4%,transparent)}
#admin-root{border-inline:var(--composer-skin-press) solid var(--composer-skin-rule)}
#admin-root :is(.co-overview,.composer-workflows,.composer-connections,.ce-inbox,.ca-stacks){background:var(--composer-skin-plate);box-shadow:inset 0 0 0 1px var(--composer-skin-rule)}
#admin-root :is(input,textarea,select){border-width:var(--composer-skin-press);border-radius:2px;box-shadow:inset 0 1px 0 var(--composer-skin-rule)}
#admin-root button{border-radius:2px;box-shadow:0 1px 0 var(--composer-skin-rule)}
#admin-root button:active{box-shadow:inset 0 1px 0 var(--composer-skin-rule)}
#admin-root :focus-visible{outline-width:var(--composer-skin-press)}
`;
}
