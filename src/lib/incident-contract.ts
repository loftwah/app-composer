import { z } from "zod";

const text = z.string().trim().min(1).max(600);
const evidenceId = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,39}$/);

/** A SITREP is retained evidence within a proposal, never execution authority. */
export const incidentSitrep = z
  .object({
    version: z.literal("composer.incident-sitrep/1"),
    id: z.string().regex(/^[a-z0-9-]{6,64}$/),
    mode: z.enum(["replay", "isolated-lab"]),
    service: z.string().trim().min(1).max(100),
    owner: z.string().trim().min(1).max(100),
    impact: text,
    firstSeen: z.iso.datetime(),
    lastSeen: z.iso.datetime(),
    observations: z
      .array(z.object({ text, evidence: evidenceId }).strict())
      .min(1)
      .max(12),
    hypotheses: z
      .array(
        z
          .object({
            explanation: text,
            confidence: z.enum(["possible", "supported", "disproved"]),
            nextCheck: text,
          })
          .strict(),
      )
      .min(1)
      .max(6),
    stepsTaken: z.array(text).max(12),
    unknowns: z.array(text).min(1).max(8),
    nextUpdate: text,
    recovery: z.enum(["unverified", "blocked", "verified-in-isolated-lab"]),
    notification: z.enum([
      "not-configured",
      "not-sent",
      "provider-evidence-required",
    ]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Date.parse(value.lastSeen) < Date.parse(value.firstSeen))
      ctx.addIssue({
        code: "custom",
        message: "Last seen must follow first seen.",
        path: ["lastSeen"],
      });
    if (
      value.mode === "replay" &&
      value.recovery === "verified-in-isolated-lab"
    )
      ctx.addIssue({
        code: "custom",
        message: "A replay cannot establish real recovery.",
        path: ["recovery"],
      });
  });
export type IncidentSitrep = z.infer<typeof incidentSitrep>;
