// Exact, offline approval package for a share item (#604).
// The package is derived only from persisted values. It deliberately has no
// clock, random value or network read, so exporting the same saved item twice
// produces byte-identical JSON and Markdown. Nothing here posts, schedules a
// delivery or changes the item's state.
import {
  SHARE_CHANNEL_LABELS,
  SHARE_STATE_LABELS,
  captionUsage,
  scheduleLabels,
  type CaptionUnit,
  type ShareCalendarItem,
  type ShareCalendarSnapshot,
  type ShareCalendarSource,
  type ShareChannel,
} from "./share-calendar.ts";
import type { SharePackageBluesky } from "./share-approval.ts";

export const SHARE_PACKAGE_SCHEMA = "composer.share-approval-package/v1";
export const SHARE_PACKAGE_NOT_RECORDED = "not recorded";
export const SHARE_PACKAGE_OWNER_TIME_ZONE = "Australia/Melbourne";
export const SHARE_PACKAGE_POSTING_STATEMENT =
  "This approval package does not post by itself. A Bluesky send needs a separate configured connection and an explicit confirmation; otherwise you perform this share yourself.";
export const SHARE_PACKAGE_PROVENANCE_STATEMENT =
  "Prepared in App Composer from the persisted published stack revision and the saved item revision. The package makes no network request and changes no state.";

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
    ownerPerformsShare: true;
    statement: string;
  };
  // Present only when the item has a Bluesky draft. It carries the exact
  // account state, text/media hashes, intended time and approval state. Its
  // absence must never be read as an approved account.
  bluesky?: SharePackageBluesky;
}

function recorded(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
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
    ...item.variants.map((variant) =>
      destinationFor(
        variant.channel,
        variant.destination,
        variant.caption,
        false,
      ),
    ),
  ];
  const catalogue = item.catalogue;
  const imagePath = catalogue?.renditionUrl ?? source?.imagePath ?? null;
  const imageUrl =
    catalogue?.renditionUrl ??
    (source && imagePath ? new URL(imagePath, source.url).href : null);
  const scheduleLabel = !item.scheduledAt
    ? "Not scheduled"
    : labels
      ? `${labels.melbourne} · ${labels.utc}`
      : "Unreadable date";
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
      url: catalogue?.projectUrl ?? source?.url ?? null,
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
        ? "Prepared from the approved catalogue rendition and saved item revision in App Composer. Preparing this package changes no state."
        : SHARE_PACKAGE_PROVENANCE_STATEMENT,
    },
    posting: {
      composerPosts: false,
      ownerPerformsShare: true,
      statement: SHARE_PACKAGE_POSTING_STATEMENT,
    },
    ...(options.bluesky ? { bluesky: options.bluesky } : {}),
  };
}

// The native page uses this exact helper, so a page-data test can prove the
// package is assembled from the persisted snapshot and not from editor state.
export function approvalPackageForItem(
  snapshot: ShareCalendarSnapshot,
  item: ShareCalendarItem,
  bluesky?: SharePackageBluesky | null,
): ShareApprovalPackage {
  return buildShareApprovalPackage(item, {
    workspace: snapshot.workspace.name,
    source:
      snapshot.sources.find(
        (entry) =>
          entry.id === item.stack && entry.publication === item.publication,
      ) ?? null,
    bluesky,
  });
}

export function sharePackageJson(value: ShareApprovalPackage): string {
  return JSON.stringify(value, null, 2) + "\n";
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
    `- **Source and rights:** ${value.source.rightsNote}`,
    `- **Send:** unavailable · ${value.send.code} · ${value.send.message}`,
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
    `# Approval package · ${value.source.name.replace(/\s+/g, " ")}`,
    "",
    `- **Item:** \`${value.item.id}\` · revision ${value.item.revision} · ${value.item.stateLabel}`,
    `- **Workspace:** ${value.workspace.name}`,
    `- **Source:** ${value.source.name.replace(/\s+/g, " ")} · ${value.source.publication === null ? "Woodhouse Share artwork" : `published revision ${value.source.publication}`} · ${value.source.current ? "current" : "no longer current"}`,
    `- **Source address:** ${value.source.url ?? SHARE_PACKAGE_NOT_RECORDED}`,
    `- **Schedule:** ${value.schedule.label}${value.schedule.scheduledAt ? ` · UTC \`${value.schedule.scheduledAt}\`` : ""}`,
    `- **Link:** ${value.link ?? SHARE_PACKAGE_NOT_RECORDED}`,
    `- **Share image:** ${image}`,
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
    } · not sent`,
    `Source and rights: ${value.source.rightsNote}`,
    `Send: unavailable · ${value.send.code} · ${value.send.message}`,
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
    `Source: ${value.source.name} · ${value.source.publication === null ? "Woodhouse Share artwork" : `published revision ${value.source.publication}`} · ${value.source.current ? "current" : "no longer current"}`,
    `Source address: ${value.source.url ?? SHARE_PACKAGE_NOT_RECORDED}`,
    `Schedule: ${value.schedule.label}`,
    `Schedule UTC: ${value.schedule.scheduledAt ?? "not scheduled"}`,
    `Link: ${value.link ?? SHARE_PACKAGE_NOT_RECORDED}`,
    `Share image: ${image}`,
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
