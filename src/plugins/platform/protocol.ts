import { z } from "zod";
import { validateSpec } from "../../lib/spec.mjs";

const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export {
  platformRequest as requestInput,
  platformProfile as profileInput,
} from "../../lib/platform-contract.ts";
import {
  platformRequest as requestInput,
  platformProfile as profileInput,
} from "../../lib/platform-contract.ts";
const profile = profileInput.extend({ version: z.literal(1), revision });
const decision = z.object({
  outcome: z.enum(["allowed", "requires-approval", "denied", "unsupported"]),
  reasons: z.array(z.string().max(1000)).max(20),
});
const request = z.object({
  id,
  name: z.string().max(80),
  revision,
  status: z.enum([
    "waiting",
    "running",
    "verifying",
    "complete",
    "needs-attention",
    "denied",
    "sent-back",
  ]),
  decision,
  actorIsRequester: z.boolean(),
  resumable: z.boolean(),
  request: requestInput,
  plan: z.object({
    version: z.literal(1),
    policyRevision: revision,
    source: z.object({
      id: z.literal("guestbook"),
      repository: z.string().max(250),
      commit: z.string().regex(/^[a-f0-9]{40}$/),
      manifestDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    }),
    target: z.object({
      account: z.string().min(1).max(80),
      environment: z.string().min(1).max(40),
      url: z.literal("https://composer.loftwah.com/guestbook"),
    }),
    spec: z.unknown(),
  }),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/),
  key: z.string().max(80).optional(),
  stackId: id.nullish(),
  url: z
    .string()
    .regex(/^\/s\/[a-z0-9-]+$/)
    .nullish(),
  createdAt: z.string().max(40).optional(),
  updatedAt: z.string().max(40).optional(),
  message: z.string().max(2000).optional(),
  reason: z.string().max(2000).nullable(),
  resources: z
    .array(
      z
        .object({
          instance: id,
          resource: id,
          app: z.literal("guestbook"),
          shared: z.boolean(),
          state: z.enum(["reserved", "ready", "unknown", "refused"]),
          version: revision,
          configuration: z
            .object({
              revision,
              digest: z.string().regex(/^[a-f0-9]{64}$/),
              source: z.string().regex(/^[a-f0-9]{40}$/),
              path: z.string().max(200),
            })
            .nullable(),
        })
        .refine(
          (value) =>
            !value.configuration ||
            value.configuration.path ===
              `/guestbook/r/${value.resource}/c/${value.configuration.revision}/`,
        ),
    )
    .max(20),
});
const workspace = z.object({
  id,
  name: z.string().max(80),
  role: z.enum(["owner", "editor", "viewer"]),
});
const recipe = z.object({
  id: z.literal("guestbook"),
  name: z.string().max(100),
  purpose: z.string().max(1000),
  source: z.unknown().optional(),
});
const list = z.object({
  ok: z.literal(true),
  workspace,
  profile: profile.nullable(),
  recipes: z.array(recipe).max(10),
  requests: z.array(request).max(1000),
  runner: z.object({
    available: z.boolean(),
    kind: z.literal("existing-resource-adapter"),
    message: z.string().max(2000),
  }),
});
const mutation = z.object({
  ok: z.literal(true),
  workspace: workspace.optional(),
});
export type PlatformProfileInput = z.infer<typeof profileInput>;
export type PlatformRequestInput = z.infer<typeof requestInput>;
export type PlatformSnapshot = z.infer<typeof list>;
export type PlatformRequest = z.infer<typeof request>;
export function decodePlatformList(value: unknown): PlatformSnapshot {
  const parsed = list.safeParse(value);
  if (!parsed.success)
    throw Error(
      "The platform response could not be validated. Keep your entries and refresh before continuing.",
    );
  for (const entry of parsed.data.requests) {
    try {
      entry.plan.spec = validateSpec(entry.plan.spec);
    } catch {
      throw Error(
        "A saved request has an invalid application specification. Keep your entries and ask the operator to inspect it.",
      );
    }
    if (entry.name !== entry.request.name)
      throw Error(
        "A request name disagrees with its validated input. Refresh before continuing.",
      );
    if (
      entry.status === "complete" &&
      (!entry.stackId ||
        !entry.url ||
        !entry.resources.length ||
        entry.resources.some(
          (resource) => resource.state !== "ready" || !resource.configuration,
        ))
    )
      throw Error(
        "A completed service has no confirmed application resource. Refresh and inspect its verification before relying on it.",
      );
  }
  return parsed.data;
}
export function decodePlatformMutation(value: unknown) {
  const parsed = mutation.safeParse(value);
  if (!parsed.success)
    throw Error(
      "The operation has no validated acknowledgement. Refresh requests before retrying.",
    );
  return parsed.data;
}
