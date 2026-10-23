import { definePlugin, pluginResponse } from "emdash";
import { manageMembers, type MemberRuntime } from "./member-access.ts";
import { manageMemberPlatform } from "./platform-admin.ts";

async function platformReply(
  ctx: Parameters<typeof manageMemberPlatform>[0],
  runtime: MemberRuntime,
) {
  const result = await manageMemberPlatform(ctx, runtime);
  const status = result.ok
    ? 200
    : result.code === "FORBIDDEN"
      ? 403
      : result.code === "CONFLICT"
        ? 409
        : result.code === "UNAVAILABLE"
          ? 503
          : 400;
  return pluginResponse({
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
    body: {
      kind: "text",
      value: JSON.stringify(
        result.ok
          ? { success: true, data: result }
          : {
              success: false,
              error: { code: result.code, message: result.message },
            },
      ),
    },
  });
}
// Subscriber's published-content read permission admits a signed-in account;
// workspace membership and every app/resource/action remain server checks.
export function memberPlugin(
  runtime: MemberRuntime,
  pins: Record<string, string>,
) {
  return definePlugin({
    id: "composer-members",
    version: "1.0.0",
    routes: {
      platformRead: {
        methods: ["GET"],
        permission: "content:read",
        response: "raw",
        handler: (ctx) => platformReply(ctx, runtime),
      },
      platformWrite: {
        methods: ["POST"],
        permission: "content:read",
        request: { body: "json", maxBytes: 8000 },
        response: "raw",
        handler: (ctx) => platformReply(ctx, runtime),
      },
      read: {
        methods: ["GET"],
        permission: "content:read",
        handler: (ctx) => manageMembers(ctx, runtime, pins),
      },
      write: {
        methods: ["POST"],
        permission: "content:read",
        request: { body: "json", maxBytes: 1500000 },
        handler: (ctx) => manageMembers(ctx, runtime, pins),
      },
    },
  });
}
