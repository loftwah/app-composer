import { z } from "zod";
import { enquiryID, enquiryIntent } from "./enquiry-protocol.ts";

// The reply job is Composer-owned. Guestbook still owns the brief, the consented
// recipient and retention. These values are the only reply contract the native
// Inbox renders; a v1 no-contact brief never has enough information to parse it.
export const replyVersion = "composer.enquiry-reply/1";
export const replyLimits = Object.freeze({
  body: 4000,
  subject: 120,
  generatorId: 80,
  reason: 400,
  timeline: 20,
  receipt: 12000,
});
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const fingerprint = z.string().regex(/^[a-f0-9]{12}$/);
const instant = z.string().min(1).max(40);
const email = z
  .string()
  .max(254)
  .regex(/^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/);

export const replyStates = z.enum([
  "unavailable",
  "draft",
  "approved",
  "exported",
  "invalidated",
  "declined",
]);
export const replyGenerators = z.enum(["owner", "agent"]);
export const replyEventKinds = z.enum([
  "draft",
  "approved",
  "exported",
  "invalidated",
  "declined",
]);
export const replyNextKinds = z.enum(["draft", "approve", "export", "none"]);

// A reply is plain text, not HTML. Tab, line feed and carriage return (only as
// part of CRLF) are accepted; other control characters are refused so the text
// cannot carry hidden protocol or header content into a mail client.
export const replyBodyValue = z
  .string()
  .min(1)
  .max(replyLimits.body)
  .refine(
    (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
    "The reply contains an unsupported control character.",
  )
  .refine(
    (value) => !/\r(?!\n)/.test(value),
    "Use a line feed for each line break.",
  );

/** The subject is derived from the brief title and can never carry a newline or
 * another header. The brief itself remains untrusted text. */
export function replySubject(title: string) {
  const clean = title
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ("Re: " + (clean || "Your enquiry")).slice(0, replyLimits.subject);
}

export const replyCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("replyDraft"),
      workspace: enquiryID.optional(),
      resource: enquiryID,
      item: enquiryID,
      expectedRevision: revision,
      body: replyBodyValue,
      generator: replyGenerators,
      generatorId: z.string().min(1).max(replyLimits.generatorId).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.generator === "agent" && !value.generatorId)
        context.addIssue({
          code: "custom",
          path: ["generatorId"],
          message: "Name the agent that proposed this draft.",
        });
    }),
  z
    .object({
      action: z.literal("replyApprove"),
      workspace: enquiryID.optional(),
      resource: enquiryID,
      item: enquiryID,
      expectedRevision: z.number().int().positive(),
      expectedDigest: digest,
    })
    .strict(),
  z
    .object({
      action: z.literal("replyExport"),
      workspace: enquiryID.optional(),
      resource: enquiryID,
      item: enquiryID,
      expectedApproval: enquiryIntent,
      expectedDigest: digest,
    })
    .strict(),
  z
    .object({
      action: z.literal("replyDecline"),
      workspace: enquiryID.optional(),
      resource: enquiryID,
      item: enquiryID,
      expectedRevision: z.number().int().positive(),
      reason: z.string().max(replyLimits.reason).optional(),
    })
    .strict(),
]);
export type ReplyCommand = z.infer<typeof replyCommand>;

const replyTimelineEvent = z
  .object({
    kind: replyEventKinds,
    at: instant,
    actorId: z.string().min(1).max(64),
    draftRevision: z.number().int().positive(),
    digest: fingerprint.nullable(),
    reason: z.string().max(replyLimits.reason),
  })
  .strict();

export const replyView = z
  .object({
    eligible: z.boolean(),
    state: replyStates,
    reason: z.string().max(1000),
    consent: z
      .object({
        version: z.literal(2),
        consentedAt: instant,
        expiresAt: instant,
        expired: z.boolean(),
        recipientFingerprint: fingerprint,
      })
      .strict()
      .nullable(),
    source: z
      .object({
        itemRevision: z.number().int().positive(),
        digest: digest,
      })
      .strict()
      .nullable(),
    draft: z
      .object({
        revision: z.number().int().positive(),
        body: z.string().min(1).max(replyLimits.body),
        digest,
        generator: replyGenerators,
        generatorId: z.string().max(replyLimits.generatorId).nullable(),
        updatedAt: instant,
      })
      .strict()
      .nullable(),
    approval: z
      .object({
        id: enquiryIntent,
        digest,
        approvedAt: instant,
        approvedBy: z.string().min(1).max(64),
        expiresAt: instant,
      })
      .strict()
      .nullable(),
    receipt: z
      .object({
        id: enquiryIntent,
        exportedAt: instant,
        method: z.literal("manual-export"),
        sent: z.literal(false),
        draftDigest: digest,
        approvalDigest: digest,
      })
      .strict()
      .nullable(),
    timeline: z.array(replyTimelineEvent).max(replyLimits.timeline),
    next: z
      .object({
        kind: replyNextKinds,
        label: z.string().min(1).max(80),
        detail: z.string().min(1).max(400),
        actor: z.enum(["owner", "owner-or-editor", "none"]),
        enabled: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type ReplyView = z.infer<typeof replyView>;

// Returned only by the explicit manual-export action. The recipient is shown
// once from the app-owned consent record and is never persisted by Composer.
export const manualExport = z
  .object({
    id: enquiryIntent,
    job: enquiryID,
    item: enquiryID,
    itemRevision: z.number().int().positive(),
    recipient: email.nullable(),
    subject: z.string().min(1).max(replyLimits.subject),
    body: z.string().min(1).max(replyLimits.body),
    receipt: z.string().min(1).max(replyLimits.receipt),
    method: z.literal("manual-export"),
    sent: z.literal(false),
    approvedAt: instant,
    exportedAt: instant,
    approvalDigest: digest,
    idempotent: z.boolean(),
  })
  .strict();
export type ManualExport = z.infer<typeof manualExport>;

export const replyLabels: Record<z.infer<typeof replyStates>, string> = {
  unavailable: "No reply consent",
  draft: "Draft",
  approved: "Approved, not sent",
  exported: "Exported for manual sending",
  invalidated: "Approval invalid",
  declined: "Declined",
};
export const replyNextLabels: Record<z.infer<typeof replyNextKinds>, string> = {
  draft: "Save a reply draft",
  approve: "Approve the exact reply",
  export: "Export the approved reply",
  none: "No reply action",
};
