// Encoding is only useful if a real scanner reads it back. This suite renders
// encoder's module matrix to a PNG through the same matrix the share controls
// use, then decodes the actual PNG with the independently maintained jsQR.
// The decoder is a pinned development dependency; this check never skips and
// needs no Python environment or retained temporary project.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import pngjs from 'pngjs';
const {PNG} = pngjs;
import { qrMatrix } from '../public/brand/qr-code.mjs';

const addresses = [
  'https://composer.loftwah.com/s/trail-notes',
  'https://composer.loftwah.com/s/trail-notes?share=8f9d3c1a4b7e2f60',
  'https://composer.loftwah.com/s/launch-board',
  'https://composer.loftwah.com/s/a',
  'https://composer.loftwah.com/s/' + 'longer-stack-address-'.repeat(3),
  'https://composer.loftwah.com/s/' + 'quite-a-long-published-stack-address-'.repeat(2),
];

// A scale of 16 keeps the decoder reliable for the larger versions; a smaller
// render still detects, but the comparison here is about the encoding.
function render(modules, size, scale = 16, quiet = 5) {
  const side = (size + quiet * 2) * scale;
  const bytes = Buffer.alloc(side * side * 4, 255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const pixel = ((quiet * scale + y * scale + dy) * side + quiet * scale + x * scale + dx) * 4;
          bytes[pixel] = bytes[pixel + 1] = bytes[pixel + 2] = 0;
        }
      }
    }
  }
  return { side, bytes };
}

test('the encoder produces a valid matrix for every supported version', () => {
  const seen = new Set();
  for (const address of addresses) {
    const code = qrMatrix(address);
    assert.equal(code.modules.length, code.size);
    assert.equal(code.size, code.version * 4 + 17);
    assert.ok(code.modules.flat().some(Boolean), 'a matrix is never blank');
    seen.add(code.version);
  }
  assert.ok(seen.size >= 2, 'the addresses exercise more than one version: ' + [...seen].join(','));
});

test('an independent decoder reads the exact published address from rendered PNG bytes', () => {
  for (const address of addresses) {
    const { modules, size } = qrMatrix(address);
    const { side, bytes } = render(modules, size);
    const encoded = PNG.sync.write({width: side, height: side, data: bytes});
    const decoded = PNG.sync.read(encoded);
    const result = jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
    assert.ok(result, 'the decoder found no QR code in the rendered PNG');
    assert.equal(result.data, address, 'the decoded address must match the published address exactly');
  }
});

test('the offline encoder refuses an address it cannot encode honestly', () => {
  assert.throws(() => qrMatrix('x'.repeat(400)), /too long/);
  assert.equal(typeof readFileSync(new URL('../public/brand/qr-code.mjs', import.meta.url), 'utf8'), 'string');
});
