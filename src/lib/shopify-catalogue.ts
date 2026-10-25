import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import { isCreatorRole } from "./creator-access.ts";
import {
  resolveWorkspace,
  membership,
  requireCapability,
  StackError,
} from "./stacks.mjs";
import {
  catalogueProduct,
  shopDomain,
  shopifyApiVersion,
  shopifyCatalogueSnapshot,
  type ShopifyCatalogueSnapshot,
} from "./shopify-catalogue-contract.ts";
const origin = "https://composer.loftwah.com";
export const catalogueQuery = `query ComposerCatalogue {
  shop { myshopifyDomain primaryDomain { host } }
  products(first: 20, sortKey: UPDATED_AT, reverse: true) {
    nodes { id title handle status updatedAt onlineStoreUrl
      featuredMedia { ... on MediaImage { image { altText } } }
    }
    pageInfo { hasNextPage }
  }
}`;
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
  SHOPIFY_READ_ENABLED?: unknown;
  SHOPIFY_SHOP_DOMAIN?: unknown;
  SHOPIFY_ADMIN_ACCESS_TOKEN?: unknown;
  SHOPIFY_WORKSPACE_ID?: unknown;
  SHOPIFY_RESOURCE_ENVIRONMENT?: unknown;
}
interface Context {
  user?: { id: string; role: number };
  request: Request;
  input: unknown;
}
const inputSchema = z
  .object({
    action: z.enum(["status", "check"]),
    workspace: z
      .string()
      .regex(/^[a-z0-9-]{6,64}$/)
      .optional(),
  })
  .strict();
const responseSchema = z.object({
  data: z.object({
    shop: z.object({
      myshopifyDomain: shopDomain,
      primaryDomain: z.object({
        host: z.string().regex(/^[a-z0-9.-]{1,253}$/),
      }),
    }),
    products: z.object({
      nodes: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            handle: z.string(),
            status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
            updatedAt: z.iso.datetime(),
            onlineStoreUrl: z.string().nullable(),
            featuredMedia: z
              .object({
                image: z
                  .object({ altText: z.string().nullable() })
                  .nullable()
                  .optional(),
              })
              .nullable(),
          }),
        )
        .max(20),
      pageInfo: z.object({ hasNextPage: z.boolean() }),
    }),
  }),
  errors: z.array(z.unknown()).max(100).optional(),
});

// One fixed GraphQL query; no mutations, customer records, orders or payment.
export async function readShopifyCatalogue(
  shop: string,
  token: string,
  fetcher = fetch,
) {
  const selected = shopDomain.parse(shop);
  let response: Response;
  try {
    response = await fetcher(
      `https://${selected}/admin/api/${shopifyApiVersion}/graphql.json`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query: catalogueQuery }),
      },
    );
  } catch {
    return { state: "unavailable" as const };
  }
  if ([401, 403].includes(response.status)) return { state: "denied" as const };
  if (response.status === 429) return { state: "rate-limited" as const };
  if (
    !response.ok ||
    response.headers.get("X-Shopify-API-Version") !== shopifyApiVersion ||
    !response.body
  )
    return { state: "unavailable" as const };
  try {
    const chunks: Uint8Array[] = [];
    const reader = response.body.getReader();
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 128 * 1024) throw Error("Oversized catalogue");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const parsed = responseSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    if (parsed.errors?.length) return { state: "unavailable" as const };
    if (parsed.data.shop.myshopifyDomain !== selected)
      return { state: "mismatch" as const };
    const hosts = [selected, parsed.data.shop.primaryDomain.host];
    const products = parsed.data.products.nodes.map((product) => {
      let url: string | null = null;
      if (product.onlineStoreUrl && product.status === "ACTIVE") {
        const value = new URL(product.onlineStoreUrl);
        if (
          value.protocol !== "https:" ||
          value.username ||
          value.password ||
          value.port ||
          !hosts.includes(value.hostname) ||
          value.pathname !== `/products/${product.handle}`
        )
          throw Error("Untrusted product link");
        value.search = "";
        value.hash = "";
        url = value.href;
      }
      return catalogueProduct.parse({
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        updatedAt: product.updatedAt,
        url,
        image: product.featuredMedia?.image ?? null,
      });
    });
    return {
      state: "ready" as const,
      products,
      atLimit: parsed.data.products.pageInfo.hasNextPage,
    };
  } catch {
    return { state: "unavailable" as const };
  }
}

export async function manageShopifyCatalogue(
  ctx: Context,
  runtime: Runtime,
  fetcher = fetch,
) {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role))
      throw new StackError(
        "FORBIDDEN",
        "A signed-in Composer creator is required.",
        403,
      );
    if (
      !runtime.DB ||
      runtime.PUBLIC_ORIGIN !== origin ||
      new URL(ctx.request.url).origin !== origin
    )
      throw new StackError(
        "UNAVAILABLE",
        "Open this view from the selected Composer administration.",
        403,
      );
    if (
      ctx.request.headers.has("Origin") &&
      ctx.request.headers.get("Origin") !== origin
    )
      throw new StackError(
        "FORBIDDEN",
        "Open this view from Composer administration.",
        403,
      );
    const url = new URL(ctx.request.url);
    for (const key of url.searchParams.keys())
      if (url.searchParams.getAll(key).length !== 1)
        throw new StackError("INVALID", "Select each catalogue scope once.");
    if (
      ctx.request.method === "POST" &&
      ctx.request.headers.get("Origin") !== origin
    )
      throw new StackError(
        "FORBIDDEN",
        "Run catalogue checks from Composer administration.",
        403,
      );
    const input = inputSchema.parse(ctx.input);
    if (
      (input.action === "status" && ctx.request.method !== "GET") ||
      (input.action === "check" && ctx.request.method !== "POST")
    )
      throw new StackError(
        "METHOD_NOT_ALLOWED",
        "Use the explicit catalogue check action.",
        405,
      );
    const workspace = await resolveWorkspace(
      runtime.DB,
      ctx.user,
      input.workspace ?? null,
    );
    requireCapability(workspace.role, "save");
    const environment = z
      .string()
      .regex(/^[a-z0-9-]{1,40}$/)
      .parse(runtime.RESOURCE_ENVIRONMENT);
    const selected = shopDomain.safeParse(runtime.SHOPIFY_SHOP_DOMAIN);
    const configured =
      runtime.SHOPIFY_READ_ENABLED === "true" &&
      selected.success &&
      typeof runtime.SHOPIFY_ADMIN_ACCESS_TOKEN === "string" &&
      runtime.SHOPIFY_ADMIN_ACCESS_TOKEN.length > 0 &&
      runtime.SHOPIFY_WORKSPACE_ID === workspace.id &&
      runtime.SHOPIFY_RESOURCE_ENVIRONMENT === environment;
    const report: ShopifyCatalogueSnapshot = {
      ok: true,
      schema: "composer.shopify-catalogue/1",
      workspace: { id: workspace.id, name: workspace.name },
      environment,
      source: "unconfigured",
      state: "unconfigured",
      shop: configured && selected.success ? selected.data : null,
      apiVersion: shopifyApiVersion,
      observedAt: null,
      atLimit: false,
      products: [],
      note: "No catalogue was read. A merchant-authorised read_products token, exact shop, workspace and environment must be configured server-side. Shopify remains checkout and fulfilment owner.",
    };
    if (configured && input.action === "check" && selected.success) {
      requireCapability(
        await membership(runtime.DB, workspace.id, ctx.user.id),
        "save",
      );
      const result = await readShopifyCatalogue(
        selected.data,
        runtime.SHOPIFY_ADMIN_ACCESS_TOKEN as string,
        fetcher,
      );
      // Recheck revocation after the provider response before exposing private drafts.
      requireCapability(
        await membership(runtime.DB, workspace.id, ctx.user.id),
        "save",
      );
      report.source = "shopify";
      report.state = result.state;
      report.observedAt = new Date().toISOString();
      report.products = result.state === "ready" ? result.products : [];
      report.atLimit = result.state === "ready" && result.atLimit;
      report.note =
        result.state === "ready"
          ? "Read-only product metadata from the selected store. Stock, price, orders, customer data, checkout and fulfilment were not queried. Review publication and accessibility in Shopify before using a product in your campaign."
          : result.state === "denied"
            ? "Shopify refused this credential or its product permission. Check the selected app installation and read_products scope; no automatic retry or fallback was attempted."
            : result.state === "rate-limited"
              ? "Shopify rate-limited the check. Wait before explicitly retrying."
              : result.state === "mismatch"
                ? "The provider returned a different shop identity. No product metadata is shown."
                : "The catalogue could not be verified, including the exact API version. No product metadata is shown; inspect the selected Shopify app and retry explicitly.";
    } else if (configured)
      report.note =
        "The selected server configuration is present. Check catalogue to verify the shop, API version and read permission. No provider request has been made.";
    return shopifyCatalogueSnapshot.parse(report);
  } catch (error) {
    if (error instanceof StackError)
      return { ok: false, code: error.code, message: error.message };
    return {
      ok: false,
      code: "INVALID",
      message:
        "The selected catalogue scope or response could not be verified.",
    };
  }
}
