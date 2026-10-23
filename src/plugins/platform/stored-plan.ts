// Saved platform plans are inert audit data. Reading one never authorises its
// source or configuration for current execution or global app maintenance.
import { z } from "zod";
import { appSettings } from "../../lib/app-settings.mjs";
import { platformRequest } from "../../lib/platform-contract.ts";

export const retainedSource = z
  .object({
    id: z.literal("guestbook"),
    repository: z.literal(appSettings.guestbook.source.repository),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    manifestDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();
const text = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine(
      (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
    );
const appearance = z
  .object({
    title: text(80).min(1),
    intro: text(240),
    theme: z.enum(["daylight", "midnight"]),
    layout: z.enum(["grid", "editorial"]),
  })
  .strict();
const storedSpec = z
  .object({
    version: z.literal(2),
    preset: z.literal("guestbook"),
    apps: z.tuple([z.literal("guestbook")]),
    sources: z.tuple([retainedSource]),
    appSettings: z
      .object({
        guestbook: appearance
          .extend({ guestAccess: z.enum(["closed", "members"]) })
          .strict(),
      })
      .strict(),
    config: appearance,
    privacy: z.literal("review-first"),
    cards: z.array(z.never()).length(0),
    deployment: z
      .object({
        mode: z.literal("preview"),
        hostname: z.literal(""),
        approval: z.literal("verification-required"),
      })
      .strict(),
    updates: z.literal("validated-manual"),
    decisions: z.object({}).strict(),
  })
  .strict();
const mode = z
  .object({
    requested: z.enum(["closed", "members"]),
    effective: z.enum(["closed", "members"]),
    qualified: z.boolean(),
  })
  .strict();
export const sourceObservation = z.object({
  kind: z.enum(["current", "historical"]),
  currentCommit: z.string().regex(/^[a-f0-9]{40}$/),
  currentManifestDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

export function inspectStoredPlatformPlan(
  plan: {
    source: unknown;
    spec: unknown;
    request: unknown;
    contributionMode?: unknown;
  },
  requested: unknown,
) {
  const source = retainedSource.parse(plan.source),
    spec = storedSpec.parse(plan.spec);
  const request = platformRequest.parse(requested),
    savedRequest = platformRequest.parse(plan.request);
  const savedMode =
    plan.contributionMode === undefined
      ? undefined
      : mode.parse(plan.contributionMode);
  const effective = spec.appSettings.guestbook.guestAccess;
  if (
    JSON.stringify(savedRequest) !== JSON.stringify(request) ||
    Object.entries(source).some(
      ([key, value]) => spec.sources[0][key as keyof typeof source] !== value,
    ) ||
    spec.config.title !== request.name ||
    spec.appSettings.guestbook.title !== request.name ||
    Object.entries(spec.config).some(
      ([key, value]) =>
        spec.appSettings.guestbook[key as keyof typeof spec.config] !== value,
    )
  )
    throw Error(
      "Saved platform plan identity/configuration disagrees with its retained request and source.",
    );
  if (
    request.contributions === undefined
      ? savedMode !== undefined || effective !== "closed"
      : !savedMode ||
        savedMode.requested !== request.contributions ||
        savedMode.effective !== effective ||
        (request.contributions === "closed"
          ? effective !== "closed" || !savedMode.qualified
          : savedMode.qualified
            ? effective !== "members"
            : effective !== "closed")
  )
    throw Error("Saved contribution mode disagrees with its retained request.");
  const current = appSettings.guestbook.source;
  return sourceObservation.parse({
    kind: Object.entries(source).every(
      ([key, value]) => current[key as keyof typeof current] === value,
    )
      ? "current"
      : "historical",
    currentCommit: current.commit,
    currentManifestDigest: current.manifestDigest,
  });
}
