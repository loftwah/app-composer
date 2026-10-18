// MIT. Browser verification using the caller's existing Playwright page.
// No font parser, browser runner, download or deployed dependency is added.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const printableLatin = Array.from({ length: 95 }, (_, index) => String.fromCodePoint(index + 32)).join('');

// FontFace loading/check() alone can succeed when every Latin letter falls back.
// Compare actual glyph pixels AND advance widths under three fallback families.
// Indistinguishable fallback renders cannot establish this proof and are refused.
export async function verifyFontGlyphs(page, fontPath, characters = printableLatin) {
  const bytes = readFileSync(fontPath);
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw Error('Select one reviewed font of at most 2 MiB.');
  const glyphs = [...new Set(Array.from(characters))];
  if (!glyphs.length || glyphs.length > 256 || glyphs.some(value => value.codePointAt(0) < 32)) {
    throw Error('Select between 1 and 256 printable required glyphs.');
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const proof = await page.evaluate(async ({ bytes, glyphs, family }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw Error('Canvas rendering is unavailable.');
    const fallbacks = ['monospace', 'serif', 'sans-serif'];
    const render = (character, font) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = `64px ${font}`;
      context.textBaseline = 'alphabetic';
      context.fillStyle = '#000';
      const width = context.measureText(character).width;
      if (width > canvas.width - 32) throw Error('Required glyph exceeds the bounded proof canvas.');
      context.fillText(character, 16, 88);
      return { width, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const equal = (left, right) => Math.abs(left.width - right.width) < 0.0001
      && left.pixels.every((value, index) => value === right.pixels[index]);
    const uncalibrated = glyphs.filter(character => {
      const renders = fallbacks.map(fallback => render(character, fallback));
      return renders.every(value => equal(value, renders[0]));
    });
    if (uncalibrated.length) return { checked: glyphs.length, fallbackDependent: [], uncalibrated };
    const face = new FontFace(family, new Uint8Array(bytes));
    await face.load();
    document.fonts.add(face);
    try {
      const fallbackDependent = glyphs.filter(character => {
        const renders = fallbacks.map(fallback => render(character, `"${family}", ${fallback}`));
        return renders.some(value => !equal(value, renders[0]));
      });
      return { checked: glyphs.length, fallbackDependent, uncalibrated: [] };
    } finally {
      document.fonts.delete(face);
    }
  }, { bytes: Array.from(bytes), glyphs, family: 'ComposerProof_' + sha256.slice(0, 16) });
  const report = { fontPath, sha256, bytes: bytes.length, ...proof };
  if (proof.uncalibrated.length || proof.fallbackDependent.length) {
    const failure = Error(proof.uncalibrated.length
      ? 'Fallback families cannot distinguish every selected glyph on this browser.'
      : `Font relies on fallback for ${proof.fallbackDependent.length} required glyphs.`);
    failure.report = report;
    throw failure;
  }
  return report;
}
