import { managePlatform } from "./platform-admin.ts";
import { definePlugin } from "emdash";
import { creatorPermission } from "./creator-access.ts";
import { manageStacks } from "./stacks-admin.mjs";
import { manageWorkspaceAccess } from "./workspace-access.ts";
import { managePrivateOutcomes } from "./private-outcomes.ts";
import { manageMaintenance } from "./creator-maintenance.ts";
import { manageEnquiries } from "./private-enquiries.ts";
import { manageInboxJourney } from "./inbox-journey.ts";
import { manageWorkflows } from "./workflows.ts";
import { afterNativeWorkflowWrite } from "./workflow-events.ts";
import { manageOverview } from "./overview.ts";
import { manageOrders } from "./orders.ts";
import { manageConnections } from "./connections.ts";
import { manageResourceInventory } from "./resource-inventory.ts";
import { manageAgentProposals } from "./agent-proposals.ts";
import { manageProviderInventory } from "./provider-read.ts";

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
        { path: "/overview", label: "Needs attention", icon: "warning" },
        { path: "/orders", label: "Orders", icon: "receipt" },
        { path: "/connections", label: "Connections", icon: "plugs" },
        { path: "/resources", label: "App resources", icon: "cloud" },
        { path: "/proposals", label: "Agent proposals", icon: "robot" },
      ],
    },
    routes: {
      proposalsRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageAgentProposals(ctx, runtime),
      },
      proposalsWrite: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 8000 },
        handler: (ctx) => manageAgentProposals(ctx, runtime),
      },
      connectionsRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageConnections(ctx, runtime),
      },
      resourcesRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageResourceInventory(ctx, runtime),
      },
      providerRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageProviderInventory(ctx, runtime),
      },
      overviewRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageOverview(ctx, runtime),
      },
      ordersRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageOrders(ctx, runtime),
      },
      ordersWrite: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 4000 },
        handler: (ctx) => manageOrders(ctx, runtime),
      },
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
        handler: async (ctx) =>
          afterNativeWorkflowWrite(
            "platform",
            ctx,
            runtime,
            await managePlatform(ctx, runtime),
          ),
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
        handler: async (ctx) =>
          afterNativeWorkflowWrite(
            "stacks",
            ctx,
            runtime,
            await manageStacks(ctx, runtime),
          ),
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
      journeyRead: {
        methods: ["GET"],
        permission: creatorPermission,
        handler: (ctx) => manageInboxJourney(ctx, runtime),
      },
      journeyWrite: {
        methods: ["POST"],
        permission: creatorPermission,
        request: { body: "json", maxBytes: 4000 },
        handler: (ctx) => manageInboxJourney(ctx, runtime),
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
