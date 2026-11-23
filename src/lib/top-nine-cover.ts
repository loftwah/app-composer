// Cover art a person supplies from their own device for a Top Nine exhibit.
// The bytes never leave the browser: only these local checks read them, and
// only the finished canvas export carries the pixels. Anything that is not a
// real PNG, JPEG or WebP file — including renamed SVG with active content —
// is rejected by its magic bytes before it is ever decoded or displayed.

export const coverFileLimit = 20 * 1024 * 1024;
export const coverHeadLimit = 1_048_576;
export const coverPixelLimit = 30_000_000;
export const coverWorkingMax = 720;

/** How one hung cover fills its exhibit cell: cropped edge to edge, or the
 * whole artwork letterboxed on the cell ink. Like the art itself, a fit is
 * chosen per cover in the tab and never travels in a link, draft or export
 * snapshot — only into the drawn pixels. */
export type CoverFit = "cover" | "contain";

export interface SniffedCover {
  kind: "png" | "jpeg" | "webp";
  width: number;
  height: number;
}

/** The size a cover paints inside one box for the chosen fit: "cover" crops
 * the art to fill the box, "contain" keeps every edge, letterboxing the rest. */
export function coverBox(
  coverWidth: number,
  coverHeight: number,
  boxWidth: number,
  boxHeight: number,
  fit: CoverFit,
): { width: number; height: number } {
  const scale = fit === "contain"
    ? Math.min(boxWidth / coverWidth, boxHeight / coverHeight)
    : Math.max(boxWidth / coverWidth, boxHeight / coverHeight);
  return { width: coverWidth * scale, height: coverHeight * scale };
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const jpegFrameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function isTag(bytes: Uint8Array, offset: number, tag: string) {
  for (let index = 0; index < tag.length; index += 1) {
    if (bytes[offset + index] !== tag.charCodeAt(index)) return false;
  }
  return true;
}

function readPng(bytes: Uint8Array): SniffedCover | null {
  if (bytes.length < 24) return null;
  for (let index = 0; index < pngSignature.length; index += 1) {
    if (bytes[index] !== pngSignature[index]) return null;
  }
  const ihdrLength = (bytes[8] << 24 | bytes[9] << 16 | bytes[10] << 8 | bytes[11]) >>> 0;
  if (ihdrLength !== 13 || !isTag(bytes, 12, "IHDR")) return null;
  return {
    kind: "png",
    width: (bytes[16] << 24 | bytes[17] << 16 | bytes[18] << 8 | bytes[19]) >>> 0,
    height: (bytes[20] << 24 | bytes[21] << 16 | bytes[22] << 8 | bytes[23]) >>> 0,
  };
}

/** Frame dimensions sit in the first SOF segment, before the scan data. */
function readJpeg(bytes: Uint8Array): SniffedCover | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let position = 2;
  while (position + 3 < bytes.length) {
    if (bytes[position] !== 0xff) return null;
    const marker = bytes[position + 1];
    if (marker === 0xff) { position += 1; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker >= 0xd0 && marker <= 0xd7) { position += 2; continue; }
    const length = (bytes[position + 2] << 8) | bytes[position + 3];
    if (length < 2) return null;
    if (jpegFrameMarkers.has(marker)) {
      if (position + 9 > bytes.length) return null;
      return {
        kind: "jpeg",
        height: (bytes[position + 5] << 8) | bytes[position + 6],
        width: (bytes[position + 7] << 8) | bytes[position + 8],
      };
    }
    position += 2 + length;
  }
  return null;
}

function readWebp(bytes: Uint8Array): SniffedCover | null {
  if (bytes.length < 16 || !isTag(bytes, 0, "RIFF") || !isTag(bytes, 8, "WEBP")) return null;
  const tag = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (tag === "VP8X") {
    if (bytes.length < 30) return null;
    return {
      kind: "webp",
      width: 1 + (bytes[24] | bytes[25] << 8 | bytes[26] << 16),
      height: 1 + (bytes[27] | bytes[28] << 8 | bytes[29] << 16),
    };
  }
  if (tag === "VP8 ") {
    if (bytes.length < 30) return null;
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      kind: "webp",
      width: (bytes[26] | bytes[27] << 8) & 0x3fff,
      height: (bytes[28] | bytes[29] << 8) & 0x3fff,
    };
  }
  if (tag === "VP8L") {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    const bits = bytes[21] | bytes[22] << 8 | bytes[23] << 16 | bytes[24] << 24;
    return {
      kind: "webp",
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >>> 14) & 0x3fff),
    };
  }
  return null;
}

/** Dimensions and format from the file header alone, before any decode. */
export function sniffCover(bytes: Uint8Array): SniffedCover | null {
  const sniffed = readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes);
  return sniffed && sniffed.width > 0 && sniffed.height > 0 ? sniffed : null;
}
