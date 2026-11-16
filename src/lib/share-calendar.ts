// Share calendar contract, validation and calendar export (#604).
// This module is shared by the native administration page and Node tests. It
// deliberately stops at a local handoff: an item can be drafted, scheduled or
// marked as copied/downloaded/exported by the owner. No route here posts to a
// social network or stores a provider identifier or credential.
import { z } from "zod";

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

export const SHARE_STATES = [
  {
    id: "draft",
    label: "Draft",
    note: "Not scheduled. Nothing has left Composer.",
  },
  {
    id: "scheduled",
    label: "Scheduled",
    note: "A date is recorded here. Composer will not post it.",
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

export const shareCalendarReadInput = z
  .object({ action: z.literal("list"), workspace: workspaceId.optional() })
  .strict();

export const shareCalendarCommand = z.discriminatedUnion("action", [
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

export interface ShareCalendarItem {
  id: string;
  stack: string;
  stackName: string;
  stackSlug: string;
  publication: number;
  sourceCurrent: boolean;
  channel: ShareChannel;
  destination: string;
  caption: string;
  variants: ShareCalendarVariant[];
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

export const shareCalendarItemSchema = z
  .object({
    id: itemId,
    stack: stackId,
    stackName: z.string().min(1).max(160),
    stackSlug: z.string().regex(/^[a-z0-9-]{1,60}$/),
    publication: revision,
    sourceCurrent: z.boolean(),
    channel: shareCalendarChannel,
    destination: z.string().max(SHARE_DESTINATION_MAX),
    caption: z.string().min(1).max(SHARE_CAPTION_LOCAL_CHARACTERS),
    variants: z.array(shareCalendarVariantSchema).max(SHARE_VARIANT_MAX),
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
    now: isoInstant,
    changed: itemId.nullable(),
  })
  .strict();

export interface ShareCalendarIcsItem {
  id: string;
  revision: number;
  channel: ShareChannel;
  destination?: string;
  caption: string;
  link: string;
  scheduledAt: string;
  stackName: string;
}

// The page and any future exporter use the same filter: only a current,
// scheduled item becomes a calendar event. Drafts, locally shared items and
// items whose source changed stay out.
export function calendarExportItems(
  items: ShareCalendarItem[],
): ShareCalendarIcsItem[] {
  return items
    .filter(
      (item) =>
        item.state === "scheduled" &&
        item.sourceCurrent &&
        item.scheduledAt !== null,
    )
    .map((item) => ({
      id: item.id,
      revision: item.revision,
      channel: item.channel,
      destination: item.destination,
      caption: item.caption,
      link: item.link,
      scheduledAt: item.scheduledAt as string,
      stackName: item.stackName,
    }));
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
  left: ShareCalendarVariant,
  right: ShareCalendarVariant,
): number {
  return (
    SHARE_CHANNELS.findIndex((channel) => channel.id === left.channel) -
    SHARE_CHANNELS.findIndex((channel) => channel.id === right.channel)
  );
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

// Valid VCALENDAR 2.0 with CRLF line endings. Only scheduled items are
// included. The description says plainly that the owner performs the share.
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
      "Prepared in App Composer. You copy, download or export this item and share it yourself. Composer does not post to a social network.",
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
