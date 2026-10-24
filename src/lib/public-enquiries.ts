import { queueEnquiryNotification } from "./enquiry-notifications.ts";
import { z } from "zod";
import { enquiryModel } from "../enquiries/enquiry-model.ts";
import { resourceConnection } from "./resource-client.ts";
import {
  appScope,
  publicationEnquiry,
  confirmPublication,
  type EnquiryRuntime,
} from "./private-enquiries.ts";
import {
  enquiryFormReply,
  enquiryReceipt,
  enquiryIntent,
  enquirySubmission,
} from "./enquiry-protocol.ts";
import { StackError } from "./stacks.mjs";
const origin = "https://composer.loftwah.com";
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
const receiptBody = z
  .object({ contract: z.literal(1), intent: enquiryIntent })
  .strict();
export async function publishedEnquiry(
  runtime: EnquiryRuntime,
  slug: string,
  instance: string,
) {
  if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB)
    throw new StackError(
      "UNAVAILABLE",
      "This enquiry form is disconnected.",
      503,
    );
  const selected = await publicationEnquiry(runtime.DB, slug, instance);
  if (!selected)
    throw new StackError(
      "NOT_FOUND",
      "This publication has no available private enquiry form.",
      404,
    );
  const connection = resourceConnection(runtime, selected.row.workspace_id);
  const guard = async () => {
    await confirmPublication(runtime.DB!, selected);
    const row = await runtime
      .DB!.prepare(
        "SELECT id FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=? AND state='ready'",
      )
      .bind(
        selected.scope.resource,
        selected.row.workspace_id,
        connection.account,
        connection.environment,
        connection.target,
      )
      .first();
    if (!row)
      throw new StackError(
        "NOT_FOUND",
        "This publication’s visitor book is unavailable.",
        404,
      );
  };
  await guard();
  const remote = await connection.enquiry(
    selected.scope.resource,
    "",
    { contract: 1, action: "form", scope: appScope(selected.scope) },
    undefined,
    undefined,
    guard,
  );
  await guard();
  if (remote.status !== 200)
    throw new StackError(
      "UNAVAILABLE",
      "The app could not verify this private enquiry form.",
      503,
    );
  const form = enquiryFormReply.parse(remote.body);
  if (JSON.stringify(form.model) !== JSON.stringify(enquiryModel()))
    throw new StackError(
      "UNAVAILABLE",
      "The app returned another form model.",
      503,
    );
  if (form.source !== connection.source)
    throw new StackError(
      "UNAVAILABLE",
      "The current app source could not be verified.",
      503,
    );
  if (
    !form.open ||
    !form.scope ||
    JSON.stringify(form.scope.provenance) !== JSON.stringify(selected.scope)
  )
    throw new StackError(
      "NOT_FOUND",
      "Private enquiries are closed for this exact publication.",
      404,
    );
  return { selected, connection, guard, form };
}
async function boundedBody(request: Request) {
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new StackError(
      "INVALID",
      "Use this form’s declared JSON fields.",
      415,
    );
  const reader = request.body?.getReader();
  if (!reader) throw new StackError("INVALID", "The form body is missing.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 12288) {
      await reader.cancel();
      throw new StackError(
        "INVALID",
        "Keep this brief within the declared form size.",
        413,
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new StackError("INVALID", "The form body is not valid JSON.", 400);
  }
}
export async function publicEnquiryRequest(
  request: Request,
  runtime: EnquiryRuntime,
  slug: string,
  instance: string,
  kind: "submit" | "receipt",
) {
  try {
    if (
      request.method !== "POST" ||
      new URL(request.url).search ||
      request.headers.get("Origin") !== origin ||
      request.headers.get("X-Guestbook-Enquiry-Target") !== origin
    )
      throw new StackError(
        "FORBIDDEN",
        "Open this form from its current Composer address.",
        403,
      );
    const value = await boundedBody(request),
      parsed = (kind === "submit" ? enquirySubmission : receiptBody).safeParse(
        value,
      );
    if (!parsed.success)
      throw new StackError(
        "INVALID",
        "Use only the declared private enquiry fields and explicit consent.",
        400,
      );
    const body = parsed.data;
    const { selected, connection, guard } = await publishedEnquiry(
      runtime,
      slug,
      instance,
    );
    if (
      request.headers.get("X-Composer-Enquiry-Key") !== selected.key ||
      request.headers.get("X-Guestbook-Enquiry-Source") !== connection.source
    )
      throw new StackError(
        "CONFLICT",
        "The publication or app source changed. Keep your brief and intent; open the current form before another delivery.",
        409,
      );
    const command =
      kind === "submit"
        ? {
            contract: 1,
            action: "submit",
            scope: appScope(selected.scope),
            submission: body,
          }
        : {
            contract: 1,
            action: "deliveryReceipt",
            scope: appScope(selected.scope),
            intent: body.intent,
          };
    const remote = await connection.enquiry(
      selected.scope.resource,
      "",
      command,
      request.headers.get("CF-Connecting-IP") ?? "local",
      undefined,
      guard,
    );
    if (remote.status < 200 || remote.status >= 300) {
      const error = z
        .object({
          error: z.string().max(700),
          outcome: z.literal("unknown").optional(),
        })
        .safeParse(remote.body);
      return response(
        {
          contract: 1,
          ...(remote.status >= 500 ? { outcome: "unknown" } : {}),
          error: error.success
            ? error.data.error
            : "The app did not confirm delivery. Keep this intent and check its receipt.",
        },
        remote.status >= 500
          ? 503
          : [400, 403, 404, 409, 413, 415, 429].includes(remote.status)
            ? remote.status
            : 503,
      );
    }
    const receipt = enquiryReceipt.parse(remote.body);
    if (
      receipt.intent !== body.intent ||
      (kind === "submit" && !receipt.received)
    )
      throw Error("Unconfirmed exact delivery receipt");
    if (receipt.received) {
      // Notification failure must never reverse or duplicate the confirmed brief.
      // This only queues metadata. Provider effects require a later owner action.
      try {
        await queueEnquiryNotification(
          runtime.DB!,
          {
            workspace: selected.row.workspace_id,
            resource: selected.scope.resource,
            account: connection.account,
            environment: connection.environment,
            target: connection.target,
          },
          receipt.intent,
        );
      } catch {
        /* The app-owned receipt remains authoritative; native status exposes connection failures. */
      }
    }
    // No private body or app owner authority leaves the server boundary.
    return response(receipt, kind === "submit" ? 201 : 200);
  } catch (error) {
    return response(
      {
        contract: 1,
        ...(!(error instanceof StackError) ? { outcome: "unknown" } : {}),
        error:
          error instanceof StackError
            ? error.message
            : "The delivery could not be confirmed. Keep the exact intent and check its bounded receipt; nothing was resent.",
      },
      error instanceof StackError
        ? error.code === "UNAVAILABLE" || error.code === "UNKNOWN"
          ? 503
          : error.status
        : 503,
    );
  }
}
