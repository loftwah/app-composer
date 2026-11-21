// First-party Share artwork comes from the public release manifest. Legacy
// results come from the fixed Woodhouse catalogue (#477/#604). Each source
// can only resolve its own public image origin. Downloads and Calendar bind
// the catalogue revision and the image bytes without using credentials.
import { z } from "zod";
import workshopShare from "./workshop-share-20261122.json" with { type: "json" };
import shareResources from "./share-resources-20261120.json" with { type: "json" };
import internetWorkshop from "./internet-workshop-20261122.json" with { type: "json" };
import {
  catalogueAssetSchema,
  catalogueIdentity,
  isSafeShareLink,
  type CatalogueResolvedAsset,
} from "./share-calendar.ts";
import {
  fetchBlueskyImage,
  type BlueskyFetchOptions,
} from "./bluesky-publisher.ts";

const composerOrigin = "https://composer.loftwah.com";
const nativeCollections = new Map<string, (typeof workshopShare | typeof internetWorkshop | (typeof shareResources)["briefing-cards"])>([
  ["workshop-series", workshopShare],
  ["internet-workshop", internetWorkshop],
  ...Object.entries(shareResources),
]);
const nativeRecords = new Map([...nativeCollections].flatMap(([tag, records]) =>
  records.map((record) => [record.id, { tag, record }] as const),
));

export const SHARE_CATALOGUE_ORIGIN = "https://woodhouse.loftwah.com";
export const SHARE_CATALOGUE_API_BASE = `${SHARE_CATALOGUE_ORIGIN}/api/v1/assets`;
export const SHARE_CATALOGUE_JSON_MAX_BYTES = 65_536;
export const SHARE_CATALOGUE_ID_MAX = 128;
export const SHARE_CATALOGUE_REVISION_MAX = 200;
export const SHARE_CATALOGUE_ALT_MAX = 2_000;
export const SHARE_CATALOGUE_CREDIT_MAX = 300;
export const SHARE_CATALOGUE_QUERY_MAX = 100;
const SHARE_CATALOGUE_SEARCH_LIMIT = 8;
const SHARE_CATALOGUE_TITLE_MAX = 160;
const SHARE_CATALOGUE_PROJECT_MAX = 128;

// Only a bare, lowercase, hyphenated slug. No dots, slashes, percent escapes,
// query or fragment can reach the fixed URL, and ".." cannot form a path step.
export const SHARE_CATALOGUE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;

export function normalizeShareAssetId(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > SHARE_CATALOGUE_ID_MAX ||
    !SHARE_CATALOGUE_ID_PATTERN.test(value) ||
    value.includes("..")
  )
    return null;
  return value;
}

export function shareAssetApiUrl(assetId: string): string | null {
  const id = normalizeShareAssetId(assetId);
  return id ? `${SHARE_CATALOGUE_API_BASE}/${id}` : null;
}

export type CatalogueResolveResult =
  | { ok: true; asset: CatalogueResolvedAsset; sourceDescription?: string }
  | { ok: false; code: string; message: string };

const failed = (code: string, message: string): CatalogueResolveResult => ({
  ok: false,
  code,
  message,
});

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

// Read the catalogue JSON with a hard body cap. A lying or missing
// content-length never permits an unbounded buffer.
export async function readBoundedJson(
  response: Response,
  signal: AbortSignal,
  maxBytes = SHARE_CATALOGUE_JSON_MAX_BYTES,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The catalogue returned no readable body.");
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  if (signal.aborted) {
    cancel();
    throw new Error("timeout");
  }
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        cancel();
        throw new Error("The catalogue body was not readable bytes.");
      }
      total += value.byteLength;
      if (total > maxBytes) {
        cancel();
        throw new Error("The catalogue response is too large.");
      }
      if (value.byteLength) chunks.push(value);
    }
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    try {
      reader.releaseLock();
    } catch {
      /* The stream is already closed. */
    }
  }
  if (signal.aborted) throw new Error("timeout");
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

function catalogueObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseAsset(payload: unknown, assetId: string, origin = SHARE_CATALOGUE_ORIGIN) {
  const envelope = catalogueObject(payload);
  const asset = catalogueObject(envelope?.asset);
  if (
    envelope?.version !== 1 ||
    asset?.id !== assetId ||
    asset.visibility !== "public" ||
    asset.reuse !== "unconfirmed"
  )
    return null;
  const title = boundedString(asset.title, 160);
  const alt = boundedString(asset.alt, SHARE_CATALOGUE_ALT_MAX);
  const credit = boundedString(asset.credit, SHARE_CATALOGUE_CREDIT_MAX);
  const projectUrl = boundedString(asset.projectUrl, 2048);
  const sourceUrl = boundedString(asset.sourceUrl, 2048);
  const renditionUrl = boundedString(asset.previewUrl, 2048);
  if (
    !title ||
    !alt ||
    !credit ||
    !projectUrl ||
    !isSafeShareLink(projectUrl) ||
    !sourceUrl ||
    !isSafeShareLink(sourceUrl) ||
    !renditionUrl ||
    !isSafeShareLink(renditionUrl)
  )
    return null;
  const preview = new URL(renditionUrl);
  if (
    preview.origin !== origin ||
    !preview.pathname.startsWith("/campaign/") ||
    !/\.(?:jpe?g|png|webp)$/i.test(preview.pathname) ||
    preview.search ||
    preview.hash
  )
    return null;
  const original = catalogueObject(asset.original);
  return {
    assetId,
    title,
    renditionUrl,
    alt,
    credit,
    projectUrl,
    sourceUrl,
    version: boundedString(original?.version, SHARE_CATALOGUE_REVISION_MAX),
  };
}

export interface CatalogueFetchOptions extends BlueskyFetchOptions {
  timeoutMs?: number;
  // Optional exact public artwork revision. When supplied, the resolver derives
  // the current revision from the already-fetched catalogue JSON and refuses a
  // stale or unavailable link before fetching the rendition. Without it the
  // direct preview/save path is byte-for-byte unchanged.
  expectedArtworkRevision?: string;
}

// Resolve the exact asset: bounded JSON from the fixed URL, no redirects, then
// the exact image bytes through the existing bounded image fetch.
export async function resolveShareCatalogueAsset(
  assetIdValue: unknown,
  options: CatalogueFetchOptions = {},
): Promise<CatalogueResolveResult> {
  const assetId = normalizeShareAssetId(assetIdValue);
  const sourceUrl = shareAssetApiUrl(assetId ?? "");
  if (!assetId || !sourceUrl)
    return failed(
      "invalid_asset_id",
      "Use a single lowercase catalogue asset ID (letters, digits and hyphens only).",
    );
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function")
    return failed(
      "unavailable",
      "Composer has no network transport for the catalogue.",
    );
  const timeoutMs = Math.min(30_000, Math.max(10, options.timeoutMs ?? 8_000));
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  try {
    const native = nativeRecords.get(assetId);
    const origin = native ? composerOrigin : SHARE_CATALOGUE_ORIGIN;
    let payload: unknown = { version: 1, asset: native?.record };
    if (!native) {
      const response = await Promise.race([
        doFetch(sourceUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "manual",
          signal: controller.signal,
        }),
        timedOut,
      ]);
      if (response.status >= 300 && response.status < 400)
        return failed(
          "catalogue_redirect",
          "The catalogue asset redirected. Composer did not follow it.",
        );
      if (!response.ok)
        return failed(
          "catalogue_missing",
          `The catalogue returned HTTP ${response.status} for this asset. Nothing was selected.`,
        );
      const declared = Number(response.headers.get("content-length") ?? "");
      if (Number.isFinite(declared) && declared > SHARE_CATALOGUE_JSON_MAX_BYTES)
        return failed(
          "catalogue_invalid",
          "The catalogue response is too large.",
        );
      payload = await Promise.race([
        readBoundedJson(response, controller.signal),
        timedOut,
      ]);
    }
    const asset = parseAsset(payload, assetId, origin);
    if (!asset)
      return failed(
        "catalogue_invalid",
        "The catalogue did not supply a current public image rendition, alt, credit and project URL for this asset.",
      );
    // Verify the linked public artwork against the SAME bounded JSON response
    // already in hand, before any rendition fetch. No second catalogue record
    // is read and the supplied token is never trusted as an authority: the
    // current revision is always derived locally from the live payload.
    let sourceDescription: string | undefined;
    if (options.expectedArtworkRevision !== undefined) {
      const linked = catalogueArtwork(catalogueObject(payload)?.asset, origin, native?.tag);
      const current = linked ? await artworkRevision(linked) : null;
      if (!current)
        return failed(
          "artwork_unavailable",
          "The linked public artwork is no longer available in the catalogue. Return to the artwork page and use its current Calendar link.",
        );
      if (current !== options.expectedArtworkRevision)
        return failed(
          "artwork_stale",
          "The linked public artwork revision changed. Return to the artwork page and use its current Calendar link.",
        );
      sourceDescription = linked?.caption || linked?.description || undefined;
    }
    const imageResult = await fetchBlueskyImage(asset.renditionUrl, {
      fetch: doFetch,
      timeoutMs,
    });
    if (!imageResult.ok)
      return failed(
        "rendition_unavailable",
        `The catalogue rendition could not be verified: ${imageResult.message}`,
      );
    const { version, ...fields } = asset;
    const bytesSha256 = await sha256Bytes(imageResult.image.bytes);
    const exact: CatalogueResolvedAsset = {
      ...fields,
      assetRevision: version ?? bytesSha256,
      byteLength: imageResult.image.bytes.byteLength,
      bytesSha256,
      mimeType: imageResult.image.mimeType,
    };
    return { ok: true, asset: catalogueAssetSchema.parse(exact), ...(sourceDescription ? { sourceDescription } : {}) };
  } catch (error) {
    return failed(
      "unavailable",
      error instanceof Error && error.message === "timeout"
        ? "The catalogue did not respond within the short timeout. Nothing was selected."
        : "The catalogue asset could not be read. Nothing was selected.",
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface CatalogueSearchItem {
  assetId: string;
  title: string;
  project: string;
}

export type CatalogueSearchResult =
  | { ok: true; items: CatalogueSearchItem[] }
  | { ok: false; code: string; message: string };

export const catalogueSearchReplySchema = z
  .object({
    ok: z.literal(true),
    action: z.literal("catalogueSearch"),
    items: z
      .array(
        z
          .object({
            assetId: z.string().regex(SHARE_CATALOGUE_ID_PATTERN),
            title: z.string().min(1).max(SHARE_CATALOGUE_TITLE_MAX),
            project: z.string().max(SHARE_CATALOGUE_PROJECT_MAX),
          })
          .strict(),
      )
      .max(SHARE_CATALOGUE_SEARCH_LIMIT),
  })
  .strict();

// Search results only identify candidates. Selection still goes through the
// exact rendition and provenance checks in resolveShareCatalogueAsset.
export async function searchShareCatalogueAssets(
  query: string,
  options: CatalogueFetchOptions = {},
): Promise<CatalogueSearchResult> {
  const q = query.trim();
  if (!q || q.length > SHARE_CATALOGUE_QUERY_MAX)
    return {
      ok: false,
      code: "INVALID",
      message: "Enter up to 100 characters to search the catalogue.",
    };

  const words = q.toLowerCase().split(/\s+/);
  const local = [...nativeRecords.values()]
    .map(({ record }) => record)
    .filter(({ title, description, tags }) => {
      const searchable = [title, description, "app composer", ...tags].join(" ").toLowerCase();
      return words.every((word) => searchable.includes(word));
    })
    .slice(0, SHARE_CATALOGUE_SEARCH_LIMIT)
    .map(({ id, title, project }) => ({ assetId: id, title, project }));
  if (local.length === SHARE_CATALOGUE_SEARCH_LIMIT) return { ok: true, items: local };
  const endpoint = new URL(SHARE_CATALOGUE_API_BASE);
  endpoint.searchParams.set("q", q);
  endpoint.searchParams.set("limit", String(SHARE_CATALOGUE_SEARCH_LIMIT));
  const signal = AbortSignal.timeout(
    Math.min(30_000, Math.max(10, options.timeoutMs ?? 8_000)),
  );
  const unavailable: CatalogueSearchResult = local.length ? { ok: true, items: local } : {
    ok: false,
    code: "UNAVAILABLE",
    message:
      "Woodhouse Share could not be searched. Try again or enter an asset ID.",
  } as const;
  try {
    const response = await (options.fetch ?? globalThis.fetch)(endpoint.href, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal,
    });
    if (
      !response.ok ||
      Number(response.headers.get("content-length")) >
        SHARE_CATALOGUE_JSON_MAX_BYTES
    ) {
      await response.body?.cancel().catch(() => {});
      return unavailable;
    }
    const envelope = catalogueObject(await readBoundedJson(response, signal));
    if (envelope?.version !== 1 || !Array.isArray(envelope.assets))
      return unavailable;

    const items = new Map(local.map((item) => [item.assetId, item]));
    for (const raw of envelope.assets.slice(0, SHARE_CATALOGUE_SEARCH_LIMIT)) {
      const asset = catalogueObject(raw);
      if (asset?.visibility !== "public" || asset.reuse !== "unconfirmed")
        continue;
      const assetId = normalizeShareAssetId(asset.id);
      const title = boundedString(asset.title, SHARE_CATALOGUE_TITLE_MAX);
      const project = boundedString(asset.project, SHARE_CATALOGUE_PROJECT_MAX);
      if (items.size >= SHARE_CATALOGUE_SEARCH_LIMIT) break;
      if (assetId && title && project && !nativeRecords.has(assetId) && !items.has(assetId)) {
        items.set(assetId, { assetId, title, project });
      }
    }
    return { ok: true, items: [...items.values()] };
  } catch {
    return unavailable;
  }
}

export interface ArtworkFile {
  url: string;
  label: string;
  width: number | null;
  height: number | null;
}

export interface ArtworkVersion {
  url: string;
  label: string;
  note: string | null;
  sourceUrl: string | null;
}

export interface CatalogueArtwork extends CatalogueSearchItem {
  alt: string;
  credit: string;
  thumbnailUrl: string;
  previewUrl: string;
  shareUrl: string;
  projectUrl: string | null;
  sourceUrl: string | null;
  description: string;
  caption?: string;
  reviewedAt: string;
  category: string;
  tags: string[];
  thumbnailSize: ArtworkFile | undefined;
  original: ArtworkFile | null;
  formats: ArtworkFile[];
  versions: ArtworkVersion[];
  kitUrl: string | null;
  revisionSource: string;
}

const artworkDimension = (n: unknown) =>
  typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 24_000 ? n : null;

function artworkFile(value: unknown, fallback: string, origin: string): ArtworkFile | null {
  const record = catalogueObject(value);
  const url = publicArtworkUrl(record?.url, campaignArtworkPath, origin);
  if (!url) return null;
  return {
    url,
    label: boundedString(record?.label, 100) ?? fallback,
    width: artworkDimension(record?.width),
    height: artworkDimension(record?.height),
  };
}

export function artworkFiles(artwork: CatalogueArtwork) {
  return [...new Map([
    (artwork.original ?? { url: artwork.previewUrl, label: "Preview", width: null, height: null }),
    ...artwork.formats,
  ].map(file => [file.url, file])).values()];
}

const campaignArtworkPath = /^\/campaign\/.+\.(?:jpe?g|png|webp)$/i;

function catalogueArtwork(raw: unknown, origin = SHARE_CATALOGUE_ORIGIN, collection?: string): CatalogueArtwork | null {
  const asset = catalogueObject(raw);
  if (asset?.visibility !== "public") return null;
  const assetId = normalizeShareAssetId(asset.id);
  const project = normalizeShareAssetId(asset.project);
  const title = boundedString(asset.title, SHARE_CATALOGUE_TITLE_MAX);
  const alt = boundedString(asset.alt, SHARE_CATALOGUE_ALT_MAX);
  const credit = boundedString(asset.credit, SHARE_CATALOGUE_CREDIT_MAX);
  const thumbnailUrl = publicArtworkUrl(asset.thumbnailUrl, campaignArtworkPath, origin);
  const previewUrl = publicArtworkUrl(asset.previewUrl, campaignArtworkPath, origin);
  const shareUrl = collection
    ? `${composerOrigin}/share?${new URLSearchParams({ tag: collection })}`
    : publicArtworkUrl(asset.shareUrl, /^\/share\/[a-z0-9-]+\/$/, origin);
  if (!(assetId && project && title && alt && credit && thumbnailUrl && previewUrl && shareUrl))
    return null;
  const original = artworkFile(asset.original, "Original", origin);
  const formats = Array.isArray(asset.formats)
    ? asset.formats.slice(0, 20).flatMap((raw) => {
        const file = artworkFile(raw, "Image", origin);
        return file ? [file] : [];
      })
    : [];
  const versions = artworkVersions(asset.versions);
  const reviewedAt = typeof asset.reviewedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asset.reviewedAt)
    ? asset.reviewedAt : "";
  const stage = boundedString(asset.stage, 48)?.toLowerCase() ?? "";
  const category = asset.kind === "production screenshot" ? "screenshots"
    : asset.kind === "published product artwork" ? "product-art"
    : asset.use === "icon" || stage === "sticker or icon" ? "icons"
    : stage === "share poster" || stage === "collectible print" ? "posters"
    : asset.use === "banner" ? "banners"
    : asset.use === "sketch" ? "sketches" : "illustration";
  const tags = [...new Set([asset.use, asset.stage, ...(Array.isArray(asset.tags) ? asset.tags.slice(0, 12) : [])]
    .flatMap((value) => {
      const tag = boundedString(value, 48)?.toLowerCase();
      return tag && /^[a-z0-9][a-z0-9 -]*$/.test(tag) ? [tag] : [];
    }))];
  const source = catalogueObject(asset.original);
  return {
    assetId, project, title, alt, credit, thumbnailUrl, previewUrl, shareUrl,
    category, tags, reviewedAt, original, formats, versions,
    thumbnailSize: [...formats, ...(original ? [original] : [])].find((file) => file.url === thumbnailUrl)
      ?? (artworkDimension(asset.thumbnailWidth) && artworkDimension(asset.thumbnailHeight)
        ? { url: thumbnailUrl, label: "", width: artworkDimension(asset.thumbnailWidth), height: artworkDimension(asset.thumbnailHeight) }
        : undefined),
    description: boundedString(asset.description, 2500) ?? "",
    ...(origin === composerOrigin ? { caption: boundedString(asset.caption, 1000) ?? undefined } : {}),
    kitUrl: publicArtworkUrl(asset.kitUrl, origin === composerOrigin ? composerKitPath : campaignSourcePath, origin),
    projectUrl: typeof asset.projectUrl === "string" && isSafeShareLink(asset.projectUrl) ? asset.projectUrl : null,
    sourceUrl: publicArtworkUrl(asset.sourceUrl, campaignSourcePath, origin),
    revisionSource: JSON.stringify([source?.sha256 ?? null, source?.version ?? null, original?.url, previewUrl, reviewedAt]),
  };
}

const campaignSourcePath = /^\/campaign\/.+/;
const composerKitPath = /^(?:\/campaign\/.+|\/downloads\/app-composer\/share-kit-20261120\/app-composer-share-kit\.zip|\/diagrams\/engineering\/app-composer-diagrams-20261117\.zip)$/;

function artworkVersions(value: unknown): ArtworkVersion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((raw) => {
    const entry = catalogueObject(raw);
    const url = publicArtworkUrl(entry?.url, campaignSourcePath);
    const label = boundedString(entry?.label, 200);
    return url && label ? [{
      url,
      label,
      note: boundedString(entry?.note, 2_000),
      sourceUrl: publicArtworkUrl(entry?.sourceUrl, campaignSourcePath),
    }] : [];
  });
}

export async function publicShareArtwork(
  id: string,
  options: CatalogueFetchOptions = {},
): Promise<{ status: 200; artwork: CatalogueArtwork } | { status: 404 } | { status: 503 }> {
  const native = nativeRecords.get(id);
  if (native) {
    const artwork = catalogueArtwork(native.record, composerOrigin, native.tag);
    return artwork ? { status: 200, artwork } : { status: 404 };
  }
  const endpoint = shareAssetApiUrl(id);
  if (!endpoint) return { status: 404 };
  try {
    const signal = AbortSignal.timeout(options.timeoutMs ?? 2_000);
    const response = await (options.fetch ?? globalThis.fetch)(endpoint, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return response.status === 404 ? { status: 404 } : { status: 503 };
    }
    const envelope = catalogueObject(await readBoundedJson(response, signal));
    if (envelope?.version !== 1) return { status: 503 };
    const artwork = catalogueArtwork(envelope.asset);
    if (!artwork || artwork.assetId !== id) return { status: 404 };
    return { status: 200, artwork };
  } catch {
    return { status: 503 };
  }
}

export async function browseShareArtwork(
  filters: { query: string; project: string; after: string },
  options: CatalogueFetchOptions = {},
): Promise<{ items: CatalogueArtwork[]; nextAfter: string | null } | null> {
  const limit = 12;
  const endpoint = new URL(SHARE_CATALOGUE_API_BASE);
  endpoint.searchParams.set("limit", String(limit));
  if (filters.query) endpoint.searchParams.set("q", filters.query);
  if (filters.project) endpoint.searchParams.set("project", filters.project);
  if (filters.after) endpoint.searchParams.set("after", filters.after);

  const signal = AbortSignal.timeout(options.timeoutMs ?? 2_000);
  try {
    const response = await (options.fetch ?? globalThis.fetch)(endpoint.href, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    const envelope = catalogueObject(await readBoundedJson(response, signal));
    if (envelope?.version !== 1 || !Array.isArray(envelope.assets)) return null;

    const items = new Map<string, CatalogueArtwork>();
    for (const raw of envelope.assets.slice(0, limit)) {
      const artwork = catalogueArtwork(raw);
      if (artwork) items.set(artwork.assetId, artwork);
    }
    const nextAfter = normalizeShareAssetId(envelope.nextAfter);
    return { items: [...items.values()], nextAfter: nextAfter === filters.after ? null : nextAfter };
  } catch {
    return null;
  }
}

function composerCatalogue(records: Iterable<{ tag: string; record: unknown }>): CatalogueArtwork[] {
  return Array.from(records).flatMap(({ record, tag }) => {
    const artwork = catalogueArtwork(record, composerOrigin, tag);
    return artwork ? [artwork] : [];
  });
}

export function composerShareCollection(tag: string) {
  const records = nativeCollections.get(tag);
  return records ? composerCatalogue(records.map((record) => ({ tag, record }))) : null;
}

// A compact live projection keeps legacy eligibility and global sort order current.
export async function listShareArtwork(options: CatalogueFetchOptions = {}): Promise<CatalogueArtwork[] | null> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 6_000);
  try {
    const response = await (options.fetch ?? globalThis.fetch)(`${SHARE_CATALOGUE_API_BASE}?view=gallery`, {
      headers: { Accept: "application/json" }, redirect: "manual", signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    const envelope = catalogueObject(await readBoundedJson(response, signal, 8_388_608));
    if (envelope?.version !== 1 || !Array.isArray(envelope.assets)) return null;
    const items = new Map(composerCatalogue(nativeRecords.values()).map((artwork) => [artwork.assetId, artwork]));
    for (const raw of envelope.assets) {
      const artwork = catalogueArtwork(raw);
      if (artwork && !nativeRecords.has(artwork.assetId)) items.set(artwork.assetId, artwork);
    }
    return [...items.values()];
  } catch {
    return null;
  }
}

export const artworkRevision = (artwork: CatalogueArtwork) =>
  sha256Bytes(new TextEncoder().encode(JSON.stringify(["artwork", artwork.assetId, artwork.revisionSource])));

function publicArtworkUrl(value: unknown, path: RegExp, origin = SHARE_CATALOGUE_ORIGIN) {
  const href = boundedString(value, 2048);
  const url = href ? URL.parse(href) : null;
  if (
    url?.origin !== origin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !path.test(url.pathname)
  ) return null;
  return url.href;
}

export function sameCatalogueAsset(
  a: CatalogueResolvedAsset,
  b: CatalogueResolvedAsset,
): boolean {
  return (
    JSON.stringify(catalogueIdentity(a)) ===
    JSON.stringify(catalogueIdentity(b))
  );
}

export function cataloguePreviewHash(asset: CatalogueResolvedAsset) {
  return sha256Bytes(
    new TextEncoder().encode(JSON.stringify(catalogueIdentity(asset))),
  );
}
