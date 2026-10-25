import { z } from "zod";
import {
  enquiryID,
  enquiryIntent,
  enquiryScope,
  enquiryValues,
} from "./enquiry-protocol.ts";

export const inboxJourneyVersion = "composer.inbox-journey/1";

// The workflow run tracks Composer's own preparation work. Guestbook owns the
// brief; the delivery state tracks the separate outbox row from migration 0013.
export const journeyStates = z.enum([
  "unlinked",
  "queued",
  "running",
  "finished",
  "failed",
]);
export const deliveryStates = z.enum([
  "unconfigured",
  "ready",
  "attempted",
  "accepted",
  "uncertain",
  "failed",
]);
export const enquiryStates = z.enum(["new", "reviewed", "rejected"]);
export const nextKinds = z.enum([
  "process",
  "send",
  "reconcile",
  "review",
  "none",
]);

const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const inboxJourney = z
  .object({
    ok: z.literal(true),
    version: z.literal(inboxJourneyVersion),
    workspace: z
      .object({
        id: enquiryID,
        name: z.string().max(120),
        role: z.enum(["owner", "editor", "viewer"]),
      })
      .strict(),
    scope: z
      .object({
        resource: enquiryID,
        account: z.string().min(1).max(80),
        environment: z.string().min(1).max(40),
        target: z.url(),
        source: z.string().regex(/^[a-f0-9]{40}$/),
      })
      .strict(),
    resourceVersion: revision,
    enquiry: z
      .object({
        id: enquiryID,
        status: enquiryStates,
        revision: z.number().int().positive(),
        createdAt: z.string().max(40),
        expiresAt: z.string().max(40),
        title: z.string().min(1).max(120),
        goal: z.string().min(1).max(2000),
        startingPoint: enquiryValues.shape.starting_point,
        existingSite: z.string().max(240).nullable(),
        deliverables: enquiryValues.shape.deliverables,
        provenance: enquiryScope,
      })
      .strict(),
    workflow: z
      .object({
        state: journeyStates,
        attempts: z.number().int().min(0).max(3),
        maxAttempts: z.literal(3),
        reason: z.string().max(1000),
        revision: revision,
        actor: z
          .object({
            kind: z.enum(["system", "member"]),
            id: z.string().min(1).max(64),
          })
          .strict()
          .nullable(),
        outboxId: enquiryIntent.nullable(),
        updatedAt: z.string().max(40).nullable(),
      })
      .strict(),
    delivery: z
      .object({
        state: deliveryStates,
        attempts: z.number().int().min(0).max(3),
        maxAttempts: z.literal(3),
        reason: z.string().max(1000),
        providerReference: z.string().max(64).nullable(),
        destination: z
          .object({
            // Ready means the server has a sender and an allowlisted owner
            // address. It is not a provider account or delivery check.
            configured: z.boolean(),
            verified: z.boolean(),
            fingerprint: z
              .string()
              .regex(/^[a-f0-9]{12}$/)
              .nullable(),
          })
          .strict(),
        reconciledAt: z.string().max(40).nullable(),
        reconciliations: z.number().int().min(0).max(100),
        updatedAt: z.string().max(40).nullable(),
      })
      .strict(),
    notificationPreference: z
      .object({
        enabled: z.boolean(),
        revision: revision,
      })
      .strict(),
    next: z
      .object({
        kind: nextKinds,
        label: z.string().min(1).max(80),
        detail: z.string().min(1).max(400),
        actor: z.enum(["owner", "owner-or-editor", "none"]),
        enabled: z.boolean(),
      })
      .strict(),
    timezone: z.literal("UTC"),
  })
  .strict();
export type InboxJourney = z.infer<typeof inboxJourney>;
export type JourneyState = z.infer<typeof journeyStates>;
export type DeliveryState = z.infer<typeof deliveryStates>;
export type NextKind = z.infer<typeof nextKinds>;

export const journeyCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("process"),
      workspace: enquiryID.optional(),
      resource: enquiryID,
      item: enquiryID,
    })
    .strict(),
  z
    .object({
      action: z.literal("send"),
      workspace: enquiryID.optional(),
      resource: enquiryID,
      item: enquiryID,
    })
    .strict(),
  z
    .object({
      action: z.literal("reconcile"),
      workspace: enquiryID.optional(),
      resource: enquiryID,
      item: enquiryID,
    })
    .strict(),
]);
export type JourneyCommand = z.infer<typeof journeyCommand>;

export const enquiryState = (
  status: "pending" | "reviewed" | "rejected",
): z.infer<typeof enquiryStates> => (status === "pending" ? "new" : status);

export const workflowLabels: Record<JourneyState, string> = {
  unlinked: "No exact link",
  queued: "Queued",
  running: "Running",
  finished: "Finished",
  failed: "Failed",
};
export const deliveryLabels: Record<DeliveryState, string> = {
  unconfigured: "Not configured",
  ready: "Ready to send",
  attempted: "Attempt in progress",
  accepted: "Accepted by provider",
  uncertain: "Outcome uncertain",
  failed: "Send failed",
};
export const enquiryLabels: Record<z.infer<typeof enquiryStates>, string> = {
  new: "New",
  reviewed: "Reviewed",
  rejected: "Rejected",
};

// A read returns the whole journey; a write returns only a status envelope.
// Validating a read with the write envelope rejected every real journey
// ("Unrecognized keys: version, workspace, …") and surfaced Zod's JSON to the
// owner. Keep the two shapes separate and never rethrow a schema dump.
const envelope = z
  .object({ ok: z.boolean(), message: z.string().max(400).optional() })
  .strict();

const unreadable =
  "The enquiry journey response did not match the supported contract. Refresh before another action.";

/** The supported status of one journey request, read or write. */
export function journeyResponse(raw: unknown, writing: boolean): { ok: boolean; message?: string } {
  if (writing) {
    const parsed = envelope.safeParse(raw);
    if (!parsed.success) throw new Error(unreadable);
    return parsed.data;
  }
  if (!raw || typeof raw !== "object" || (raw as { ok?: unknown }).ok !== true)
    throw new Error("The enquiry journey request was refused.");
  const parsed = inboxJourney.safeParse(raw);
  if (!parsed.success) throw new Error(unreadable);
  return { ok: true };
}

/** The exact journey payload, or one readable failure instead of a schema dump. */
export function readJourneyPayload(raw: unknown): InboxJourney {
  const parsed = inboxJourney.safeParse(raw);
  if (!parsed.success) throw new Error(unreadable);
  return parsed.data;
}
