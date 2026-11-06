import { PluginRouteError } from "emdash";
import { stackStatusSnapshot } from "./stack-status-contract.ts";

interface Context {
  user?: { id: string; role: number };
  request: Request;
  input: unknown;
}

export async function manageStackStatus(ctx: Context) {
  const reject = (code: string, message: string, status: number): never => {
    throw new PluginRouteError(code, message, status);
  };
  if (!ctx.user || ctx.user.role !== 50)
    return reject(
      "FORBIDDEN",
      "Stack status requires a signed-in administrator.",
      403,
    );
  if (ctx.request.method !== "GET")
    return reject("METHOD_NOT_ALLOWED", "This view is read-only.", 405);
  const url = new URL(ctx.request.url);
  if (url.search || (ctx.input && Object.keys(ctx.input as object).length))
    return reject(
      "INVALID",
      "Stack status accepts no filters or target overrides.",
      400,
    );
  try {
    // Load the generated snapshot only when the route is used. A checkout that
    // has not run the ordinary build identity can still import this plugin;
    // the route answers unavailable instead of inventing installed/deployed data.
    const { default: snapshotData } = await import("./stack-status.json", {
      with: { type: "json" },
    });
    const snapshot = stackStatusSnapshot.parse(snapshotData);
    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      snapshot,
    };
  } catch {
    return reject(
      "SNAPSHOT_UNAVAILABLE",
      "The generated Stack status snapshot is unavailable or invalid. Regenerate it from a reviewed checkout.",
      503,
    );
  }
}
