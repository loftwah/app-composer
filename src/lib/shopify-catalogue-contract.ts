import { z } from "zod";
export const shopifyApiVersion = "2026-10";
export const shopDomain = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$/);
export const catalogueProduct = z
  .object({
    id: z.string().regex(/^gid:\/\/shopify\/Product\/\d{1,30}$/),
    title: z.string().min(1).max(255),
    handle: z.string().regex(/^[a-z0-9][a-z0-9-]{0,254}$/),
    status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
    updatedAt: z.iso.datetime(),
    url: z
      .url()
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      })
      .nullable(),
    image: z.object({ altText: z.string().max(1000).nullable() }).nullable(),
  })
  .strict();
export const shopifyCatalogueSnapshot = z
  .object({
    ok: z.literal(true),
    schema: z.literal("composer.shopify-catalogue/1"),
    workspace: z
      .object({
        id: z.string().regex(/^[a-z0-9-]{6,64}$/),
        name: z.string().max(80),
      })
      .strict(),
    environment: z.string().max(40),
    source: z.enum(["unconfigured", "shopify", "fictional"]),
    state: z.enum([
      "unconfigured",
      "ready",
      "denied",
      "rate-limited",
      "unavailable",
      "mismatch",
    ]),
    shop: shopDomain.nullable(),
    apiVersion: z.literal(shopifyApiVersion),
    observedAt: z.iso.datetime().nullable(),
    atLimit: z.boolean(),
    products: z.array(catalogueProduct).max(20),
    note: z.string().max(600),
  })
  .strict();
export type ShopifyCatalogueSnapshot = z.infer<typeof shopifyCatalogueSnapshot>;
export function catalogueFindings(product: z.infer<typeof catalogueProduct>) {
  const findings: string[] = [];
  if (product.status !== "ACTIVE")
    findings.push(
      "Keep this product out of a public launch until the merchant publishes it.",
    );
  if (!product.url)
    findings.push(
      "No Online Store URL was returned. Check channel publication in Shopify before linking it.",
    );
  if (!product.image)
    findings.push(
      "Add product artwork in Shopify before preparing the campaign.",
    );
  else if (!product.image.altText?.trim())
    findings.push("Add a useful image description in Shopify.");
  if (!findings.length)
    findings.push(
      "Product link and image description are available for editorial review. Stock, price, checkout and fulfilment are not checked.",
    );
  return findings;
}
