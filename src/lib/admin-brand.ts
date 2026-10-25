import type { D1Database } from "@cloudflare/workers-types";
import type { APIContext } from "astro";
import { z } from "zod";
import {
  adminBrandConfig,
  brandTarget,
  brandDefaults,
  adminBrandCss,
  approvedMark,
  approvedFavicon,
  type AdminBrandConfig,
  type BrandTarget,
  type BrandSnapshot,
  type BrandVersion,
} from "./admin-brand-contract.ts";

export interface BrandRuntime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  RESOURCE_ACCOUNT_ID?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
}
export interface BrandContext {
  user?: { id: string; role: number; disabled?: boolean };
  request: Request;
  input?: unknown;
}
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read") }).strict(),
  z
    .object({
      action: z.literal("save"),
      expectedRevision: z.number().int().min(0),
      config: adminBrandConfig,
    })
    .strict(),
  z
    .object({
      action: z.enum(["publish", "rollback"]),
      expectedRevision: z.number().int().min(0),
      targetVersion: version,
      target: brandTarget,
    })
    .strict(),
]);
interface Row {
  scope: string;
  revision: number;
  draft_json: string;
  published_version: number | null;
  operation_id: string;
}
interface VersionRow {
  version: number;
  config_json: string;
  event: BrandVersion["event"];
  actor_id: string;
  created_at: string;
}
class BrandError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
function selectedTarget(runtime: BrandRuntime): BrandTarget {
  return brandTarget.parse({
    account: runtime.RESOURCE_ACCOUNT_ID,
    app: "composer",
    environment: runtime.RESOURCE_ENVIRONMENT,
  });
}
const scopeOf = (target: BrandTarget) =>
  `${target.account}:composer:${target.environment}`;
function matches(config: AdminBrandConfig, target: BrandTarget) {
  if (JSON.stringify(config.target) !== JSON.stringify(target))
    throw new BrandError(
      "SCOPE",
      "This configuration belongs to a different account, app or environment.",
    );
  return config;
}
const parsedConfig = (text: string, target: BrandTarget) =>
  matches(adminBrandConfig.parse(JSON.parse(text)), target);
async function state(db: D1Database, target: BrandTarget) {
  return db
    .prepare("SELECT * FROM composer_admin_brands WHERE scope=?")
    .bind(scopeOf(target))
    .first<Row>();
}
async function storedVersion(
  db: D1Database,
  target: BrandTarget,
  selected: number,
) {
  return db
    .prepare(
      "SELECT * FROM composer_admin_brand_versions WHERE scope=? AND version=?",
    )
    .bind(scopeOf(target), selected)
    .first<VersionRow>();
}
async function snapshot(
  db: D1Database,
  target: BrandTarget,
): Promise<BrandSnapshot> {
  const current = await state(db, target);
  const rows = await db
    .prepare(
      "SELECT * FROM composer_admin_brand_versions WHERE scope=? ORDER BY version DESC LIMIT 25",
    )
    .bind(scopeOf(target))
    .all<VersionRow>();
  const publishedRow = current?.published_version
    ? await storedVersion(db, target, current.published_version)
    : null;
  if (
    current?.published_version &&
    (!publishedRow || publishedRow.event === "draft")
  )
    throw new BrandError(
      "UNAVAILABLE",
      "Published appearance could not be confirmed.",
    );
  return {
    ok: true,
    target,
    revision: current?.revision ?? 0,
    draft: current
      ? parsedConfig(current.draft_json, target)
      : brandDefaults(target),
    publishedVersion: current?.published_version ?? null,
    published: publishedRow
      ? parsedConfig(publishedRow.config_json, target)
      : null,
    history: rows.results.map((row) => ({
      version: row.version,
      event: row.event,
      config: parsedConfig(row.config_json, target),
      actor: row.actor_id,
      createdAt: row.created_at,
    })),
  };
}
function authorised(ctx: BrandContext, runtime: BrandRuntime, owner = true) {
  if (
    !ctx.user ||
    ctx.user.disabled ||
    (owner
      ? ctx.user.role !== 50
      : ![10, 20, 30, 40, 50].includes(ctx.user.role))
  )
    throw new BrandError(
      "FORBIDDEN",
      "Brand Studio requires an enabled EmDash administrator.",
    );
  if (
    !runtime.DB ||
    typeof runtime.PUBLIC_ORIGIN !== "string" ||
    new URL(ctx.request.url).origin !== runtime.PUBLIC_ORIGIN
  )
    throw new BrandError(
      "UNAVAILABLE",
      "Appearance is disconnected from this configured account and environment.",
    );
  return { db: runtime.DB, target: selectedTarget(runtime) };
}
export async function manageAdminBrand(
  ctx: BrandContext,
  runtime: BrandRuntime,
) {
  try {
    const { db, target } = authorised(ctx, runtime);
    const requestUrl = new URL(ctx.request.url);
    if (
      [...requestUrl.searchParams.keys()].some(
        (key) => requestUrl.searchParams.getAll(key).length !== 1,
      )
    )
      throw new BrandError("INVALID", "Choose each appearance operation once.");
    const input = command.parse(ctx.input);
    if (ctx.request.method === "GET") {
      if (input.action !== "read")
        throw new BrandError(
          "INVALID",
          "Read the current appearance before making a change.",
        );
      return await snapshot(db, target);
    }
    if (
      ctx.request.method !== "POST" ||
      ctx.request.headers.get("Origin") !== runtime.PUBLIC_ORIGIN ||
      ctx.request.headers.get("X-EmDash-Request") !== "1"
    )
      throw new BrandError(
        "FORBIDDEN",
        "Save appearance from the signed-in administration form.",
      );
    if (input.action === "read")
      throw new BrandError("INVALID", "Use the read-only appearance route.");
    const before = await state(db, target);
    if ((before?.revision ?? 0) !== input.expectedRevision)
      throw new BrandError(
        "CONFLICT",
        "Appearance changed in another session. Reload and compare before saving.",
      );
    let config: AdminBrandConfig;
    if (input.action === "save") config = matches(input.config, target);
    else {
      matches({ ...brandDefaults(target), target: input.target }, target);
      const source = await storedVersion(db, target, input.targetVersion);
      if (
        !source ||
        (input.action === "publish" &&
          input.targetVersion !== before?.revision) ||
        (input.action === "rollback" && source.event === "draft")
      )
        throw new BrandError(
          "INVALID",
          "Select the current saved draft to publish, or a previously published version to restore.",
        );
      config = parsedConfig(source.config_json, target);
    }
    const revision = input.expectedRevision + 1,
      operation = crypto.randomUUID(),
      scope = scopeOf(target),
      json = JSON.stringify(config);
    const published =
      input.action === "save" ? (before?.published_version ?? null) : revision;
    await db.batch([
      db
        .prepare(
          `INSERT INTO composer_admin_brands (scope,revision,draft_json,published_version,operation_id) VALUES (?,?,?,?,?)
        ON CONFLICT(scope) DO UPDATE SET revision=excluded.revision,draft_json=excluded.draft_json,
        published_version=excluded.published_version,operation_id=excluded.operation_id
        WHERE composer_admin_brands.revision=?`,
        )
        .bind(
          scope,
          revision,
          json,
          published,
          operation,
          input.expectedRevision,
        ),
      db
        .prepare(
          `INSERT INTO composer_admin_brand_versions (scope,version,config_json,event,actor_id)
        SELECT scope,revision,draft_json,?,? FROM composer_admin_brands WHERE scope=? AND operation_id=?`,
        )
        .bind(
          input.action === "save" ? "draft" : input.action,
          ctx.user!.id,
          scope,
          operation,
        ),
    ]);
    const after = await state(db, target);
    if (after?.operation_id !== operation)
      throw new BrandError(
        "CONFLICT",
        "Appearance changed while saving. Reload and compare; your form has been retained.",
      );
    return await snapshot(db, target);
  } catch (error) {
    return {
      ok: false as const,
      code:
        error instanceof BrandError
          ? error.code
          : error instanceof z.ZodError
            ? "INVALID"
            : "UNAVAILABLE",
      message:
        error instanceof BrandError
          ? error.message
          : error instanceof z.ZodError
            ? "Use a supported appearance configuration with plain text names and the approved Composer mark."
            : "Appearance could not be confirmed. Existing administration remains available; reload to retry.",
    };
  }
}

/** Same-origin stylesheet served by authenticated Composer middleware.
 * A normal <link> cannot supply EmDash private plugin routes' custom header.
 */
export async function adminBrandStyles(
  ctx: BrandContext,
  runtime: BrandRuntime,
) {
  if (ctx.request.method !== "GET")
    return new Response(null, {
      status: 405,
      headers: { Allow: "GET", "Cache-Control": "private, no-store" },
    });
  try {
    const { db, target } = authorised(ctx, runtime, false);
    const url = new URL(ctx.request.url);
    if (
      [...url.searchParams.keys()].some(
        (key) =>
          !["version", "preview"].includes(key) ||
          url.searchParams.getAll(key).length !== 1,
      )
    )
      throw new BrandError("INVALID", "Invalid appearance selection");
    const selected = version.parse(Number(url.searchParams.get("version")));
    const row = await storedVersion(db, target, selected);
    const preview = url.searchParams.get("preview") === "1";
    if (!row || (row.event === "draft" && (!preview || ctx.user?.role !== 50)))
      throw new BrandError(
        "FORBIDDEN",
        "Draft appearance is private to administrators.",
      );
    return new Response(adminBrandCss(parsedConfig(row.config_json, target)), {
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("/* Appearance unavailable. */", {
      status: 403,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}

export interface BrandPresentation {
  version: number;
  preview: boolean;
  stylesheet: string;
}
export async function prepareAdminBrand(
  context: Pick<APIContext, "request" | "url" | "locals">,
  runtime: BrandRuntime,
): Promise<BrandPresentation | null> {
  if (
    !context.url.pathname.startsWith("/_emdash/admin") &&
    context.url.pathname !== "/_emdash/api/manifest"
  )
    return null;
  if (
    !context.locals.emdash ||
    !context.locals.user ||
    context.locals.user.disabled
  )
    return null;
  try {
    const { db, target } = authorised(
      { request: context.request, user: context.locals.user },
      runtime,
      false,
    );
    let previewText = context.url.searchParams.get("brandPreview");
    if (context.url.pathname === "/_emdash/api/manifest") {
      const referer = context.request.headers.get("Referer");
      if (referer) {
        const source = new URL(referer);
        if (
          source.origin === context.url.origin &&
          source.pathname.startsWith("/_emdash/admin")
        )
          previewText = source.searchParams.get("brandPreview");
      }
    }
    const preview = previewText !== null;
    if (preview && context.locals.user.role !== 50) return null;
    const current = await state(db, target);
    const selected = preview
      ? version.parse(Number(previewText))
      : current?.published_version;
    if (!selected) return null;
    const row = await storedVersion(db, target, selected);
    if (!row || (!preview && row.event === "draft")) return null;
    const config = parsedConfig(row.config_json, target);
    const emdash = context.locals.emdash;
    context.locals.emdash = {
      ...emdash,
      config: {
        ...emdash.config,
        admin: {
          ...emdash.config.admin,
          siteName: config.siteName,
          footerLabel: config.footerLabel,
          logo: approvedMark,
          favicon: approvedFavicon,
        },
      },
    };
    return {
      version: selected,
      preview,
      stylesheet: `/_emdash/composer-admin-brand.css?version=${selected}${preview ? "&preview=1" : ""}`,
    };
  } catch {
    return null;
  }
}
export async function brandAdminResponse(
  response: Response,
  presentation: BrandPresentation | null,
) {
  if (
    !presentation ||
    !response.headers.get("Content-Type")?.includes("text/html") ||
    !response.ok
  )
    return response;
  const html = await response.text();
  const link = `<link rel="stylesheet" href="${presentation.stylesheet.replaceAll("&", "&amp;")}" data-composer-brand-version="${presentation.version}">`;
  const note = presentation.preview
    ? `<div role="status" class="composer-brand-preview">Saved appearance preview · version ${presentation.version}. Publishing is a separate action in Brand Studio.</div>`
    : "";
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(
    html
      .replace("</head>", link + "</head>")
      .replace(/(<body\b[^>]*>)/, "$1" + note),
    { status: response.status, headers },
  );
}
