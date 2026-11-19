// Share calendar contract, validation and calendar export (#604).
// This module is shared by the native administration page and Node tests. It
// stops at local preparation: an item can be drafted, scheduled or marked as
// copied/downloaded/exported by the owner. The separate Bluesky delivery
// module records a provider receipt only after an explicit send of an exact
// approval; this contract stores no credential or token.
import { z } from "zod";
import { isBlueskyDid, normalizeBlueskyHandle } from "./bluesky-account.ts";

export const SHARE_CHANNELS = [
  {
    id: "instagram",
    label: "Instagram",
    note: "Image-led caption. Keep links usable in the caption or profile.",
  },
  {
    id: "facebook",
    label: "Facebook",
    note: "Link post or caption with the published share card.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    note: "Link post or caption for a member profile or company page.",
  },
  {
    id: "bluesky",
    label: "Bluesky",
    note: "Optional channel. Use only when the owner has chosen it.",
  },
  {
    id: "other",
    label: "Other",
    note: "A destination you name in the caption.",
  },
] as const;

// X artwork export is an isolated, export-only variant. It deliberately stays
// out of SHARE_CHANNELS: the owner never picks an X destination, account,
// approval, schedule or provider. It only carries a locally prepared caption
// on the existing per-item variant contract.
export const SHARE_X_CHANNEL = "x";
export type ShareXChannel = typeof SHARE_X_CHANNEL;

export const SHARE_STATES = [
  {
    id: "draft",
    label: "Draft",
    note: "Not scheduled. Nothing has left Composer.",
  },
  {
    id: "scheduled",
    label: "Scheduled",
    note: "A date is recorded here. Choose automatic Bluesky delivery after approval.",
  },
  {
    id: "shared",
    label: "Shared locally",
    note: "You copied, downloaded or exported this item. Composer cannot confirm a network post.",
  },
] as const;

export type ShareChannel = (typeof SHARE_CHANNELS)[number]["id"];
export type ShareState = (typeof SHARE_STATES)[number]["id"];

export type CaptionUnit = "characters" | "graphemes";

// Real destination limits, kept beside the channel labels so the editor and
// the approval package cannot disagree. `characters` counts Unicode code
// points; Bluesky genuinely counts grapheme clusters, which is why its limit
// is expressed separately.
export const SHARE_CHANNEL_LIMITS: Record<
  ShareChannel,
  { limit: number; unit: CaptionUnit; behaviour: string }
> = {
  instagram: {
    limit: 2200,
    unit: "characters",
    behaviour:
      "Instagram captions allow 2,200 characters. About 125 appear before “more”, and a link in the caption is not clickable.",
  },
  facebook: {
    limit: 63206,
    unit: "characters",
    behaviour:
      "Facebook accepts long posts. The feed shows about 477 characters before “See more”.",
  },
  linkedin: {
    limit: 3000,
    unit: "characters",
    behaviour:
      "LinkedIn posts allow 3,000 characters. The feed truncates at about 210 characters before “see more”.",
  },
  bluesky: {
    limit: 300,
    unit: "graphemes",
    behaviour:
      "Bluesky counts graphemes, not code points: a post can use at most 300 graphemes, including any link.",
  },
  other: {
    limit: 2200,
    unit: "characters",
    behaviour:
      "No single limit is published for an unnamed destination. Composer keeps this draft to 2,200 characters; check the destination's own limit before sharing.",
  },
};

// The main caption is the legacy column and keeps its existing 2,200
// character local cap. Additional channel drafts can use the destination's
// larger limit. One save request carries one caption (see
// SHARE_CAPTION_MAX_BYTES), which is why the package is written one channel at
// a time.
export const SHARE_CAPTION_LOCAL_CHARACTERS = 2200;
export const SHARE_CAPTION_MAX_CHARACTERS = 63206;
export const SHARE_CAPTION_MAX_BYTES = 7000;
export const SHARE_DESTINATION_MAX = 120;
export const SHARE_VARIANT_MAX = SHARE_CHANNELS.length - 1;

// Owner-managed recurring queue presets (#604 follow-up). A preset is a local
// template, never a schedule or a dispatch. Both the reply and the stored rows
// are bounded to 12 per workspace/account.
export const SHARE_QUEUE_PRESET_MAX = 12;
export const SHARE_QUEUE_CATEGORY_MAX = 48;
const queuePresetTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a 24-hour HH:mm time.");
const queuePresetAccount = z.string().trim().min(1).max(253);

export const shareCalendarChannel = z.enum([
  "instagram",
  "facebook",
  "linkedin",
  "bluesky",
  "other",
]);
export const shareCalendarState = z.enum(["draft", "scheduled", "shared"]);

const workspaceId = z.string().regex(/^[a-z0-9-]{6,64}$/);
const stackId = workspaceId;
const itemId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const isoInstant = z
  .string()
  .max(64)
  .refine(
    (value) => isCanonicalInstant(value),
    "Choose a real ISO date and time.",
  );

export const shareCalendarCaption = z
  .string()
  .trim()
  .min(1, "Write a caption before saving this share.")
  .max(
    SHARE_CAPTION_LOCAL_CHARACTERS,
    "Keep the main caption to 2200 characters.",
  );
export const shareCalendarVariantCaption = z
  .string()
  .trim()
  .min(1, "Write a caption before saving this channel draft.")
  .max(
    SHARE_CAPTION_MAX_CHARACTERS,
    "This channel caption is longer than any supported destination.",
  );
export const shareCalendarDestination = z
  .string()
  .trim()
  .max(SHARE_DESTINATION_MAX, "Keep the destination name to 120 characters.");
export const shareCalendarLink = z
  .string()
  .trim()
  .max(2048, "Keep the link to 2048 characters.")
  .refine(
    (value) => value === "" || isSafeShareLink(value),
    "Use an http or https link without a username or password.",
  );

// Keep the accepted range narrow enough for a useful calendar and wide enough
// for a real campaign. The browser sends its selected instant as ISO UTC.
export const shareCalendarInstant = z
  .string()
  .max(64)
  .transform((value, ctx) => {
    try {
      return canonicalInstant(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Choose a real date and time with a timezone.",
      });
      return z.NEVER;
    }
  });

const catalogueAssetId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/);
const catalogueDigest = z.string().regex(/^[a-f0-9]{64}$/);

export const catalogueAssetSchema = z
  .object({
    assetId: catalogueAssetId,
    title: z.string().min(1).max(160),
    assetRevision: z.string().min(1).max(200),
    renditionUrl: z.string().max(2048).refine(isSafeShareLink),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    byteLength: z.number().int().min(1).max(1_000_000),
    bytesSha256: catalogueDigest,
    alt: z.string().min(1).max(2000),
    credit: z.string().min(1).max(300),
    projectUrl: z.string().max(2048).refine(isSafeShareLink),
    sourceUrl: z.string().max(2048).refine(isSafeShareLink),
  })
  .strict();

export const catalogueSelectionSchema = catalogueAssetSchema.extend({
  rightsConfirmedBy: z.string().min(1).max(256),
  rightsConfirmedAt: isoInstant,
});

export type CatalogueResolvedAsset = z.infer<typeof catalogueAssetSchema>;
export type CatalogueAssetDescriptor = z.infer<typeof catalogueSelectionSchema>;

// The live identity of an asset. These are the fields a recheck must compare
// against the stored descriptor before approval or send.
export function catalogueIdentity(
  asset: CatalogueResolvedAsset,
): Array<string | number> {
  return [
    asset.assetId,
    asset.title,
    asset.assetRevision,
    asset.renditionUrl,
    asset.mimeType,
    asset.byteLength,
    asset.bytesSha256,
    asset.alt,
    asset.credit,
    asset.projectUrl,
    asset.sourceUrl,
  ];
}

export const cataloguePreviewReplySchema = z
  .object({
    ok: z.literal(true),
    asset: catalogueAssetSchema,
    assetHash: catalogueDigest,
  })
  .strict();

export const shareCalendarReadInput = z.union([
  z
    .object({
      action: z.literal("cataloguePreview"),
      workspace: workspaceId.optional(),
      assetId: catalogueAssetId,
    })
    .strict(),
  // The picker query. It is only a bounded search string: the server builds the
  // fixed catalogue search URL and returns public, unconfirmed items.
  z
    .object({
      action: z.literal("catalogueSearch"),
      workspace: workspaceId.optional(),
      q: z.string().trim().min(1).max(100),
    })
    .strict(),
  z
    .object({ action: z.literal("list"), workspace: workspaceId.optional() })
    .strict(),
  z
    .object({
      action: z.literal("blueskyIdentity"),
      workspace: workspaceId.optional(),
      // A public Bluesky handle is at most 253 characters. The resolver
      // performs the real syntax check; this only bounds the request.
      handle: z.string().trim().max(253).optional(),
    })
    .strict(),
  // Read-only Queue Next preview (#663). The owner supplies only a Melbourne
  // weekday and a 24-hour wall-clock time. The server reads the workspace's
  // scheduled Bluesky times and returns the next free slot; no schedule,
  // approval, delivery or credential is changed by this request.
  z
    .object({
      action: z.literal("queueNextPreview"),
      workspace: workspaceId.optional(),
      // EmDash supplies GET parameters as strings.
      weekday: z
        .string()
        .regex(/^[1-7]$/)
        .transform(Number),
      time: z
        .string()
        .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a 24-hour HH:mm time."),
    })
    .strict(),
  // Owner-only queue-presets read. It reports the exact workspace and the
  // currently configured Bluesky handle; it never changes a schedule.
  z
    .object({
      action: z.literal("queuePresets"),
      workspace: workspaceId.optional(),
    })
    .strict(),
]);

export const shareCalendarCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("catalogueCreate"),
      workspace: workspaceId.optional(),
      assetId: catalogueAssetId,
      assetHash: catalogueDigest,
      rightsConfirmed: z.literal(true),
      caption: shareCalendarCaption,
      scheduledAt: shareCalendarInstant.nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("create"),
      workspace: workspaceId.optional(),
      stack: stackId,
      channel: shareCalendarChannel,
      destination: shareCalendarDestination.optional(),
      caption: shareCalendarCaption,
      link: shareCalendarLink,
      scheduledAt: shareCalendarInstant.nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
      channel: shareCalendarChannel,
      destination: shareCalendarDestination.optional(),
      caption: shareCalendarCaption,
      link: shareCalendarLink,
      scheduledAt: shareCalendarInstant.nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("variant"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
      channel: shareCalendarChannel,
      destination: shareCalendarDestination.optional(),
      caption: shareCalendarVariantCaption.nullable(),
    })
    .strict(),
  // Export-only X artwork draft. No channel, destination, link, schedule,
  // account, approval or provider field exists on this command.
  z
    .object({
      action: z.literal("xVariant"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
      expectedCaption: shareCalendarCaption.nullable(),
      caption: shareCalendarCaption,
    })
    .strict(),
  z
    .object({
      action: z.literal("blueskyApprove"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
      handle: z.string().trim().min(1).max(253),
    })
    .strict(),
  z
    .object({
      action: z.literal("blueskyCancel"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedApprovalRevision: revision,
      reason: z.string().trim().max(280).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("blueskySend"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
      expectedApprovalRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("blueskySchedule"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
      expectedApprovalRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("blueskyReconcile"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedApprovalRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("shared"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("reopen"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("refresh"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("delete"),
      workspace: workspaceId.optional(),
      item: itemId,
      expectedRevision: revision,
    })
    .strict(),
  // Owner-only queue-presets writes. `account` is the caller's expected
  // handle; the server refuses it unless it is the current configured handle.
  z
    .object({
      action: z.literal("queuePresetSave"),
      workspace: workspaceId.optional(),
      account: queuePresetAccount,
      category: z
        .string()
        .trim()
        .min(1, "Name the queue category.")
        .max(
          SHARE_QUEUE_CATEGORY_MAX,
          "Keep the category to 48 characters.",
        ),
      weekday: z.number().int().min(1).max(7),
      time: queuePresetTime,
    })
    .strict(),
  z
    .object({
      action: z.literal("queuePresetDelete"),
      workspace: workspaceId.optional(),
      account: queuePresetAccount,
      category: z
        .string()
        .trim()
        .min(1, "Name the queue category.")
        .max(
          SHARE_QUEUE_CATEGORY_MAX,
          "Keep the category to 48 characters.",
        ),
    })
    .strict(),
]);

export type ShareCalendarCommand = z.infer<typeof shareCalendarCommand>;

export interface ShareCalendarSource {
  id: string;
  slug: string;
  name: string;
  description: string;
  publication: number;
  publishedAt: string;
  url: string;
  imagePath: string;
  imageAlt: string;
  apps: string[];
}

export interface ShareCalendarVariant {
  channel: ShareChannel;
  destination: string;
  caption: string;
}

// The stored variant contract also accepts the isolated X export row. The
// editor's channel-draft state keeps the narrower ShareCalendarVariant type;
// only persisted items and their snapshots carry ShareXVariant.
export interface ShareXVariant {
  channel: ShareXChannel;
  destination: "";
  caption: string;
}
export type StoredShareVariant = ShareCalendarVariant | ShareXVariant;

export function isXVariant(
  variant: StoredShareVariant,
): variant is ShareXVariant {
  return variant.channel === SHARE_X_CHANNEL;
}

export interface ShareCalendarItem {
  id: string;
  stack: string | null;
  stackName: string;
  stackSlug: string | null;
  publication: number | null;
  catalogue?: CatalogueAssetDescriptor;
  sourceCurrent: boolean;
  channel: ShareChannel;
  destination: string;
  caption: string;
  variants: StoredShareVariant[];
  link: string;
  scheduledAt: string | null;
  state: ShareState;
  sharedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShareCalendarSnapshot {
  ok: true;
  workspace: { id: string; name: string; role: "owner" | "editor" | "viewer" };
  sources: ShareCalendarSource[];
  items: ShareCalendarItem[];
  approvals: BlueskyApprovalRecord[];
  deliveries: BlueskyDeliveryRecord[];
  bluesky: {
    configuredHandle: string | null;
    connection: {
      state: "configured" | "not_configured";
      handle: string | null;
      note: string;
    };
  };
  now: string;
  changed: string | null;
}

export const shareCalendarSourceSchema = z
  .object({
    id: stackId,
    slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
    name: z.string().min(1).max(160),
    description: z.string().max(2000),
    publication: revision,
    publishedAt: z.string().max(64),
    url: z.string().url(),
    imagePath: z
      .string()
      .regex(/^\/s\/[a-z0-9-]{1,60}\/share\/[a-z0-9-]+\.png$/),
    imageAlt: z.string().max(2000),
    apps: z.array(z.string().max(160)).max(12),
  })
  .strict();

export const shareCalendarVariantSchema = z
  .object({
    channel: shareCalendarChannel,
    destination: z.string().max(SHARE_DESTINATION_MAX),
    caption: z.string().min(1).max(SHARE_CAPTION_MAX_CHARACTERS),
  })
  .strict();

// X is not a selectable channel, so it has its own exact row shape. It carries
// no destination and is written only by the isolated xVariant save path.
export const shareXVariantSchema = z
  .object({
    channel: z.literal(SHARE_X_CHANNEL),
    destination: z.literal(""),
    caption: shareCalendarCaption,
  })
  .strict();

export const storedShareVariantSchema = z.union([
  shareCalendarVariantSchema,
  shareXVariantSchema,
]);

export const shareCalendarItemSchema = z
  .object({
    id: itemId,
    stack: stackId.nullable(),
    stackName: z.string().min(1).max(160),
    stackSlug: z
      .string()
      .regex(/^[a-z0-9-]{1,60}$/)
      .nullable(),
    publication: revision.nullable(),
    catalogue: catalogueSelectionSchema.optional(),
    sourceCurrent: z.boolean(),
    channel: shareCalendarChannel,
    destination: z.string().max(SHARE_DESTINATION_MAX),
    caption: z.string().min(1).max(SHARE_CAPTION_LOCAL_CHARACTERS),
    variants: z.array(storedShareVariantSchema).max(SHARE_VARIANT_MAX),
    link: z.string().max(2048),
    scheduledAt: isoInstant.nullable(),
    state: shareCalendarState,
    sharedAt: isoInstant.nullable(),
    revision,
    createdAt: isoInstant,
    updatedAt: isoInstant,
  })
  .strict()
  .superRefine((value, ctx) => {
    const stackFields = [value.stack, value.stackSlug, value.publication];
    // A stackless artwork keeps its Bluesky main caption and link untouched;
    // the only variant it may carry is the isolated X export draft.
    const artworkVariants =
      value.variants.length === 0 ||
      (value.variants.length === 1 && value.variants.every(isXVariant));
    const complete = value.catalogue
      ? stackFields.every((field) => field === null) &&
        value.channel === "bluesky" &&
        artworkVariants &&
        value.link === value.catalogue.projectUrl
      : stackFields.every((field) => field !== null) &&
        !value.variants.some(isXVariant);
    if (!complete)
      ctx.addIssue({
        code: "custom",
        path: ["stack"],
        message: "The share source is incomplete.",
      });
    // A persisted row has one exact caption per channel. The main caption is
    // the default destination, so an extra draft may not duplicate it.
    const seen = new Set<string>([value.channel]);
    value.variants.forEach((variant, index) => {
      if (seen.has(variant.channel))
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "channel"],
          message: "Each channel may appear once.",
        });
      seen.add(variant.channel);
    });
  });

const approvalHash = z.string().regex(/^[a-f0-9]{64}$/);

export const scheduledBlueskyJobSchema = z
  .object({
    workspaceId,
    itemId,
    approvalRevision: revision,
    bindingHash: approvalHash,
    scheduledAt: isoInstant,
    ownerId: z.string().min(1).max(256),
  });
export type ScheduledBlueskyJob = z.infer<typeof scheduledBlueskyJobSchema>;

// An approval record is public data plus hashes. There is deliberately no
// credential field, and this schema is the shared snapshot contract.
export const blueskyApprovalRecordSchema = z
  .object({
    itemId,
    channel: z.literal("bluesky"),
    state: z.enum(["approved", "cancelled", "revoked"]),
    accountHandle: z
      .string()
      .refine(
        (value) => normalizeBlueskyHandle(value) === value,
        "Choose a real public handle.",
      ),
    accountDid: z.string().refine(isBlueskyDid, "Choose a real public DID."),
    draftRevision: revision,
    approvalRevision: revision,
    textHash: approvalHash,
    mediaHash: approvalHash,
    mediaRevision: z.string().min(1).max(2048),
    link: z.string().min(1).max(2048).refine(isSafeShareLink),
    scheduledAt: isoInstant,
    bindingHash: approvalHash,
    approvedAt: isoInstant,
    automatic: z.boolean().optional(),
    expiresAt: isoInstant,
    cancelledAt: isoInstant.nullable(),
    revokedAt: isoInstant.nullable(),
    revocationReason: z.string().max(280),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.state === "approved" && (value.cancelledAt || value.revokedAt))
      ctx.addIssue({
        code: "custom",
        message: "An approved record has no cancellation or revocation.",
      });
    if (value.state === "cancelled" && !value.cancelledAt)
      ctx.addIssue({
        code: "custom",
        message: "A cancelled record needs its cancellation time.",
      });
    if (value.state === "revoked" && !value.revokedAt)
      ctx.addIssue({
        code: "custom",
        message: "A revoked record needs its revocation time.",
      });
  });

export interface BlueskyApprovalRecord {
  itemId: string;
  channel: "bluesky";
  state: "approved" | "cancelled" | "revoked";
  accountHandle: string;
  accountDid: string;
  draftRevision: number;
  approvalRevision: number;
  textHash: string;
  mediaHash: string;
  mediaRevision: string;
  link: string;
  scheduledAt: string;
  bindingHash: string;
  approvedAt: string;
  automatic?: boolean;
  expiresAt: string;
  cancelledAt: string | null;
  revokedAt: string | null;
  revocationReason: string;
}

// Durable delivery states for the Bluesky send path (#604). `approved` means a
// delivery row exists but no worker has claimed it. `sending` is a short
// lease. `unknown` means a request may have reached the provider; it is only
// resolved by reading the deterministic record key, never by a blind retry.
export const BLUESKY_DELIVERY_STATES = [
  "approved",
  "sending",
  "published",
  "failed",
  "unknown",
  "cancelled",
  "needs_auth",
] as const;

export type BlueskyDeliveryState = (typeof BLUESKY_DELIVERY_STATES)[number];

export const BLUESKY_DELIVERY_LABELS: Record<BlueskyDeliveryState, string> = {
  approved: "Not sent",
  sending: "Sending",
  published: "Published",
  failed: "Failed",
  unknown: "Unknown",
  cancelled: "Cancelled",
  needs_auth: "Needs authorisation",
};

// Public-safe delivery receipt. There is deliberately no token, password,
// refresh credential or raw provider body field in this contract.
export interface BlueskyDeliveryRecord {
  itemId: string;
  approvalRevision: number;
  state: BlueskyDeliveryState;
  attempt: number;
  accountHandle: string;
  accountDid: string;
  rkey: string;
  providerUri: string | null;
  providerCid: string | null;
  permalink: string | null;
  errorCode: string;
  errorMessage: string;
  claimedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const blueskyDeliveryRecordSchema = z
  .object({
    itemId,
    approvalRevision: revision,
    state: z.enum(BLUESKY_DELIVERY_STATES),
    attempt: z.number().int().min(0).max(10),
    accountHandle: z
      .string()
      .refine(
        (value) => normalizeBlueskyHandle(value) === value,
        "Choose a real public handle.",
      ),
    accountDid: z.string().refine(isBlueskyDid, "Choose a real public DID."),
    rkey: z.string().regex(/^[a-zA-Z0-9._:~-]{1,512}$/),
    providerUri: z.string().max(1024).nullable(),
    providerCid: z.string().max(256).nullable(),
    permalink: z.string().url().max(1024).nullable(),
    errorCode: z.string().max(80),
    errorMessage: z.string().max(280),
    claimedAt: isoInstant.nullable(),
    publishedAt: isoInstant.nullable(),
    createdAt: isoInstant,
    updatedAt: isoInstant,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.state === "published" &&
      (!value.providerUri || !value.providerCid || !value.permalink)
    )
      ctx.addIssue({
        code: "custom",
        message: "A published delivery needs its provider URI, CID and link.",
      });
    if (value.providerUri && !value.providerUri.startsWith("at://"))
      ctx.addIssue({
        code: "custom",
        message: "A provider URI must be an AT URI.",
      });
  });

export const shareCalendarSnapshot = z
  .object({
    ok: z.literal(true),
    workspace: z
      .object({
        id: workspaceId,
        name: z.string().min(1).max(160),
        role: z.enum(["owner", "editor", "viewer"]),
      })
      .strict(),
    sources: z.array(shareCalendarSourceSchema).max(50),
    items: z.array(shareCalendarItemSchema).max(200),
    approvals: z.array(blueskyApprovalRecordSchema).max(200),
    deliveries: z.array(blueskyDeliveryRecordSchema).max(200),
    bluesky: z
      .object({
        configuredHandle: z.string().min(3).max(253).nullable(),
        connection: z
          .object({
            state: z.enum(["configured", "not_configured"]),
            handle: z.string().min(3).max(253).nullable(),
            note: z.string().min(1).max(500),
          })
          .strict(),
      })
      .strict(),
    now: isoInstant,
    changed: itemId.nullable(),
  })
  .strict();

// Read-only resolution shared by the item card and the calendar list filter.
// A published receipt must match the approval revision the card displays;
// local exports and scheduled/draft items are never provider deliveries.
export function itemApprovalAndDelivery(
  snapshot: Pick<ShareCalendarSnapshot, "approvals" | "deliveries">,
  item: ShareCalendarItem,
): {
  approval: BlueskyApprovalRecord | null;
  delivery: BlueskyDeliveryRecord | null;
} {
  const approval =
    snapshot.approvals.find((entry) => entry.itemId === item.id) ?? null;
  const delivery =
    (approval &&
      snapshot.deliveries.find(
        (entry) =>
          entry.itemId === item.id &&
          entry.approvalRevision === approval.approvalRevision,
      )) ||
    null;
  return { approval, delivery };
}

export function hasPublishedBlueskyRevision(
  item: Pick<ShareCalendarItem, "id" | "revision">,
  approval: BlueskyApprovalRecord | null,
  delivery: BlueskyDeliveryRecord | null,
): boolean {
  return (
    approval?.itemId === item.id &&
    approval.draftRevision === item.revision &&
    delivery?.state === "published" &&
    delivery.itemId === item.id &&
    delivery.approvalRevision === approval.approvalRevision &&
    Boolean(delivery.permalink)
  );
}

type ShareDeliveryFilter = "published" | "attention";
export type ShareListFilter =
  "all" | "drafts" | "scheduled" | ShareDeliveryFilter;

// "published" is only a genuine persisted provider receipt for the displayed
// approval revision. "attention" is an exact delivery that is unknown, failed
// or needs authorisation, or a stale source with no published receipt. A
// locally exported, scheduled or draft item has no delivery and stays in "all".
export function shareListFilterForItem(
  snapshot: ShareCalendarSnapshot,
  item: ShareCalendarItem,
): ShareDeliveryFilter | null {
  const { delivery } = itemApprovalAndDelivery(snapshot, item);
  if (delivery?.state === "published") return "published";
  if (
    delivery?.state === "unknown" ||
    delivery?.state === "failed" ||
    delivery?.state === "needs_auth" ||
    !item.sourceCurrent
  )
    return "attention";
  return null;
}

// Every list view an item belongs to. Drafts and Scheduled come only from the
// authoritative local item.state: they describe the calendar, not a job or a
// delivery. They are independent of the delivery classification above, so an
// error item also appears in Drafts or Scheduled when its current local state
// matches. Published and Needs attention keep their unchanged delivery logic.
export function shareListItemFilters(
  snapshot: ShareCalendarSnapshot,
  item: ShareCalendarItem,
): ShareListFilter[] {
  const filters: ShareListFilter[] = ["all"];
  if (item.state === "draft") filters.push("drafts");
  if (item.state === "scheduled") filters.push("scheduled");
  const deliveryFilter = shareListFilterForItem(snapshot, item);
  if (deliveryFilter) filters.push(deliveryFilter);
  return filters;
}

export interface ShareCalendarIcsItem {
  id: string;
  revision: number;
  channel: ShareChannel;
  destination?: string;
  caption: string;
  link: string;
  scheduledAt: string;
  stackName: string;
  published?: true;
}

// Only current scheduled items become events. The exact published Bluesky
// revision retains its date as a historical record.
export function calendarExportItems(
  items: ShareCalendarItem[],
  snapshot?: Pick<ShareCalendarSnapshot, "approvals" | "deliveries">,
): ShareCalendarIcsItem[] {
  return items
    .filter(
      (item) =>
        item.state === "scheduled" &&
        item.sourceCurrent &&
        item.scheduledAt !== null,
    )
    .map((item) => {
      const receipt = snapshot && item.channel === "bluesky"
        ? itemApprovalAndDelivery(snapshot, item)
        : null;
      return {
        id: item.id,
        revision: item.revision,
        channel: item.channel,
        destination: item.destination,
        caption: item.caption,
        link: item.link,
        scheduledAt: item.scheduledAt as string,
        stackName: item.stackName,
        ...(receipt && hasPublishedBlueskyRevision(item, receipt.approval, receipt.delivery)
          ? { published: true as const }
          : {}),
      };
    });
}

export interface ShareCalendarIcsOptions {
  now?: Date;
  calendarName?: string;
  durationMinutes?: number;
}

export const SHARE_CHANNEL_LABELS: Record<ShareChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
  other: "Other",
};

export const SHARE_STATE_LABELS: Record<ShareState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  shared: "Shared locally",
};

export function isShareChannel(value: unknown): value is ShareChannel {
  return (
    typeof value === "string" &&
    SHARE_CHANNELS.some((channel) => channel.id === value)
  );
}

export function isShareState(value: unknown): value is ShareState {
  return (
    typeof value === "string" &&
    SHARE_STATES.some((state) => state.id === value)
  );
}

export function isSafeShareLink(value: string): boolean {
  if (!value || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value))
    return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function graphemeCount(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [
      ...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value),
    ].length;
  }
  return Array.from(value).length;
}

export function characterCount(value: string): number {
  return Array.from(value).length;
}

export interface CaptionUsage {
  count: number;
  limit: number;
  unit: CaptionUnit;
  remaining: number;
  withinLimit: boolean;
  platformLimit: number;
  behaviour: string;
}

// The main caption keeps the legacy local 2,200-character ceiling. Every
// additional channel draft uses the destination's real limit.
export function captionUsage(
  channel: ShareChannel,
  caption: string,
  main = false,
): CaptionUsage {
  const spec = SHARE_CHANNEL_LIMITS[channel];
  const count =
    spec.unit === "graphemes"
      ? graphemeCount(caption)
      : characterCount(caption);
  const limit =
    main && spec.unit === "characters"
      ? Math.min(spec.limit, SHARE_CAPTION_LOCAL_CHARACTERS)
      : spec.limit;
  return {
    count,
    limit,
    unit: spec.unit,
    remaining: limit - count,
    withinLimit: count <= limit,
    platformLimit: spec.limit,
    behaviour: spec.behaviour,
  };
}

export function captionByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

// Shared by the native editor and the route, so a saved caption can never
// exceed what the destination or the save request accepts.
export function captionProblem(
  channel: ShareChannel,
  caption: string,
  main = false,
): string | null {
  const text = caption.trim();
  if (!text) return "Write a caption before saving this share.";
  const usage = captionUsage(channel, text, main);
  if (!usage.withinLimit) {
    if (main && usage.limit < usage.platformLimit)
      return `The main caption is limited to ${usage.limit} ${usage.unit}; this caption has ${usage.count}.`;
    return `${SHARE_CHANNEL_LABELS[channel]} allows ${usage.limit} ${usage.unit}; this caption has ${usage.count}.`;
  }
  const bytes = captionByteLength(text);
  if (bytes > SHARE_CAPTION_MAX_BYTES)
    return `This caption is ${bytes} UTF-8 bytes. Composer saves one caption per request and accepts at most ${SHARE_CAPTION_MAX_BYTES} bytes. Shorten it, or split the text into another item.`;
  return null;
}

export function primaryCaptionProblem(
  channel: ShareChannel,
  caption: string,
): string | null {
  return captionProblem(channel, caption, true);
}

export function variantSort(
  left: StoredShareVariant,
  right: StoredShareVariant,
): number {
  const order = (channel: StoredShareVariant["channel"]) =>
    channel === SHARE_X_CHANNEL
      ? SHARE_CHANNELS.length
      : SHARE_CHANNELS.findIndex((entry) => entry.id === channel);
  return order(left.channel) - order(right.channel);
}

export function canonicalInstant(value: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    throw Error("Choose a real date and time with a timezone.");
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw Error("Choose a real date and time.");
  if (time < Date.UTC(2020, 0, 1) || time > Date.UTC(2100, 0, 1))
    throw Error("Choose a date between 2020 and 2100.");
  return new Date(time).toISOString();
}

export function isCanonicalInstant(value: string): boolean {
  try {
    return canonicalInstant(value) === value;
  } catch {
    return false;
  }
}

export function sqliteInstant(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const text = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

export function localTimeLabel(
  value: string,
  timeZone = "Australia/Melbourne",
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}/${part("month")}/${part("day")} ${part("hour")}:${part("minute")} ${part("timeZoneName")}`;
}

// A datetime-local input has no timezone. The owner's calendar is kept in
// Australia/Melbourne, so the entered wall clock is converted explicitly rather
// than silently using the browser's zone. A spring-forward gap returns null; an
// autumn-back overlap resolves to the first valid Melbourne instant.
function zoneOffsetMinutes(time: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(time));
  const name =
    parts.find((entry) => entry.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function zonedParts(
  time: number,
  timeZone: string,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(time));
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function melbourneLocalInstant(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (!Number.isFinite(wall)) return null;
  const first = wall - zoneOffsetMinutes(wall, "Australia/Melbourne") * 60_000;
  const second =
    wall - zoneOffsetMinutes(first, "Australia/Melbourne") * 60_000;
  const candidate = new Date(second);
  const parts = zonedParts(second, "Australia/Melbourne");
  if (parts.date !== value.slice(0, 10) || parts.time !== value.slice(11, 16))
    return null;
  return candidate.toISOString();
}

export function melbourneLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = zonedParts(date.getTime(), "Australia/Melbourne");
  return `${parts.date}T${parts.time}`;
}

export function scheduleLabels(value: string | null): {
  melbourne: string;
  utc: string;
} | null {
  if (!value) return null;
  const melbourne = localTimeLabel(value, "Australia/Melbourne");
  const utc = localTimeLabel(value, "UTC");
  return melbourne === "Unknown time" || utc === "Unknown time"
    ? null
    : { melbourne, utc };
}

// Monday-first values are shared by the UI and the Melbourne calendar.
export const MELBOURNE_WEEKDAYS = [
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
  { id: 7, label: "Sunday" },
] as const;

export const QUEUE_NEXT_HORIZON_WEEKS = 8;

export const queueNextPreviewReplySchema = z
  .object({
    ok: z.literal(true),
    action: z.literal("queueNextPreview"),
    nextInstant: isoInstant.nullable(),
  })
  .strict();

export type QueueNextPreview = z.infer<typeof queueNextPreviewReplySchema>;

// One bounded reply shape for all three queue-presets actions (read, save and
// delete). It is deliberately not part of the share-calendar snapshot: an old
// snapshot keeps its exact fields and a queue change never rewrites a schedule.
export const shareQueuePresetSchema = z
  .object({
    category: z.string().min(1).max(SHARE_QUEUE_CATEGORY_MAX),
    weekday: z.number().int().min(1).max(7),
    time: queuePresetTime,
  })
  .strict();

export const shareQueuePresetsReplySchema = z
  .object({
    ok: z.literal(true),
    action: z.literal("queuePresets"),
    workspace: workspaceId,
    account: z.string().min(3).max(253),
    presets: z.array(shareQueuePresetSchema).max(SHARE_QUEUE_PRESET_MAX),
  })
  .strict();

export type ShareQueuePresetsReply = z.infer<
  typeof shareQueuePresetsReplySchema
>;

// Use the same ambiguous-time policy as the manual calendar. A nonexistent
// Melbourne wall-clock time is skipped. The query checks these minutes only.
export function upcomingQueueSlots(
  weekday: number,
  time: string,
  now: Date,
): string[] {
  const today = zonedParts(now.getTime(), "Australia/Melbourne").date;
  const base = new Date(`${today}T00:00:00.000Z`);
  const delta = ((weekday % 7) - base.getUTCDay() + 7) % 7;
  const slots: string[] = [];
  for (let week = 0; week < QUEUE_NEXT_HORIZON_WEEKS; week += 1) {
    const date = new Date(base.getTime() + (delta + week * 7) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const slot = melbourneLocalInstant(`${date}T${time}`);
    if (slot && Date.parse(slot) > now.getTime()) slots.push(slot);
  }
  return slots;
}

export function calendarFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `share-calendar-${slug || "composer"}.ics`;
}

// RFC 5545 TEXT escaping. Backslash first so the inserted escapes survive.
function escapeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// Fold at 75 octets per physical line (74 for continuation content plus the
// leading space). Iterate code points so a UTF-8 character is never split.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let output = "";
  let current = "";
  let octets = 0;
  let limit = 75;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (octets + size > limit) {
      output += current + "\r\n ";
      current = "";
      octets = 0;
      limit = 74;
    }
    current += character;
    octets += size;
  }
  return output + current;
}

function icsProperty(name: string, value: string): string {
  return name + ":" + value;
}

export function icsUtcTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw Error("A calendar item has no real time.");
  const pad = (part: number) => String(part).padStart(2, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

// Valid VCALENDAR 2.0 with CRLF line endings.
export function buildShareCalendarIcs(
  items: ShareCalendarIcsItem[],
  options: ShareCalendarIcsOptions = {},
): string {
  const now = options.now ?? new Date();
  const stamp = icsUtcTimestamp(now);
  const duration = Math.max(5, Math.min(240, options.durationMinutes ?? 30));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//App Composer//Share calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" +
      escapeText(options.calendarName ?? "App Composer share calendar"),
    "X-WR-TIMEZONE:Australia/Melbourne",
  ];
  for (const item of [...items].sort(
    (left, right) =>
      Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt) ||
      left.id.localeCompare(right.id),
  )) {
    const start = new Date(item.scheduledAt);
    if (Number.isNaN(start.getTime()))
      throw Error("A scheduled share item has no real time.");
    // A URL property is a URI, not TEXT: it is never escaped in place. Reject
    // anything that could break out of the property or carry credentials so a
    // persisted value cannot inject calendar lines.
    if (item.link && !isSafeShareLink(item.link))
      throw Error("A calendar item has an unsafe link.");
    const end = new Date(start.getTime() + duration * 60_000);
    const channel = SHARE_CHANNEL_LABELS[item.channel] ?? "Other";
    const destination = item.destination?.trim();
    const description = [
      item.caption,
      "Exact destination: " + (destination || "not recorded"),
      item.link ? "Link: " + item.link : "",
      item.published
        ? "Published on Bluesky through App Composer. This event records the confirmed post. No sharing action is needed."
        : "Prepared in App Composer. You copy, download or export this item and share it yourself, unless an explicit Bluesky send is recorded. This calendar event does not enable automatic delivery.",
    ]
      .filter(Boolean)
      .join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      icsProperty("UID", `${item.id}@composer.loftwah.com`),
      icsProperty("DTSTAMP", stamp),
      icsProperty("DTSTART", icsUtcTimestamp(start)),
      icsProperty("DTEND", icsUtcTimestamp(end)),
      icsProperty("SUMMARY", escapeText(`${channel} · ${item.stackName}`)),
      icsProperty("DESCRIPTION", escapeText(description)),
      icsProperty("CATEGORIES", escapeText(channel)),
      ...(item.link ? [icsProperty("URL", item.link)] : []),
      icsProperty("STATUS", "CONFIRMED"),
      icsProperty("TRANSP", "TRANSPARENT"),
      // RFC 5545 SEQUENCE is a signed 32-bit integer. A revision beyond that
      // range must not emit an invalid property or wrap to a negative one.
      icsProperty(
        "SEQUENCE",
        String(Math.min(2_147_483_647, Math.max(0, item.revision - 1))),
      ),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
