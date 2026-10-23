// Reviewed local source contracts only. Imported specifications cannot qualify
// a member service or select its runtime binding.
import { z } from "zod";
import composition from "../../composition.lock.json" with { type: "json" };

export const memberServiceV2 = z
  .object({
    version: z.literal(2),
    entrypoint: z.literal("GuestbookMemberService"),
    transport: z.literal("service-binding"),
    path: z.literal("/__composer/member"),
  })
  .strict();

export function qualifiedMemberManifest(manifest: unknown): boolean {
  const parsed = z
    .object({
      id: z.literal("guestbook"),
      memberService: memberServiceV2,
      configuration: z.object({
        guestAccess: z.object({
          type: z.literal("select"),
          default: z.literal("closed"),
          options: z.tuple([
            z.literal("closed"),
            z.literal("postcards"),
            z.literal("members"),
          ]),
        }),
      }),
    })
    .safeParse(manifest);
  return parsed.success;
}

export function memberContributionsQualified(): boolean {
  return qualifiedMemberManifest(
    composition.apps.find((app) => app.id === "guestbook")?.manifest,
  );
}

export const contributionInput = z
  .object({
    operationId: z.uuid(),
    caption: z.string().trim().min(1).max(160),
    author: z.string().trim().min(1).max(60),
    consent: z.literal(true),
    png: z.string().min(1).max(150000),
  })
  .strict();
export const contributionLookup = z.object({ operationId: z.uuid() }).strict();
export const contributionConfiguration = z
  .object({
    revision: z.number().int().positive(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    source: z.string().regex(/^[a-f0-9]{40}$/),
  })
  .strict();
export const contributionReceipt = z.object({
  id: z.string().min(1).max(128),
  resource: z.string().regex(/^[a-z0-9-]{6,64}$/),
  operationId: z.uuid(),
  status: z.literal("pending"),
  message: z.string().max(500),
});
export const contributionStatus = z
  .object({
    contract: z.literal(2),
    resource: z.string().regex(/^[a-z0-9-]{6,64}$/),
    operationId: z.uuid(),
    outcome: z.enum(["not-recorded", "pending", "completed"]),
    // Composer supplies this observation after checking current governed state.
    // An app response cannot select its own resume eligibility.
    resumablePending: z.boolean().optional(),
    receipt: contributionReceipt.optional(),
    identity: z
      .object({
        configuration: contributionConfiguration,
        bodyDigest: z.string().regex(/^[a-f0-9]{64}$/),
        dataClass: z.literal("synthetic"),
      })
      .optional(),
  })
  .refine((value) => value.outcome !== "completed" || !!value.receipt);

export function pendingContributionResumable(
  value: unknown,
  configuration: z.infer<typeof contributionConfiguration>,
  contributionAllowed: boolean,
) {
  const observed = contributionStatus.safeParse(value);
  const original = observed.success ? observed.data.identity : undefined;
  return (
    contributionAllowed &&
    observed.success &&
    observed.data.outcome === "pending" &&
    !!original &&
    original.configuration.revision === configuration.revision &&
    original.configuration.digest === configuration.digest &&
    original.configuration.source === configuration.source
  );
}
