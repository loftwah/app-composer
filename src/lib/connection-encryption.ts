import {
  isEncryptedPluginSetting,
  pluginResponse,
  type SettingsAccess,
  type SettingField,
} from "emdash";
import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { encryptionHealthResult } from "./connection-contract.ts";
import { resolveWorkspace, membership, StackError } from "./stacks.mjs";

const origin = "https://composer.loftwah.com";
export const encryptionProbeField =
  "__encryption_health_3bd92750_2d47_4e56_a14a_baf462193fe8";
export const encryptionProbeOption = `plugin:composer-stacks:settings:${encryptionProbeField}`;
// Registered once with the existing native plugin, never changed per request.
// This UUID-namespaced field has no provider meaning or persisted default.
export const encryptionProbeSettings: Record<string, SettingField> =
  Object.freeze({
    [encryptionProbeField]: Object.freeze({
      type: "secret",
      label: "Temporary encrypted-storage verification",
      description:
        "Reserved for the Connections health check. Leave empty; the check writes a synthetic value and clears only its own unchanged option.",
    }),
  });
interface Context {
  user?: { id: string; role: number };
  request: Request;
  input: unknown;
  settings?: SettingsAccess;
}
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
}
const command = z
  .object({ workspace: z.string().regex(/^[a-z0-9-]{6,64}$/) })
  .strict();

export async function checkConnectionEncryption(
  ctx: Context,
  runtime: Runtime,
) {
  const db = runtime.DB;
  if (
    !ctx.user ||
    ctx.user.role !== 50 ||
    !db ||
    runtime.PUBLIC_ORIGIN !== origin ||
    runtime.RESOURCE_ENVIRONMENT !== "production" ||
    new URL(ctx.request.url).origin !== origin ||
    ctx.request.method !== "POST" ||
    ctx.request.headers.get("Origin") !== origin ||
    ctx.request.headers.get("X-EmDash-Request") !== "1" ||
    ctx.request.headers.has("Authorization")
  )
    throw new StackError(
      "FORBIDDEN",
      "A signed-in owner administrator must run this check from Composer production.",
      403,
    );
  const input = command.parse(ctx.input);
  const workspace = await resolveWorkspace(db, ctx.user, input.workspace);
  const authorised = async () => {
    const account = await db
      .prepare("SELECT role,disabled FROM users WHERE id=?")
      .bind(ctx.user!.id)
      .first<{ role: number; disabled: number }>();
    if (
      !account ||
      account.role !== 50 ||
      account.disabled ||
      (await membership(db, workspace.id, ctx.user!.id)) !== "owner"
    )
      throw new StackError(
        "FORBIDDEN",
        "Current owner administrator access is required.",
        403,
      );
  };
  await authorised();
  if (!ctx.settings)
    throw new StackError(
      "UNAVAILABLE",
      "The native settings context is unavailable.",
      503,
    );
  // Refuse an existing option even when its value is null or undecryptable.
  const existing = await db
    .prepare("SELECT 1 AS present FROM options WHERE name=?")
    .bind(encryptionProbeOption)
    .first();
  const legacy = await db
    .prepare(
      "SELECT 1 AS present FROM _plugin_storage WHERE plugin_id='composer-stacks' AND collection='__kv' AND id=?",
    )
    .bind(`settings:${encryptionProbeField}`)
    .first();
  if (existing || legacy)
    throw new StackError(
      "CONFLICT",
      "A previous or independently owned verification value exists. It was preserved; inspect it before another check.",
      409,
    );
  const synthetic = crypto.randomUUID() + crypto.randomUUID();
  const operation = crypto.randomUUID();
  let revision: string | null = null,
    raw: string | null = null,
    nativeEncryptedEnvelope = false,
    nativeReadMatched = false,
    cleaned = false,
    revoked = false,
    conflict = false,
    writeAttempted = false;
  try {
    await authorised();
    writeAttempted = true;
    const saved = await ctx.settings.compareAndSet(
      encryptionProbeField,
      null,
      synthetic,
    );
    if (!saved.applied)
      throw new StackError(
        "CONFLICT",
        "Another verification acquired the reserved option. It was preserved.",
        409,
      );
    revision = saved.revision;
    const stored = await db
      .prepare("SELECT value,revision FROM options WHERE name=?")
      .bind(encryptionProbeOption)
      .first<{ value: string; revision: string }>();
    if (!stored || stored.revision !== revision)
      throw new StackError(
        "CONFLICT",
        "The verification option changed independently.",
        409,
      );
    raw = stored.value;
    nativeEncryptedEnvelope =
      isEncryptedPluginSetting(JSON.parse(raw)) && !raw.includes(synthetic);
    const recovered =
      await ctx.settings.getVersioned<string>(encryptionProbeField);
    nativeReadMatched =
      recovered?.revision === revision && recovered.value === synthetic;
    await authorised();
  } catch (error) {
    revoked = error instanceof StackError && error.code === "FORBIDDEN";
    conflict = error instanceof StackError && error.code === "CONFLICT";
    // Native encryption/parser/transport errors may contain private material.
    // Return only bounded fixed states below; never log or echo the exception.
  } finally {
    if (revision) {
      try {
        // A read failure before capture gets one bounded cleanup observation.
        // Never remove a changed revision or any independently written value.
        if (raw === null) {
          const stored = await db
            .prepare("SELECT value,revision FROM options WHERE name=?")
            .bind(encryptionProbeOption)
            .first<{ value: string; revision: string }>();
          if (stored?.revision === revision) raw = stored.value;
          else if (!stored) cleaned = true;
        }
        if (raw !== null) {
          const removed = await db
            .prepare(
              "DELETE FROM options WHERE name=? AND revision=? AND value=?",
            )
            .bind(encryptionProbeOption, revision, raw)
            .run();
          cleaned = removed.success && removed.meta.changes === 1;
        }
      } catch {
        /* Cleanup remains explicitly unverified; no broad retry/delete. */
      }
    } else if (writeAttempted) {
      try {
        // A commit may succeed before its response fails. Without the returned
        // revision ownership cannot be proved: observe presence, never delete.
        const present = await db
          .prepare("SELECT 1 AS present FROM options WHERE name=?")
          .bind(encryptionProbeOption)
          .first();
        cleaned = !present;
      } catch {
        /* Absence remains unverified. Preserve any value for owner inspection. */
      }
    } else cleaned = true;
  }
  if (revoked)
    throw new StackError(
      "FORBIDDEN",
      "Access changed during verification. No verification result is available.",
      403,
    );
  const state = !cleaned
    ? "cleanup-required"
    : nativeEncryptedEnvelope && nativeReadMatched
      ? "verified"
      : conflict
        ? "conflict"
        : "unavailable";
  return encryptionHealthResult.parse({
    ok: state === "verified",
    schema: "composer.encryption-health/1",
    workspace: workspace.id,
    operation,
    checkedAt: new Date().toISOString(),
    state,
    nativeEncryptedEnvelope,
    nativeReadMatched,
    cleaned,
    message:
      state === "verified"
        ? "Native EmDash stored an encrypted synthetic setting, read it back through its registered settings context and removed the unchanged test value. Provider credentials and delivery were not tested."
        : state === "cleanup-required"
          ? "The synthetic check could not confirm cleanup. The reserved option was preserved unless its exact owned value and revision matched. Ask the owner operator to inspect it before another check."
          : state === "conflict"
            ? "Another verification or independent change prevented this check. Existing values were preserved; retry deliberately after confirming cleanup."
            : "Native encrypted storage could not be verified. Check the runtime encryption key and retry deliberately. No provider was contacted.",
  });
}
export async function connectionEncryptionReply(
  ctx: Context,
  runtime: Runtime,
) {
  let result: unknown,
    status = 200;
  try {
    result = await checkConnectionEncryption(ctx, runtime);
  } catch (error) {
    status = error instanceof StackError ? error.status : 400;
    result = {
      ok: false,
      code: error instanceof StackError ? error.code : "INVALID",
      message:
        error instanceof StackError
          ? error.message
          : "Choose the current workspace and retry the native encrypted-storage check.",
    };
  }
  return pluginResponse({
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
    body: { kind: "text", value: JSON.stringify(result) },
  });
}
