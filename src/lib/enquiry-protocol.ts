import { z } from "zod";
export const enquiryID = z.string().regex(/^[a-z0-9-]{6,64}$/);
export const enquirySource = z.string().regex(/^[a-f0-9]{40}$/);
export const enquiryRevision = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const enquiryPositive = enquiryRevision.refine((n) => n > 0);
export const enquiryIntent = z
  .uuid()
  .refine((value) =>
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value,
    ),
  );
const standalone = z
  .object({
    kind: z.literal("standalone"),
    resource: enquiryID,
    configuration: enquiryPositive,
  })
  .strict();
const publication = z
  .object({
    kind: z.literal("composer.publication"),
    resource: enquiryID,
    configuration: enquiryPositive,
    stack: enquiryID,
    publication: enquiryPositive,
    instance: enquiryID,
  })
  .strict();
export const enquiryScope = z.discriminatedUnion("kind", [
  standalone,
  publication,
]);
export type EnquiryScope = z.infer<typeof enquiryScope>;
export const enquiryValues = z
  .object({
    title: z.string().min(1).max(120),
    goal: z.string().min(1).max(2000),
    starting_point: z.enum(["New idea", "Existing site"]),
    existing_site: z.string().max(240).optional(),
    deliverables: z
      .array(
        z
          .object({
            item: z.string().min(1).max(120),
            detail: z.string().max(300).optional(),
          })
          .strict(),
      )
      .max(8),
  })
  .strict();
export const enquirySubmission = z
  .object({
    contract: z.literal(1),
    intent: enquiryIntent,
    values: enquiryValues,
    consent: z.literal(true),
  })
  .strict();
const resource = z.object({
  id: enquiryID,
  workspace_id: enquiryID,
  account_id: z.string().min(1).max(80),
  environment: z.string().max(40),
  target: z.url(),
  version: enquiryRevision,
  active_revision: enquiryPositive.nullable(),
});
export const enquiryItem = z
  .object({
    id: enquiryID,
    scope_key: z.string().max(64),
    configuration_revision: enquiryPositive,
    provenance: enquiryScope,
    model_version: z.literal(1),
    producer_source: enquirySource,
    values: enquiryValues,
    consent_version: z.literal(1),
    consent_at: z.string().max(40),
    status: z.enum(["pending", "reviewed", "rejected"]),
    revision: enquiryPositive,
    created_at: z.string().max(40),
    expires_at: z.string().max(40),
  })
  .strict();
export const enquiryScopeView = z
  .object({
    key: z.string().max(64),
    provenance: enquiryScope,
    enabled: z.boolean(),
    revision: enquiryPositive,
  })
  .strict();
export const enquiryInbox = z
  .object({
    contract: z.literal(1),
    format: z.literal("guestbook.enquiry-inbox/v1"),
    source: enquirySource,
    resource,
    status: z.enum(["pending", "reviewed", "rejected", "all"]),
    page: z.number().int().min(1).max(10),
    limit: z.literal(20),
    retentionDays: z.literal(30),
    notifications: z.literal(false),
    items: z.array(enquiryItem).max(20),
    scopes: z.array(enquiryScopeView).max(64),
  })
  .strict();
export const enquiryExport = z
  .object({
    contract: z.literal(1),
    format: z.literal("guestbook.private-enquiries/v1"),
    source: enquirySource,
    resource,
    retentionDays: z.literal(30),
    items: z.array(enquiryItem).max(200),
    covers: z
      .object({
        privateBodies: z.literal(true),
        consent: z.literal(true),
        provenance: z.literal(true),
        notifications: z.literal(false),
        credentials: z.literal(false),
      })
      .strict(),
    scope: z.literal("current-resource-only"),
  })
  .strict();
const enquiryCount = z.number().int().min(0).max(200);
export const enquirySummary = z
  .object({
    contract: z.literal(1),
    format: z.literal("guestbook.enquiry-summary/v1"),
    source: enquirySource,
    resource,
    retentionDays: z.literal(30),
    atExportLimit: z.boolean(),
    total: enquiryCount,
    groups: z
      .array(
        z
          .object({
            kind: z.enum(["standalone", "composer.publication"]),
            stack: enquiryID.nullable(),
            instance: enquiryID.nullable(),
            publication: enquiryPositive.nullable(),
            pending: enquiryCount,
            reviewed: enquiryCount,
            rejected: enquiryCount,
            total: enquiryCount,
            latest: z.string().max(40).nullable(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();
const operationResource = z
  .object({
    id: enquiryID,
    workspace: enquiryID,
    account: z.string().max(80),
    environment: z.string().max(40),
    target: z.url(),
    version: enquiryPositive,
  })
  .strict();
export const enquiryOperation = z
  .object({
    contract: z.literal(1),
    format: z.literal("guestbook.enquiry-operation/v1"),
    operation: enquiryIntent,
    action: z.enum(["configure", "review", "reject", "delete"]),
    outcome: z.literal("applied"),
    source: enquirySource,
    resource: operationResource,
    scope: enquiryScopeView.nullable(),
    item: z
      .object({
        id: enquiryID,
        status: z.enum(["reviewed", "rejected", "deleted"]),
        revision: enquiryPositive,
      })
      .strict()
      .nullable(),
  })
  .strict();
export const enquiryReceipt = z
  .object({
    contract: z.literal(1),
    intent: enquiryIntent,
    received: z.boolean(),
  })
  .strict();
export type EnquiryInbox = z.infer<typeof enquiryInbox>;
export type EnquiryItem = z.infer<typeof enquiryItem>;
export type EnquirySummary = z.infer<typeof enquirySummary>;
export const enquiryFormReply = z
  .object({
    contract: z.literal(1),
    format: z.literal("guestbook.enquiry-form/v1"),
    source: enquirySource,
    open: z.boolean(),
    scope: z
      .object({
        key: z.string().max(64),
        revision: enquiryPositive,
        provenance: enquiryScope,
      })
      .strict()
      .nullable(),
    model: z.unknown(),
    retentionDays: z.literal(30),
    receiptDays: z.literal(35),
    delivery: z.literal("private-workspace-only"),
    notifications: z.literal(false),
    contacts: z.literal(false),
    uploads: z.literal(false),
  })
  .strict();

export const enquiryCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("configure"),
      workspace: enquiryID,
      resource: enquiryID,
      operation: enquiryIntent,
      expectedVersion: enquiryRevision,
      source: enquirySource,
      expectedScopeRevision: enquiryRevision,
      enabled: z.boolean(),
      mode: z.enum(["standalone", "publication"]),
      stack: enquiryID.optional(),
      instance: enquiryID.optional(),
      publication: enquiryPositive.optional(),
      configuration: enquiryPositive.optional(),
    })
    .strict(),
  z
    .object({
      action: z.enum(["review", "reject", "delete"]),
      workspace: enquiryID,
      resource: enquiryID,
      operation: enquiryIntent,
      item: enquiryID,
      expectedVersion: enquiryRevision,
      source: enquirySource,
      expectedRevision: enquiryPositive,
    })
    .strict(),
]);
