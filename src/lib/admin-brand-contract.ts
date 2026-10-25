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
});
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

/** Finite CSS grammar. User text and imported strings never enter CSS. */
export function adminBrandCss(config: AdminBrandConfig): string {
  const fontSize = config.typeScale === "large" ? "18px" : "16px";
  const rhythm = config.density === "compact" ? "16px" : "24px";
  return `html[data-theme]{--color-kumo-brand:#c74400;--color-kumo-brand-hover:#a63a00;--color-kumo-focus:#c74400;--text-color-kumo-brand:#c74400;--text-color-kumo-link:#c74400;--kumo-button-emphasis-bg:#c74400;--kumo-button-emphasis-ring:#c74400;font-size:${fontSize};--composer-admin-rhythm:${rhythm}}
html[data-theme][data-mode="dark"]{--color-kumo-focus:#fc5b05;--text-color-kumo-brand:#fc5b05;--text-color-kumo-link:#fc5b05}
#admin-root :is(.co-overview,.composer-workflows,.composer-connections,.ce-inbox,.ca-stacks){padding:var(--composer-admin-rhythm)}
#admin-root :is(input,textarea,select){font-size:max(16px,1rem)}
#admin-root :focus-visible{outline:2px solid var(--color-kumo-focus);outline-offset:3px}
.composer-brand-preview{padding:12px;font:16px system-ui;background:#fc5b05;color:#17181b}
@media(prefers-reduced-motion:reduce){#admin-root{scroll-behavior:auto}}
`;
}
