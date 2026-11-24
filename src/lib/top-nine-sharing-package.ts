import { zip } from "../../lib/launch-kit/archive.mjs";
import { sha256Hex } from "./share-artwork-package.ts";

// The shared ZIP writer allows 8 MiB. Leave room for its headers and the text.
const MAX_PNG_BYTES = 7 * 1024 * 1024;

export async function buildTopNineSharingPackage(input: {
  png: Blob;
  filename: string;
  format: string;
  dimensions: readonly [number, number];
  caption: string;
  description: string;
}): Promise<Blob | null> {
  if (input.png.size > MAX_PNG_BYTES) return null;

  const image = new Uint8Array(await input.png.arrayBuffer());
  const [width, height] = input.dimensions;
  const manifest = {
    schema: "composer.top-nine-sharing/v1",
    visibility: "local",
    png: {
      name: input.filename,
      format: input.format,
      width,
      height,
      bytes: image.length,
      sha256: await sha256Hex(image),
    },
  };
  const encoder = new TextEncoder();
  const archive = zip(new Map([
    [input.filename, image],
    ["caption.txt", encoder.encode(input.caption)],
    ["image-description.txt", encoder.encode(input.description)],
    ["manifest.json", encoder.encode(JSON.stringify(manifest, null, 2) + "\n")],
  ]));
  return new Blob([new Uint8Array(archive)], { type: "application/zip" });
}
