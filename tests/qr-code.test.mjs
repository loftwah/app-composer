// Encoding is only useful if a real scanner reads it back. This suite renders
// the encoder's own module matrix to a PGM through the same matrix the share
// controls use, then decodes that image with an independent decoder. If no
// decoder is available the decode assertions are skipped and reported, never
// silently passed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { qrMatrix } from '../public/brand/qr-code.mjs';

const addresses = [
  'https://composer.loftwah.com/s/trail-notes',
  'https://composer.loftwah.com/s/trail-notes?share=8f9d3c1a4b7e2f60',
  'https://composer.loftwah.com/s/launch-board',
  'https://composer.loftwah.com/s/a',
  'https://composer.loftwah.com/s/' + 'longer-stack-address-'.repeat(3),
  'https://composer.loftwah.com/s/' + 'quite-a-long-published-stack-address-'.repeat(2),
];

const probe = String.raw`
import sys, json, cv2
image = cv2.imread(sys.argv[1], cv2.IMREAD_GRAYSCALE)
value, points, _ = cv2.QRCodeDetector().detectAndDecode(image)
print(json.dumps({"value": value, "found": points is not None}))
`;

function decoder() {
  const candidates = [
    process.env.QR_DECODER_PYTHON,
    '/private/var/folders/qm/ltm8shgs7tv9k8qfqgfpjxq80000gn/T/qrverify-venv/bin/python',
    'python3',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-c', 'import cv2'], { stdio: 'ignore' });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

// A scale of 16 keeps the decoder reliable for the larger versions; a smaller
// render still detects, but the comparison here is about the encoding.
function render(modules, size, scale = 16, quiet = 5) {
  const side = (size + quiet * 2) * scale;
  const bytes = Buffer.alloc(side * side, 255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          bytes[(quiet * scale + y * scale + dy) * side + quiet * scale + x * scale + dx] = 0;
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

test('a real decoder reads back the exact published address from a rendered image', t => {
  const python = decoder();
  if (!python) {
    t.skip('no independent QR decoder is installed in this environment');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'composer-qr-'));
  try {
    for (const address of addresses) {
      const { modules, size } = qrMatrix(address);
      const { side, bytes } = render(modules, size);
      const path = join(dir, 'code.pgm');
      writeFileSync(path, Buffer.concat([Buffer.from('P5\n' + side + ' ' + side + '\n255\n', 'latin1'), bytes]));
      const result = JSON.parse(execFileSync(python, ['-c', probe, path], { encoding: 'utf8' }).trim());
      assert.equal(result.found, true, 'the decoder found no QR code in the rendered matrix');
      assert.equal(result.value, address, 'the decoded address must match the published address exactly');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the offline encoder refuses an address it cannot encode honestly', () => {
  assert.throws(() => qrMatrix('x'.repeat(400)), /too long/);
  assert.equal(typeof readFileSync(new URL('../public/brand/qr-code.mjs', import.meta.url), 'utf8'), 'string');
});
