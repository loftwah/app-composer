import { managePlatform } from "./platform-admin.ts";
import { definePlugin } from "emdash";
import { creatorPermission } from "./creator-access.ts";
import { manageStacks } from "./stacks-admin.mjs";
import { manageWorkspaceAccess } from "./workspace-access.ts";
import { managePrivateOutcomes } from "./private-outcomes.ts";
import { manageMaintenance } from "./creator-maintenance.ts";
import { manageEnquiries } from "./private-enquiries.ts";
import { manageWorkflows } from "./workflows.ts";

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
        { path: "/platform", label: "Internal platform", icon: "buildings" },
        { path: "/workspaces", label: "Workspace access", icon: "users" },
        { path: "/outcomes", label: "Analytics & outcomes", icon: "chart" },
        {
          path: "/maintenance",
          label: "Workspace maintenance",
          icon: "wrench",
        },
        { path: "/enquiries", label: "Private enquiries", icon: "inbox" },
        { path: "/workflows", label: "Workflows", icon: "arrows-clockwise" },
      ],
    },
    routes: {
      workflowsRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageWorkflows(ctx, runtime),
      },
      workflowsWrite: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 4000 },
        handler: (ctx) => manageWorkflows(ctx, runtime),
      },
      platformRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => managePlatform(ctx, runtime),
      },
      platformWrite: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 8000 },
        handler: (ctx) => managePlatform(ctx, runtime),
      },
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
      maintenanceRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageMaintenance(ctx, runtime),
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
      enquiriesRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageEnquiries(ctx, runtime),
      },
      enquiriesWrite: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 4000 },
        handler: (ctx) => manageEnquiries(ctx, runtime),
      },
      outcomesRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => managePrivateOutcomes(ctx, runtime),
      },
      outcomesWrite: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 1000 },
        handler: (ctx) => managePrivateOutcomes(ctx, runtime),
      },
    },
  });
}
