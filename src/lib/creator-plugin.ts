import { definePlugin } from "emdash";
import { creatorPermission } from "./creator-access.ts";
import { manageStacks } from "./stacks-admin.mjs";
import { manageWorkspaceAccess } from "./workspace-access.ts";

type Runtime = Parameters<typeof manageWorkspaceAccess>[1];

// Keep the descriptor callable with its server-owned environment so tests can
// exercise these exact route declarations through EmDash's policy dispatcher.
export function creatorPlugin(adminEntry: string, runtime: Runtime) {
  return definePlugin({
    id: "composer-stacks",
    version: "1.0.0",
    admin: {
      entry: adminEntry,
      pages: [
        { path: "/stacks", label: "Creator stacks", icon: "stack" },
        { path: "/workspaces", label: "Workspace access", icon: "users" },
      ],
    },
    routes: {
      read: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageStacks(ctx, runtime),
      },
      write: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 120000 },
        handler: (ctx) => manageStacks(ctx, runtime),
      },
      accessRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageWorkspaceAccess(ctx, runtime),
      },
      accessWrite: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 8000 },
        handler: (ctx) => manageWorkspaceAccess(ctx, runtime),
      },
    },
  });
}
