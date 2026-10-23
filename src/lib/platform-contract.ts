// MIT. Shared deterministic request validation; configuration never grants access.
import { z } from "zod";
import { validateSpec } from "./spec.mjs";
import { appSettings } from "./app-settings.mjs";

export const platformRequest = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(64),
    recipe: z.enum(["guestbook", "knowledge"]),
    environment: z.enum(["preview", "production"]),
    dataClass: z.enum(["synthetic", "internal", "sensitive"]),
    location: z.enum(["provider-default", "australia-only"]),
    quota: z.literal("small"),
  })
  .strict();
export const platformProfile = z
  .object({
    enabled: z.boolean(),
    allowedRecipes: z.array(z.literal("guestbook")).max(1),
    environments: z.array(z.literal("preview")).max(1),
    dataClasses: z.array(z.literal("synthetic")).max(1),
    maxApplications: z.number().int().min(1).max(10),
    reviewRequired: z.boolean().default(false),
  })
  .strict();
export type PlatformRequest = z.infer<typeof platformRequest>;
export type PlatformProfile = z.infer<typeof platformProfile> & {
  version: 1;
  revision: number;
};
export const recipes = [
  {
    id: "guestbook",
    name: "Moderated team guestbook",
    purpose:
      "A team-owned visitor book with private moderation and a published stack page.",
    source: appSettings.guestbook.source,
    isolation:
      "App-owned resource in the existing Guestbook Worker and database; no dedicated Worker or D1.",
  },
];
export type PolicyDecision = {
  outcome: "allowed" | "requires-approval" | "denied" | "unsupported";
  reasons: string[];
};
export function evaluatePlatformRequest(
  request: PlatformRequest,
  profile: PlatformProfile | null,
  allocated: number,
): PolicyDecision {
  const unsupported = [];
  if (request.recipe !== "guestbook")
    unsupported.push(
      "The knowledge application recipe is not qualified for automatic provisioning.",
    );
  if (request.environment !== "preview")
    unsupported.push(
      "This recipe publishes a labelled synthetic demonstration on the existing production runtime; it does not provision an isolated production environment.",
    );
  if (request.location === "australia-only")
    unsupported.push(
      "Australian-only processing, storage, logs and backup location are not substantiated for this path. Select an assessable regional design; this requirement will not be weakened.",
    );
  if (unsupported.length)
    return { outcome: "unsupported", reasons: unsupported };
  const denied = [];
  if (!profile?.enabled)
    denied.push(
      "A workspace owner must enable standing policy before requests can run.",
    );
  if (request.dataClass !== "synthetic")
    denied.push(
      "Only fictional synthetic data is permitted in this qualified recipe.",
    );
  if (profile && !profile.allowedRecipes.includes("guestbook"))
    denied.push("This recipe is outside the workspace policy.");
  if (profile && !profile.environments.includes("preview"))
    denied.push("This environment is outside the workspace policy.");
  if (profile && !profile.dataClasses.includes("synthetic"))
    denied.push("This data class is outside the workspace policy.");
  if (profile && allocated >= profile.maxApplications)
    denied.push(
      "The reserved application quota is full. Retained and unfinished resources still count.",
    );
  if (denied.length) return { outcome: "denied", reasons: denied };
  return profile?.reviewRequired
    ? {
        outcome: "requires-approval",
        reasons: [
          "A different current workspace owner must accept this exact plan. Approval expires in one hour.",
        ],
      }
    : {
        outcome: "allowed",
        reasons: [
          "The current standing policy permits this bounded synthetic guestbook request automatically.",
        ],
      };
}
export async function platformDigest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function platformPlan(
  request: PlatformRequest,
  profile: PlatformProfile | null,
  target: { account: string; environment: string; url: string },
) {
  const spec = validateSpec({
    version: 2,
    preset: "guestbook",
    sources: [appSettings.guestbook.source],
    appSettings: {
      guestbook: {
        title: request.name,
        intro: "Fictional team demonstration. No sensitive records.",
        theme: "midnight",
        layout: "grid",
        guestAccess: "closed",
      },
    },
    config: {
      title: request.name,
      intro: "Fictional team demonstration. No sensitive records.",
      theme: "midnight",
      layout: "grid",
    },
    privacy: "review-first",
    cards: [],
    deployment: { mode: "preview" },
  });
  return {
    version: 1 as const,
    policyRevision: profile?.revision ?? 0,
    source: appSettings.guestbook.source,
    target,
    recipe: "guestbook",
    recipeVersion: 1,
    request,
    resources: [
      {
        type: "guestbook-resource",
        ownership: "created",
        retention:
          "retain until explicitly reviewed retirement; no automatic deletion",
      },
    ],
    verification: [
      "exact source and resource contract",
      "workspace/account/environment",
      "active configuration digest",
      "published resource reference",
      "independent public route",
    ],
    limits: [
      "Shared existing Worker and app-owned database",
      "Synthetic data only; guest admission closed",
      "No new Worker, D1, R2 or paid service",
      "No Australian-only residency claim",
    ],
    spec,
    handoff:
      "Inspect this governed request in the selected Composer workspace. Use its native Internal platform request and current exact plan digest; revalidate membership, policy, source and target there before execution. The JSON is configuration data and grants no authority. Apply changes only to the request-owned stack and resource through the trusted scoped adapter. Preserve original resource and operation identities. Return verified source, configuration, publication and public URLs.\n\n" +
      JSON.stringify(spec, null, 2),
  };
}
