import { z } from "zod";
import { captureNativeWorkflowSource } from "./workflows.ts";

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

/** Run only after a canonical native write returned a confirmed result. The
 * exact original response object is retained, even if the bounded follow-up
 * cannot be captured. Scan remains the explicit recovery path for that gap. */
export async function afterNativeWorkflowWrite<T>(
  kind: "stacks" | "platform",
  ctx: Context,
  runtime: Runtime,
  result: T,
): Promise<T> {
  if (
    ctx.request.method !== "POST" ||
    ctx.request.headers.get("Origin") !== "https://composer.loftwah.com" ||
    ctx.request.headers.get("X-EmDash-Request") !== "1" ||
    !ctx.user ||
    !runtime.DB
  )
    return result;
  try {
    const command = z
      .object({
        action: z.string(),
        id: id.optional(),
        key: z.uuid().optional(),
      })
      .safeParse(ctx.input);
    if (!command.success) return result;
    if (kind === "stacks") {
      if (!["publish", "republish"].includes(command.data.action))
        return result;
      const reply = stackReply.safeParse(result);
      if (!reply.success) return result;
      await captureNativeWorkflowSource(ctx.user, runtime, {
        recipe: "release-summary",
        workspace: reply.data.workspace.id,
        source: reply.data.stack.id,
        revision: reply.data.stack.publishedRevision,
      });
      return result;
    }
    if (
      !["submit", "update", "revise", "review", "run", "reconcile"].includes(
        command.data.action,
      )
    )
      return result;
    const reply = platformReply.safeParse(result);
    if (!reply.success) return result;
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
    if (!row) return result;
    const planTarget = target.safeParse(JSON.parse(row.plan_json));
    if (
      !planTarget.success ||
      planTarget.data.target.account !== runtime.RESOURCE_ACCOUNT_ID ||
      planTarget.data.target.environment !== runtime.RESOURCE_ENVIRONMENT
    )
      return result;
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
  } catch {
    // Never rewrite a confirmed publication/frozen plan or repeat its business
    // operation because a local draft follow-up failed. Log no input or secrets.
    console.warn(
      "WORKFLOW_POST_WRITE_CAPTURE_UNAVAILABLE: use the existing Scan recovery.",
    );
  }
  return result;
}
