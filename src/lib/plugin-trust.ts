import { PluginRouteError } from "emdash";
import type { D1Database } from "@cloudflare/workers-types";
import snapshotData from "../data/plugin-trust-20261025.json" with { type: "json" };
import {
  evaluatePlugin,
  pluginTrustSnapshot,
} from "./plugin-trust-contract.ts";

const origin = "https://composer.loftwah.com";
interface Context {
  user?: { id: string; role: number };
  request: Request;
  input: unknown;
}
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
}
const rowKeys = [
  "plugin_id",
  "version",
  "status",
  "source",
  "registry_publisher_did",
  "registry_slug",
] as const;
export interface PluginInventoryRow {
  plugin_id: string;
  version: string;
  status: string;
  source: string;
  registry_publisher_did: string | null;
  registry_slug: string | null;
}
export async function managePluginTrust(ctx: Context, runtime: Runtime) {
  const reject = (code: string, message: string, status: number): never => {
    throw new PluginRouteError(code, message, status);
  };
  if (!ctx.user || ctx.user.role !== 50)
    return reject(
      "FORBIDDEN",
      "Plugin Trust Centre requires a signed-in administrator.",
      403,
    );
  if (ctx.request.method !== "GET")
    return reject("METHOD_NOT_ALLOWED", "This view is read-only.", 405);
  const url = new URL(ctx.request.url);
  if (
    runtime.PUBLIC_ORIGIN !== origin ||
    runtime.RESOURCE_ENVIRONMENT !== "production" ||
    url.origin !== origin ||
    (ctx.request.headers.has("Origin") &&
      ctx.request.headers.get("Origin") !== origin)
  )
    return reject(
      "UNAVAILABLE",
      "Open this view in the selected Composer production administration.",
      403,
    );
  if (url.search || (ctx.input && Object.keys(ctx.input as object).length))
    return reject(
      "INVALID",
      "This read-only view accepts no filters or target overrides.",
      400,
    );
  try {
    const snapshot = pluginTrustSnapshot.parse(snapshotData);
    const checkedAt = new Date();
    let inventory: {
      available: boolean;
      atLimit: boolean;
      rows: PluginInventoryRow[];
    } = { available: false, atLimit: false, rows: [] };
    try {
      if (runtime.DB) {
        // Core owns this table. Read only the inventory columns; never settings,
        // plugin storage, consent JSON, display descriptions or credentials.
        const result = await runtime.DB.prepare(
          "SELECT plugin_id,version,status,source,registry_publisher_did,registry_slug FROM _plugin_state ORDER BY plugin_id LIMIT 101",
        ).all<PluginInventoryRow>();
        if (!result.success || !Array.isArray(result.results))
          throw Error("Inventory unavailable");
        const valid = result.results.every((row) =>
          rowKeys.every(
            (key) =>
              row[key] === null ||
              (typeof row[key] === "string" && row[key].length <= 200),
          ),
        );
        if (!valid) throw Error("Inventory unavailable");
        inventory = {
          available: true,
          atLimit: result.results.length > 100,
          rows: result.results.slice(0, 100),
        };
      }
    } catch {
      /* A failed query is unavailable, never an empty inventory. */
    }
    return {
      ok: true,
      site: origin,
      environment: "production",
      checkedAt: checkedAt.toISOString(),
      snapshot,
      evaluations: snapshot.packages.map((plugin) =>
        evaluatePlugin(plugin, snapshot, checkedAt),
      ),
      inventory,
      installation: {
        state: "unqualified",
        blockers: [
          "Registry and sandbox runner are not enabled for this Composer build.",
          "LOADER is absent from the selected environment.",
          "Workers Paid / Dynamic Workers entitlement is unverified.",
          "An authorised isolated target and exact-release lifecycle receipt are required.",
        ],
      },
    };
  } catch {
    return reject(
      "SNAPSHOT_UNAVAILABLE",
      "The curated evidence snapshot is unavailable. Use the official registry and re-observe before a decision.",
      503,
    );
  }
}
