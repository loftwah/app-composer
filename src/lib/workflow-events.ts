import { z } from "zod";
import { captureNativeWorkflowSource } from "./workflows.ts";
import { membership, capabilityFor } from "./stacks.mjs";

type Runtime = Parameters<typeof captureNativeWorkflowSource>[1];
interface Context {
  user?: Parameters<typeof captureNativeWorkflowSource>[0];
  request: Request;
  input: unknown;
}
const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const stackReply = z.object({
  ok: z.literal(true),
  workspace: z.object({ id }),
  stack: z.object({
    id,
    status: z.literal("published"),
    publishedRevision: positive,
  }),
});
const platformReply = z.object({
  ok: z.literal(true),
  workspace: z.object({ id }),
});
const target = z.object({
  target: z.object({
    account: z.string().min(1).max(80),
    environment: z.string().min(1).max(40),
    url: z.literal("https://composer.loftwah.com/guestbook"),
  }),
});

async function captureAfterWrite<T>(
  kind: "stacks" | "platform",
  ctx: Context,
  runtime: Runtime,
  result: T,
): Promise<void> {
  if (
    ctx.request.method !== "POST" ||
    ctx.request.headers.get("Origin") !== "https://composer.loftwah.com" ||
    ctx.request.headers.get("X-EmDash-Request") !== "1" ||
    !ctx.user ||
    !runtime.DB
  )
    return;
  const command = z
    .object({
      action: z.string(),
      id: id.optional(),
      key: z.uuid().optional(),
    })
    .safeParse(ctx.input);
  if (!command.success) return;
  if (kind === "stacks") {
    if (!["publish", "republish"].includes(command.data.action)) return;
    const reply = stackReply.safeParse(result);
    if (!reply.success) return;
    await captureNativeWorkflowSource(ctx.user, runtime, {
      recipe: "release-summary",
      workspace: reply.data.workspace.id,
      source: reply.data.stack.id,
      revision: reply.data.stack.publishedRevision,
    });
    return;
  }
  if (
    !["submit", "update", "revise", "review", "run", "reconcile"].includes(
      command.data.action,
    )
  )
    return;
  const reply = platformReply.safeParse(result);
  if (!reply.success) return;
  // Submission keys are operation selectors, not event payloads. The native
  // response deliberately does not expose them, so derive the affected row
  // from the canonical mutation's persisted scope and current actor.
  const row = await (
    command.data.action === "submit"
      ? runtime.DB.prepare(
          "SELECT id,status,revision,stack_id,plan_json FROM creator_platform_requests WHERE submission_key=? AND workspace_id=? AND actor_id=?",
        ).bind(command.data.key ?? "", reply.data.workspace.id, ctx.user.id)
      : runtime.DB.prepare(
          "SELECT id,status,revision,stack_id,plan_json FROM creator_platform_requests WHERE id=? AND workspace_id=?",
        ).bind(command.data.id ?? "", reply.data.workspace.id)
  ).first<{
    id: string;
    status: string;
    revision: number;
    stack_id: string | null;
    plan_json: string;
  }>();
  if (!row) return;
  const planTarget = target.safeParse(JSON.parse(row.plan_json));
  if (
    !planTarget.success ||
    planTarget.data.target.account !== runtime.RESOURCE_ACCOUNT_ID ||
    planTarget.data.target.environment !== runtime.RESOURCE_ENVIRONMENT
  )
    return;
  if (row.status === "needs-attention")
    await captureNativeWorkflowSource(ctx.user, runtime, {
      recipe: "operation-attention",
      workspace: reply.data.workspace.id,
      source: row.id,
      revision: row.revision,
    });
  if (row.stack_id) {
    const stack = await runtime.DB.prepare(
      "SELECT id,published_revision FROM creator_stacks WHERE id=? AND workspace_id=? AND status='published'",
    )
      .bind(row.stack_id, reply.data.workspace.id)
      .first<{ id: string; published_revision: number }>();
    if (stack)
      await captureNativeWorkflowSource(ctx.user, runtime, {
        recipe: "release-summary",
        workspace: reply.data.workspace.id,
        source: stack.id,
        revision: stack.published_revision,
      });
  }
}

type PostWriteAccessFailure = {
  ok: false;
  code: "FORBIDDEN" | "UNAVAILABLE";
  message: string;
};

/** Keep the exact confirmed source response for an authorised caller, even if
 * draft capture fails. Recheck private response access after all awaits: a
 * revoked caller gets no old snapshot and must not replay the completed write. */
export async function afterNativeWorkflowWrite<T>(
  kind: "stacks" | "platform",
  ctx: Context,
  runtime: Runtime,
  result: T,
): Promise<T | PostWriteAccessFailure> {
  if (
    ctx.request.method !== "POST" ||
    ctx.request.headers.get("Origin") !== "https://composer.loftwah.com" ||
    ctx.request.headers.get("X-EmDash-Request") !== "1" ||
    !ctx.user ||
    !runtime.DB
  )
    return result;
  const action = z.object({ action: z.string() }).safeParse(ctx.input);
  if (
    !action.success ||
    !(
      kind === "stacks"
        ? ["publish", "republish"]
        : ["submit", "update", "revise", "review", "run", "reconcile"]
    ).includes(action.data.action)
  )
    return result;
  const reply =
    kind === "stacks"
      ? stackReply.safeParse(result)
      : platformReply.safeParse(result);
  if (!reply.success) return result;
  try {
    await captureAfterWrite(kind, ctx, runtime, result);
  } catch {
    // Never rewrite a confirmed publication/frozen plan or repeat its business
    // operation because a local draft follow-up failed. Log no input or secrets.
    console.warn(
      "WORKFLOW_POST_WRITE_CAPTURE_UNAVAILABLE: use the existing Scan recovery.",
    );
  }
  let role: Awaited<ReturnType<typeof membership>>;
  try {
    role = await membership(runtime.DB, reply.data.workspace.id, ctx.user.id);
  } catch {
    return {
      ok: false,
      code: "UNAVAILABLE",
      message:
        "The write may already have completed, but current workspace access could not be confirmed. Do not replay it; refresh access and inspect its saved state.",
    };
  }
  if (!capabilityFor(role, "save"))
    return {
      ok: false,
      code: "FORBIDDEN",
      message:
        "Workspace access changed after this write. It may already have completed. Do not replay it; restore access and inspect its saved state.",
    };
  return result;
}
