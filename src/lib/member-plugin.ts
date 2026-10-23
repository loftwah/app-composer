import { definePlugin } from "emdash";
import { manageMembers, type MemberRuntime } from "./member-access.ts";
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
