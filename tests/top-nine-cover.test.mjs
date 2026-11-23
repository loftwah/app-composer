import assert from 'node:assert/strict';
import test from 'node:test';
import {
  coverBox, coverFileLimit, coverHeadLimit, coverPixelLimit, coverWorkingMax, sniffCover,
} from '../src/lib/top-nine-cover.ts';

// A cover is only ever accepted after its real bytes identify it as a bounded
// PNG, JPEG or WebP. Everything here runs on hand-built headers, so no image
// decoding is needed to prove the guard.

const u16be = (value) => [value >> 8 & 255, value & 255];
const u32be = (value) => [value >>> 24 & 255, value >>> 16 & 255, value >>> 8 & 255, value & 255];
const u16le = (value) => [value & 255, value >> 8 & 255];

const png = (width, height) => new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  ...u32be(width), ...u32be(height),
]);
const jpegSegment = (marker, payload) => [0xff, marker, ...u16be(payload.length + 2), ...payload];
const jpeg = (width, height, { marker = 0xc0, prefix = [] } = {}) => new Uint8Array([
  0xff, 0xd8, ...prefix,
  ...jpegSegment(marker, [8, ...u16be(height), ...u16be(width), 3]),
]);
const riff = (tag) => [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...tag];
const webpExtended = (width, height) => new Uint8Array([
  ...riff([0x56, 0x50, 0x38, 0x58]), 0, 0, 0, 0, 0, 0, 0, 0,
  width - 1 & 255, width - 1 >> 8 & 255, width - 1 >> 16 & 255,
  height - 1 & 255, height - 1 >> 8 & 255, height - 1 >> 16 & 255,
]);
const webpLossy = (width, height) => new Uint8Array([
  ...riff([0x56, 0x50, 0x38, 0x20]), 0, 0, 0, 0, 0x83, 0x00, 0x00,
  0x9d, 0x01, 0x2a, ...u16le(width), ...u16le(height),
]);
const webpLossless = (width, height) => {
  const bits = (((height - 1) << 14) | (width - 1)) >>> 0;
  return new Uint8Array([
    ...riff([0x56, 0x50, 0x38, 0x4c]), 0, 0, 0, 0, 0x2f,
    bits & 255, bits >> 8 & 255, bits >> 16 & 255, bits >> 24 & 255,
  ]);
};

test('reads PNG, baseline JPEG, progressive JPEG and every WebP flavour', () => {
  assert.deepEqual(sniffCover(png(4000, 3000)), { kind: 'png', width: 4000, height: 3000 });
  assert.deepEqual(sniffCover(jpeg(1234, 567)), { kind: 'jpeg', width: 1234, height: 567 });
  const prefix = jpegSegment(0xe0, [0x00, 0x01, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  assert.deepEqual(
    sniffCover(jpeg(1920, 1080, { marker: 0xc2, prefix })),
    { kind: 'jpeg', width: 1920, height: 1080 },
  );
  assert.deepEqual(sniffCover(webpExtended(550, 360)), { kind: 'webp', width: 550, height: 360 });
  assert.deepEqual(sniffCover(webpLossy(1280, 720)), { kind: 'webp', width: 1280, height: 720 });
  assert.deepEqual(sniffCover(webpLossless(412, 411)), { kind: 'webp', width: 412, height: 411 });
});

test('rejects renamed SVG, other formats and non-image bytes', () => {
  const files = [
    new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    new TextEncoder().encode('<?xml version="1.0"?><svg viewBox="0 0 1 1"/>'),
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]), // GIF
    new Uint8Array([0x42, 0x4d, 0, 0, 0, 0]), // BMP
    new TextEncoder().encode('%PDF-1.7'),
    new Uint8Array(),
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // truncated signature
  ];
  for (const bytes of files) assert.equal(sniffCover(bytes), null);
});

test('rejects damaged headers instead of guessing dimensions', () => {
  assert.equal(sniffCover(new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0, 0, 0, 13, 0x74, 0x45, 0x58, 0x74, // first chunk is not IHDR
    ...u32be(10), ...u32be(10),
  ])), null);
  assert.equal(sniffCover(png(0, 100)), null); // zero dimension is invalid
  assert.equal(sniffCover(jpeg(640, 0)), null);
  assert.equal(sniffCover(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 12])), null); // scan before SOF
  assert.equal(sniffCover(new Uint8Array([0xff, 0xd8, 0x12, 0x34])), null); // corrupt between markers
  assert.equal(sniffCover(new Uint8Array([
    ...riff([0x56, 0x50, 0x38, 0x20]), 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, // bad keyframe code
  ])), null);
  assert.equal(sniffCover(new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, // RIFF but not WEBP
  ])), null);
});

test('reports oversized dimensions so the editor can refuse them honestly', () => {
  const sniffed = sniffCover(png(40000, 40000));
  assert.deepEqual(sniffed, { kind: 'png', width: 40000, height: 40000 });
  assert.equal(sniffed.width * sniffed.height > coverPixelLimit, true);
  assert.equal(coverFileLimit > 0 && coverHeadLimit > 0 && coverWorkingMax > 0, true);
});

// A fit is the only choice a cover gets: crop to fill the cell, or keep every
// edge and letterbox the rest on the cell ink. These rectangles are exactly
// what the preview and the non-wide export paint.

test('coverBox fills a square cell by cropping, and letterboxes under contain', () => {
  // A wide cover in a square cell: fill overflows the sides, whole keeps
  // both side edges and letterboxes above and below.
  assert.deepEqual(coverBox(600, 300, 300, 300, 'cover'), { width: 600, height: 300 });
  assert.deepEqual(coverBox(600, 300, 300, 300, 'contain'), { width: 300, height: 150 });
});

test('coverBox treats portrait art as the mirror of wide art', () => {
  assert.deepEqual(coverBox(300, 600, 300, 300, 'cover'), { width: 300, height: 600 });
  assert.deepEqual(coverBox(300, 600, 300, 300, 'contain'), { width: 150, height: 300 });
});

test('coverBox leaves square art identical under either fit', () => {
  assert.deepEqual(coverBox(300, 300, 300, 300, 'cover'), { width: 300, height: 300 });
  assert.deepEqual(coverBox(300, 300, 300, 300, 'contain'), { width: 300, height: 300 });
});
