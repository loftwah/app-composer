import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import { requireCapability, resolveWorkspace, StackError } from "./stacks.mjs";
import { readProviderInventory } from "./provider-inventory.mjs";
import { expectedProviderInventory } from "./provider-expected.ts";
import { buildProviderCheck } from "./provider-inventory-check.ts";
import {
  providerCheck,
  type ProviderCheck,
} from "./provider-inventory-contract.ts";

const origin = "https://composer.loftwah.com";
const inputSchema = z
  .object({
    action: z.literal("check").optional(),
    workspace: z
      .string()
      .regex(/^[a-z0-9-]{6,64}$/)
      .optional(),
  })
  .strict();

interface Context {
  user?: { id: string; role: number; name?: string | null };
  request: Request;
  input: unknown;
}
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  PROVIDER_READ_ENABLED?: unknown;
  PROVIDER_READ_TOKEN?: unknown;
  PROVIDER_READ_ACCOUNT_ID?: unknown;
}
export interface ProviderReadOptions {
  request?: typeof fetch;
  now?: () => number;
  revision?: string | null;
}

const usable = (value: unknown) =>
  typeof value === "string" && Boolean(value.trim());
const enabled = (value: unknown) =>
  value === true || value === "1" || value === "true";

/**
 * One bounded, read-only Cloudflare check. The deployment needs an explicitly
 * enabled, account-scoped read credential. Without it the answer is a precise
 * "unconfigured" state, never a simulated clean scan. No credential is accepted
 * from the browser, and no tag, resource, secret or deployment is written.
 */
export async function manageProviderInventory(
  ctx: Context,
  runtime: Runtime,
  options: ProviderReadOptions = {},
): Promise<ProviderCheck | { ok: false; code: string; message: string }> {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role))
      throw new StackError(
        "FORBIDDEN",
        "A signed-in Composer creator is required.",
        403,
      );
    if (!runtime.DB || runtime.PUBLIC_ORIGIN !== origin)
      throw new StackError(
        "UNAVAILABLE",
        "The Cloudflare check is disconnected in this environment.",
      );
    if (
      ctx.request.method !== "GET" ||
      (ctx.request.headers.has("Origin") &&
        ctx.request.headers.get("Origin") !== origin)
    )
      throw new StackError(
        "FORBIDDEN",
        "Open this read-only Cloudflare check from Composer administration.",
        403,
      );
    const url = new URL(ctx.request.url);
    for (const key of url.searchParams.keys())
      if (url.searchParams.getAll(key).length !== 1)
        throw new StackError("INVALID", "Choose each check option once.");
    const input = inputSchema.parse(ctx.input);
    const db = runtime.DB;
    const user = ctx.user;
    const workspace = await resolveWorkspace(db, user, input.workspace ?? null);
    requireCapability(workspace.role, "read");
    const expected = expectedProviderInventory({
      revision: options.revision ?? null,
    });
    const actionHref =
      "/_emdash/admin/plugins/composer-stacks/stacks?" +
      new URLSearchParams({ workspace: workspace.id });
    const checkedAt = new Date(options.now?.() ?? Date.now()).toISOString();

    if (!enabled(runtime.PROVIDER_READ_ENABLED)) {
      const check = buildProviderCheck({
        expected,
        snapshot: null,
        source: "live",
        state: "unconfigured",
        reason:
          "No read-only Cloudflare credential is enabled for this deployment. Composer made no provider request. Run scripts/provider-inventory.mjs with the owner's read-only token and import its bounded compare result here.",
        checkedAt,
        now: options.now?.(),
        actionHref,
        revision: options.revision ?? null,
      });
      return providerCheck.parse(check);
    }
    if (!usable(runtime.PROVIDER_READ_TOKEN)) {
      const check = buildProviderCheck({
        expected,
        snapshot: null,
        source: "live",
        state: "unconfigured",
        reason:
          "Provider reads are enabled but no read-only credential reference is present. No provider request was made, and Composer did not fall back to another credential.",
        checkedAt,
        now: options.now?.(),
        actionHref,
        revision: options.revision ?? null,
      });
      return providerCheck.parse(check);
    }
    const account = usable(runtime.PROVIDER_READ_ACCOUNT_ID)
      ? String(runtime.PROVIDER_READ_ACCOUNT_ID).trim()
      : expected.account;
    if (account !== expected.account)
      throw new StackError(
        "FORBIDDEN",
        "The configured provider account differs from Composer's recorded account. This check did not read another account.",
        403,
      );

    const now = options.now ?? Date.now;
    const snapshot = await readProviderInventory({
      token: String(runtime.PROVIDER_READ_TOKEN),
      account,
      request: options.request,
      now,
      workerHints: expected.workerHints,
      databaseHints: expected.databaseHints,
      workerNames: expected.workerNames,
      databaseIds: expected.databaseIds,
      settingsFor: expected.settingsFor,
      schedulesFor: expected.schedulesFor,
    });
    const check = buildProviderCheck({
      expected,
      snapshot,
      source: "live",
      checkedAt,
      now: now(),
      actionHref,
      revision: options.revision ?? null,
    });
    return providerCheck.parse(check);
  } catch (cause) {
    if (cause instanceof StackError)
      return { ok: false, code: cause.code, message: cause.message };
    return {
      ok: false,
      code: "UNAVAILABLE",
      message:
        "The read-only Cloudflare check could not confirm this selected workspace. Refresh or run the local provider-inventory CLI.",
    };
  }
}
