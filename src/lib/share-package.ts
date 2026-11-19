// Exact, offline approval package for a share item (#604).
// The package is derived only from persisted values. It deliberately has no
// clock, random value or network read, so exporting the same saved item twice
// produces byte-identical JSON and Markdown. Nothing here posts, schedules a
// delivery or changes the item's state.
import {
  SHARE_CHANNEL_LABELS,
  SHARE_STATE_LABELS,
  captionUsage,
  hasPublishedBlueskyRevision,
  isXVariant,
  itemApprovalAndDelivery,
  isSafeShareLink,
  scheduleLabels,
  type BlueskyDeliveryRecord,
  type CaptionUnit,
  type ShareCalendarItem,
  type ShareCalendarVariant,
  type ShareCalendarSnapshot,
  type ShareCalendarSource,
  type ShareChannel,
} from "./share-calendar.ts";
import type {
  BlueskyApprovalRecord,
  SharePackageBluesky,
  SharePackagePublishedReceipt,
} from "./share-approval.ts";

export const SHARE_PACKAGE_SCHEMA = "composer.share-approval-package/v1";
export const SHARE_PACKAGE_NOT_RECORDED = "not recorded";
export const SHARE_PACKAGE_OWNER_TIME_ZONE = "Australia/Melbourne";
export const SHARE_PACKAGE_POSTING_STATEMENT =
  "This approval package does not post by itself. A Bluesky send needs a separate configured connection and an explicit confirmation; otherwise you perform this share yourself.";
export const SHARE_PACKAGE_PROVENANCE_STATEMENT =
  "Prepared in App Composer from the persisted published stack revision and the saved item revision. The package makes no network request and changes no state.";
// Wording for the exact published Bluesky target only. The approval state is
// unchanged; this label replaces "Approved (not sent)" where a saved receipt
// proves the post, so the package no longer contradicts the native card.
export const SHARE_PACKAGE_PUBLISHED_LABEL = "Published receipt";
const PUBLISHED_POSTING_STATEMENT =
  "This approval package does not post. The Bluesky revision is already published. Review the native post before sharing to another destination.";
const ARTWORK_SAVED = "Saved artwork details. Approval checks the current rendition separately.";
const ARTWORK_HISTORICAL = "Historical artwork details. Select the current rendition before sharing.";

// Additive provenance for a Woodhouse Share artwork item. It is derived only
// from the catalogue descriptor saved with the item, so it stays available even
// when no Bluesky account was resolved. Confirmation metadata (who confirmed
// reuse and when) is deliberately not exported: it is not public provenance.
export interface SharePackageArtwork {
  assetId: string;
  title: string;
  assetRevision: string;
  byteLength: number;
  bytesSha256: string;
  credit: string;
  sourceUrl: string;
  projectUrl: string;
  mimeType: string;
  status: "saved" | "historical";
  statement: string;
}

export interface SharePackageDestination {
  channel: ShareChannel;
  channelLabel: string;
  primary: boolean;
  exactDestination: string | null;
  exactDestinationLabel: string;
  caption: string;
  count: number;
  limit: number;
  unit: CaptionUnit;
  withinLimit: boolean;
  platformLimit: number;
  behaviour: string;
}

export interface ShareApprovalPackage {
  schema: typeof SHARE_PACKAGE_SCHEMA;
  item: {
    id: string;
    revision: number;
    state: ShareCalendarItem["state"];
    stateLabel: string;
  };
  workspace: { name: string };
  source: {
    stackId: string | null;
    name: string;
    slug: string | null;
    publication: number | null;
    publishedAt: string | null;
    url: string | null;
    apps: string[];
    current: boolean;
  };
  schedule: {
    scheduledAt: string | null;
    timeZone: typeof SHARE_PACKAGE_OWNER_TIME_ZONE;
    local: string | null;
    utc: string | null;
    label: string;
  };
  destinations: SharePackageDestination[];
  link: string | null;
  shareImage: {
    path: string | null;
    url: string | null;
    alt: string | null;
    downloadName: string;
    status: "available" | "not available";
  };
  provenance: {
    preparedIn: "App Composer";
    preparedAt: string;
    itemRevision: number;
    sourceRevision: number | null;
    sourceCurrent: boolean;
    statement: string;
  };
  posting: {
    composerPosts: false;
    ownerPerformsShare: boolean;
    statement: string;
  };
  // Present only when the item has a Bluesky draft. It carries the exact
  // account state, text/media hashes, intended time and approval state. Its
  // absence must never be read as an approved account.
  bluesky?: SharePackageBluesky;
  // Present only for a Woodhouse Share artwork item and derived from its saved
  // descriptor. It never carries an account ID, token or confirmation secret.
  artwork?: SharePackageArtwork;
}

function recorded(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

// A saved descriptor value must never break a Markdown line or a plain-text
// record by carrying a stray newline.
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function markdownText(value: string): string {
  return oneLine(value).replace(/[\\`*_{}\[\]<>!~|]/g, "\\$&");
}

function destinationFor(
  channel: ShareChannel,
  destination: string,
  caption: string,
  primary: boolean,
): SharePackageDestination {
  const exact = recorded(destination);
  const usage = captionUsage(channel, caption, primary);
  return {
    channel,
    channelLabel: SHARE_CHANNEL_LABELS[channel],
    primary,
    exactDestination: exact,
    exactDestinationLabel: exact ?? SHARE_PACKAGE_NOT_RECORDED,
    caption,
    count: usage.count,
    limit: usage.limit,
    unit: usage.unit,
    withinLimit: usage.withinLimit,
    platformLimit: usage.platformLimit,
    behaviour: usage.behaviour,
  };
}

export function buildShareApprovalPackage(
  item: ShareCalendarItem,
  options: {
    workspace: string;
    source?: ShareCalendarSource | null;
    bluesky?: SharePackageBluesky | null;
    published?: SharePackagePublishedReceipt | null;
  },
): ShareApprovalPackage {
  // The share card path includes a digest of the exact published revision. It
  // is only safe to include when the saved item still points at that current
  // publication; otherwise the package says the image is not available rather
  // than showing a different revision's card.
  const source =
    item.sourceCurrent &&
    options.source &&
    options.source.id === item.stack &&
    options.source.publication === item.publication
      ? options.source
      : null;
  const labels = item.scheduledAt ? scheduleLabels(item.scheduledAt) : null;
  const destinationList = [
    destinationFor(item.channel, item.destination, item.caption, true),
    // The X export draft is export-only: it is not an approval destination and
    // stays out of the package that a reviewer acts on.
    ...item.variants
      .filter((variant): variant is ShareCalendarVariant => !isXVariant(variant))
      .map((variant) =>
        destinationFor(
          variant.channel,
          variant.destination,
          variant.caption,
          false,
        ),
      ),
  ];
  const catalogue = item.catalogue;
  // The calendar snapshot carries a saved descriptor. Approval performs the
  // separate current-rendition check before any send.
  const savedCatalogue = catalogue && item.sourceCurrent ? catalogue : null;
  const artwork: SharePackageArtwork | undefined = catalogue
    ? {
        assetId: catalogue.assetId,
        title: catalogue.title,
        assetRevision: catalogue.assetRevision,
        byteLength: catalogue.byteLength,
        bytesSha256: catalogue.bytesSha256,
        credit: catalogue.credit,
        sourceUrl: catalogue.sourceUrl,
        projectUrl: catalogue.projectUrl,
        mimeType: catalogue.mimeType,
        status: savedCatalogue ? "saved" : "historical",
        statement: savedCatalogue ? ARTWORK_SAVED : ARTWORK_HISTORICAL,
      }
    : undefined;
  const imagePath = savedCatalogue?.renditionUrl ?? source?.imagePath ?? null;
  const imageUrl = savedCatalogue
    ? savedCatalogue.renditionUrl
    : source && imagePath
      ? new URL(imagePath, source.url).href
      : null;
  const scheduleLabel = !item.scheduledAt
    ? "Not scheduled"
    : labels
      ? `${labels.melbourne} · ${labels.utc}`
      : "Unreadable date";
  // The published receipt describes the exact Bluesky target in this package.
  const published = options.bluesky && options.published;
  const bluesky: SharePackageBluesky | undefined = options.bluesky
    ? {
        ...options.bluesky,
        ...(published
          ? {
              published,
              send: {
                ok: false as const,
                available: false as const,
                code: "already_published" as const,
                message: "The exact Bluesky revision is already published.",
              },
            }
          : {}),
        approval: {
          ...options.bluesky.approval,
          ...(published
            ? { label: SHARE_PACKAGE_PUBLISHED_LABEL, notSent: false }
            : {}),
        },
      }
    : undefined;
  return {
    schema: SHARE_PACKAGE_SCHEMA,
    item: {
      id: item.id,
      revision: item.revision,
      state: item.state,
      stateLabel: SHARE_STATE_LABELS[item.state],
    },
    workspace: { name: options.workspace },
    source: {
      stackId: item.stack,
      name: item.stackName,
      slug: item.stackSlug,
      publication: item.publication,
      publishedAt: source?.publishedAt ?? null,
      url: savedCatalogue?.projectUrl ?? source?.url ?? null,
      apps: source?.apps ?? [],
      current: item.sourceCurrent,
    },
    schedule: {
      scheduledAt: item.scheduledAt,
      timeZone: SHARE_PACKAGE_OWNER_TIME_ZONE,
      local: labels?.melbourne ?? null,
      utc: labels?.utc ?? null,
      label: scheduleLabel,
    },
    destinations: destinationList,
    link: recorded(item.link),
    shareImage: {
      path: imagePath,
      url: imageUrl,
      alt: catalogue?.alt ?? source?.imageAlt ?? null,
      downloadName: catalogue
        ? `${catalogue.assetId}.${catalogue.mimeType === "image/jpeg" ? "jpg" : catalogue.mimeType.slice(6)}`
        : `${item.stackSlug}-r${item.publication}-share-card.png`,
      status: imageUrl ? "available" : "not available",
    },
    provenance: {
      preparedIn: "App Composer",
      preparedAt: item.updatedAt,
      itemRevision: item.revision,
      sourceRevision: item.publication,
      sourceCurrent: item.sourceCurrent,
      statement: catalogue
        ? "Prepared from the saved artwork details and item revision. Preparing this package changes no state."
        : SHARE_PACKAGE_PROVENANCE_STATEMENT,
    },
    posting: {
      composerPosts: false,
      ownerPerformsShare:
        !published || destinationList.some((entry) => entry.channel !== "bluesky"),
      statement: published
        ? PUBLISHED_POSTING_STATEMENT
        : SHARE_PACKAGE_POSTING_STATEMENT,
    },
    ...(bluesky ? { bluesky } : {}),
    ...(artwork ? { artwork } : {}),
  };
}

export function sharePackagePublishedReceipt(
  item: Pick<ShareCalendarItem, "id" | "revision">,
  approval: BlueskyApprovalRecord | null,
  delivery: BlueskyDeliveryRecord | null,
): SharePackagePublishedReceipt | null {
  // Derived only from saved values: the exact item revision and its approval
  // revision must both match the persisted published delivery. No fetch and no
  // provider identifier is added to the package.
  const permalink = delivery?.permalink;
  if (
    !permalink?.startsWith("https://bsky.app/profile/") ||
    !isSafeShareLink(permalink) ||
    !hasPublishedBlueskyRevision(item, approval, delivery)
  ) return null;
  return { publishedAt: delivery?.publishedAt ?? null, permalink };
}

// The native page uses this exact helper, so a page-data test can prove the
// package is assembled from the persisted snapshot and not from editor state.
export function approvalPackageForItem(
  snapshot: ShareCalendarSnapshot,
  item: ShareCalendarItem,
  bluesky?: SharePackageBluesky | null,
): ShareApprovalPackage {
  const { approval, delivery } = itemApprovalAndDelivery(
    {
      approvals: snapshot.approvals ?? [],
      deliveries: snapshot.deliveries ?? [],
    },
    item,
  );
  const published = sharePackagePublishedReceipt(item, approval, delivery);
  return buildShareApprovalPackage(item, {
    workspace: snapshot.workspace.name,
    source:
      snapshot.sources.find(
        (entry) =>
          entry.id === item.stack && entry.publication === item.publication,
      ) ?? null,
    bluesky,
    published,
  });
}

export function sharePackageJson(value: ShareApprovalPackage): string {
  return JSON.stringify(value, null, 2) + "\n";
}

// Human-facing label for the persisted publication instant. It reuses the
// calendar's scheduleLabels helper so the actual published time reads in the
// same Australia/Melbourne + UTC format as the intended schedule, with its own
// distinct label. The raw canonical `publishedAt` (or null) stays untouched in
// the machine JSON; only human copy uses this rendering.
export function publishedReceiptLabel(
  receipt: SharePackagePublishedReceipt,
): string {
  if (!receipt.publishedAt) return SHARE_PACKAGE_NOT_RECORDED;
  const labels = scheduleLabels(receipt.publishedAt);
  return labels ? `${labels.melbourne} · ${labels.utc}` : "Unreadable date";
}

function fenced(value: string): string {
  const runs = value.match(/`+/g) ?? [];
  const fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `${fence}\n${value}\n${fence}`;
}

function blueskyMarkdown(value: SharePackageBluesky): string[] {
  const account =
    value.account.status === "resolved"
      ? `@${value.account.handle} · \`${value.account.did}\` · [profile](${value.account.profileUrl})`
      : value.account.handle && value.account.did
        ? `@${value.account.handle} · \`${value.account.did}\` · not rechecked in this session`
        : `Needs account · ${value.account.statement}`;
  const media = value.media.length
    ? value.media
        .map(
          (entry) =>
            `${entry.url} · alt: ${entry.alt || "missing"} · revision \`${entry.revision}\` · hash \`${entry.hash}\``,
        )
        .join("\n")
    : "No public share-card media is bound.";
  return [
    `## Bluesky · ${value.account.handle ? "@" + value.account.handle : "needs account"}`,
    "",
    `- **Account:** ${account}`,
    `- **Public identity:** ${value.account.publicIdentity} · **Publishing authorised:** no`,
    `- **Text:** ${value.count} / ${value.limit} ${value.unit} · ${value.bytes} / ${value.byteLimit} UTF-8 bytes${value.withinLimit ? "" : " — over the limit"}`,
    `- **Text hash:** \`${value.textHash}\``,
    `- **Media descriptor hash:** \`${value.mediaHash}\``,
    `- **Media:** ${media}`,
    `- **Link:** ${value.link ?? SHARE_PACKAGE_NOT_RECORDED}`,
    `- **Schedule:** ${value.schedule.local ?? "not recorded"} · ${value.schedule.utc ?? "not recorded"} · UTC instant \`${value.schedule.scheduledAt ?? "not scheduled"}\``,
    `- **Approval:** ${value.approval.label} · revision ${value.approval.approvalRevision ?? "none"}${value.approval.expiresAt ? ` · expires \`${value.approval.expiresAt}\`` : ""}${value.approval.reasons.length ? ` · reasons: ${value.approval.reasons.join(", ")}` : ""}`,
    ...(value.published
      ? [
          `- **Published on Bluesky (actual):** ${publishedReceiptLabel(value.published)} · ${value.published.permalink}`,
        ]
      : []),
    `- **Source and rights:** ${value.source.rightsNote}`,
    ...(value.published
      ? []
      : [`- **Send:** unavailable · ${value.send.code} · ${value.send.message}`]),
    "",
    fenced(value.text),
    "",
  ];
}

export function sharePackageMarkdown(value: ShareApprovalPackage): string {
  const image =
    value.shareImage.status === "available"
      ? `${value.shareImage.path} · [open](${value.shareImage.url}) · download \`${value.shareImage.downloadName}\``
      : "Not available. Refresh the source from its current published revision before sharing.";
  const lines = [
    `# Approval package · ${value.artwork ? markdownText(value.source.name) : value.source.name.replace(/\s+/g, " ")}`,
    "",
    `- **Item:** \`${value.item.id}\` · revision ${value.item.revision} · ${value.item.stateLabel}`,
    `- **Workspace:** ${value.workspace.name}`,
    `- **Source:** ${value.artwork ? markdownText(value.source.name) : value.source.name.replace(/\s+/g, " ")} · ${value.source.publication === null ? "Woodhouse Share artwork" : `published revision ${value.source.publication}`} · ${value.artwork?.status ?? (value.source.current ? "current" : "no longer current")}`,
    `- **Source address:** ${value.source.url ?? SHARE_PACKAGE_NOT_RECORDED}`,
    ...(value.artwork
      ? [
          `- **Artwork:** ${markdownText(value.artwork.title)} · credit ${markdownText(value.artwork.credit)} · revision ${markdownText(value.artwork.assetRevision)}`,
          `- **Artwork bytes:** ${value.artwork.byteLength} bytes · SHA-256 \`${value.artwork.bytesSha256}\` · ${value.artwork.status}`,
          `- **Artwork provenance:** ${markdownText(value.artwork.sourceUrl)} · ${value.artwork.statement}`,
        ]
      : []),
    `- **Schedule:** ${value.schedule.label}${value.schedule.scheduledAt ? ` · UTC \`${value.schedule.scheduledAt}\`` : ""}`,
    `- **Link:** ${value.link ?? SHARE_PACKAGE_NOT_RECORDED}`,
    `- **${value.artwork ? "Saved rendition" : "Share image"}:** ${image}`,
    "",
    ...value.destinations.map((destination) =>
      [
        `## ${destination.channelLabel} · ${destination.exactDestinationLabel.replace(/\s+/g, " ")}`,
        "",
        destination.primary
          ? "_Main caption. This is also the .ics event description._"
          : "_Additional channel draft._",
        "",
        fenced(destination.caption),
        "",
        `${destination.count} / ${destination.limit} ${destination.unit}${destination.withinLimit ? "" : " — over the limit; shorten before sharing"} · destination limit ${destination.platformLimit} ${destination.unit}`,
        "",
        destination.behaviour,
        "",
      ].join("\n"),
    ),
    ...(value.bluesky ? blueskyMarkdown(value.bluesky) : []),
    "## Provenance",
    "",
    `${value.provenance.statement} Item updated ${value.provenance.preparedAt}; item revision ${value.provenance.itemRevision}; source revision ${value.provenance.sourceRevision}.`,
    "",
    `> ${value.posting.statement}`,
    "",
  ];
  return lines.join("\n");
}

function blueskyPlainText(value: SharePackageBluesky): string {
  return [
    "BLUESKY · " +
      (value.account.handle ? "@" + value.account.handle : "needs account"),
    `Account: ${value.account.handle ?? "not resolved"}${
      value.account.did ? " · " + value.account.did : ""
    } · public identity ${value.account.publicIdentity} · publishing authorised no`,
    `Text: ${value.count} / ${value.limit} ${value.unit} · ${value.bytes} / ${value.byteLimit} UTF-8 bytes`,
    `Text hash: ${value.textHash}`,
    value.text,
    `Media: ${
      value.media.length
        ? value.media
            .map((entry) => `${entry.url} (alt: ${entry.alt})`)
            .join("; ")
        : "not available"
    }`,
    `Media descriptor hash: ${value.mediaHash}`,
    `Link: ${value.link ?? SHARE_PACKAGE_NOT_RECORDED}`,
    `Schedule: ${value.schedule.local ?? "not recorded"} · ${value.schedule.utc ?? "not recorded"} · UTC instant ${value.schedule.scheduledAt ?? "not scheduled"}`,
    `Approval: ${value.approval.label}${value.approval.expiresAt ? " · expires " + value.approval.expiresAt : ""}${
      value.approval.reasons.length
        ? " · reasons: " + value.approval.reasons.join(", ")
        : ""
    }${value.published ? "" : " · not sent"}`,
    ...(value.published
      ? [
          `Published on Bluesky (actual): ${publishedReceiptLabel(value.published)} · ${value.published.permalink}`,
        ]
      : []),
    `Source and rights: ${value.source.rightsNote}`,
    ...(value.published
      ? []
      : [`Send: unavailable · ${value.send.code} · ${value.send.message}`]),
  ].join("\n");
}

export function sharePackagePlainText(value: ShareApprovalPackage): string {
  const image =
    value.shareImage.status === "available"
      ? `${value.shareImage.url} (download ${value.shareImage.downloadName})`
      : "Not available. Refresh the source before sharing.";
  const destinations = value.destinations.map((destination) =>
    [
      `DESTINATION · ${destination.channelLabel}${destination.primary ? " (main)" : ""}`,
      `Exact destination: ${destination.exactDestinationLabel}`,
      `Caption (${destination.count} / ${destination.limit} ${destination.unit}${destination.withinLimit ? "" : ", over the limit"}):`,
      destination.caption,
      `Destination limit: ${destination.platformLimit} ${destination.unit}. ${destination.behaviour}`,
    ].join("\n"),
  );
  return [
    `APPROVAL PACKAGE · ${value.source.name}`,
    "",
    `Item: ${value.item.id} · revision ${value.item.revision} · ${value.item.stateLabel}`,
    `Workspace: ${value.workspace.name}`,
    `Source: ${value.source.name} · ${value.source.publication === null ? "Woodhouse Share artwork" : `published revision ${value.source.publication}`} · ${value.artwork?.status ?? (value.source.current ? "current" : "no longer current")}`,
    `Source address: ${value.source.url ?? SHARE_PACKAGE_NOT_RECORDED}`,
    ...(value.artwork
      ? [
          `Artwork: ${oneLine(value.artwork.title)} · credit ${oneLine(value.artwork.credit)} · revision ${oneLine(value.artwork.assetRevision)}`,
          `Artwork bytes: ${value.artwork.byteLength} bytes · SHA-256 ${value.artwork.bytesSha256} · ${value.artwork.status}`,
          `Artwork source: ${value.artwork.sourceUrl}`,
          `Artwork provenance: ${value.artwork.statement}`,
        ]
      : []),
    `Schedule: ${value.schedule.label}`,
    `Schedule UTC: ${value.schedule.scheduledAt ?? "not scheduled"}`,
    `Link: ${value.link ?? SHARE_PACKAGE_NOT_RECORDED}`,
    `${value.artwork ? "Saved rendition" : "Share image"}: ${image}`,
    "",
    destinations.join("\n\n"),
    "",
    ...(value.bluesky ? [blueskyPlainText(value.bluesky), ""] : []),
    `Provenance: ${value.provenance.statement} Item updated ${value.provenance.preparedAt}; item revision ${value.provenance.itemRevision}; source revision ${value.provenance.sourceRevision}.`,
    value.posting.statement,
    "",
  ].join("\n");
}

export function sharePackageFilename(
  item: Pick<
    ShareCalendarItem,
    "id" | "stackSlug" | "publication" | "revision" | "catalogue"
  >,
  format: "json" | "md",
): string {
  const source =
    item.catalogue?.assetId ?? `${item.stackSlug}-r${item.publication}`;
  return `approval-${source}-${item.id.slice(0, 8)}-rev${item.revision}.${format}`;
}
