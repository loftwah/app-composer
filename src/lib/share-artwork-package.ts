// Browser-local, one-click package for an already-public Share artwork.
//
// This module never fetches a public source. Artwork bytes must be supplied
// from the existing revision-bound /api/share-artwork-download route, which
// re-checks public eligibility and the catalogue revision before streaming.
// The archive writer is the repo's bounded, dependency-free ZIP STORE writer.
import { zip } from "../../lib/launch-kit/archive.mjs";

export const PACKAGE_TEXT_NAME = "post-text.txt";
export const PACKAGE_MANIFEST_NAME = "provenance.json";

// The shared ZIP writer caps a package at 8 MiB. Leave headroom for the text,
// manifest and ZIP headers so a clear recovery message can be shown instead.
const MAX_ARTWORK_BYTES = 7 * 1024 * 1024;

export interface ArtworkPackageInput {
  assetId: string;
  revision: string;
  title: string;
  credit: string;
  sourceUrl: string | null;
  canonical: string;
  extension: string;
  postTextFile: string;
  alt: string;
  bytes: Uint8Array;
}

export function artworkPackageName(assetId: string): string {
  return `${assetId}-post-package.zip`;
}

function artworkEntryName(assetId: string, extension: string): string {
  const base = assetId.slice(0, 60);
  const ext = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${base}-artwork.${ext}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function readArtworkPackageBytes(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader();
  if (!reader) throw Error("The artwork download is empty.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ARTWORK_BYTES) {
        await reader.cancel().catch(() => {});
        throw Error("This artwork is too large for one package. Use the direct download instead.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw Error("The artwork download is empty.");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function buildArtworkPackage(input: ArtworkPackageInput) {
  if (input.bytes.length > MAX_ARTWORK_BYTES)
    throw Error(
      "This artwork is too large for one package. Use the direct download instead.",
    );

  const artworkFile = artworkEntryName(input.assetId, input.extension);
  const artworkSha256 = await sha256Hex(input.bytes);
  const provenance = {
    schema: "composer.share-artwork-package/v1",
    assetId: input.assetId,
    revision: input.revision,
    title: input.title,
    credit: input.credit,
    source: input.sourceUrl,
    canonical: input.canonical,
    imageAlt: input.alt,
    artworkFile,
    artworkBytes: input.bytes.length,
    artworkSha256,
    note: "Artwork bytes came from the revision-bound public artwork download on this page; the current catalogue revision was checked first.",
  };
  const encoder = new TextEncoder();
  const files = new Map<string, Uint8Array>([
    [artworkFile, input.bytes],
    [PACKAGE_TEXT_NAME, encoder.encode(input.postTextFile)],
    [
      PACKAGE_MANIFEST_NAME,
      encoder.encode(`${JSON.stringify(provenance, null, 2)}\n`),
    ],
  ]);
  return {
    name: artworkPackageName(input.assetId),
    archive: zip(files),
    provenance,
  };
}
