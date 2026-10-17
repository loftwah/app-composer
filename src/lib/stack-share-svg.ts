import { themeTokens } from './stack-theme.mjs';
import { qrMatrix } from './qr-code.ts';
import { STACK_CARD_WIDTH, STACK_CARD_HEIGHT } from './stack-sharing.ts';
import type { PublishedStackShare, StackShareDetails } from './stack-sharing.ts';

type Measure = (text: string, size: number, weight: number) => number;

const escapeXml = (value: string): string => value.replace(/[<>&"']/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
})[character]!);

// The width comes from the actual bundled face, not a character-count guess.
// Breaking oversized words also keeps unspaced titles inside the card.
export function wrapCardText(text: string, size: number, weight: number, width: number, count: number, measure: Measure): string[] {
  const glyphs = Array.from(text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' '));
  const lines: string[] = [];
  while (glyphs.length && lines.length < count) {
    let fit = 0;
    let high = glyphs.length;
    // Bounded binary search avoids constructing a font renderer per character.
    while (fit < high) {
      const middle = Math.ceil((fit + high) / 2);
      if (measure(glyphs.slice(0, middle).join(''), size, weight) <= width) fit = middle;
      else high = middle - 1;
    }
    if (!fit) fit = 1;
    const rest = fit < glyphs.length;
    const lastSpace = glyphs.slice(0, fit).lastIndexOf(' ');
    const split = rest && lastSpace > 0 ? lastSpace : fit;
    let line = glyphs.splice(0, split).join('').trim();
    while (glyphs[0] === ' ') glyphs.shift();
    if (lines.length === count - 1 && glyphs.length) {
      while (line && measure(`${line}…`, size, weight) > width) line = Array.from(line).slice(0, -1).join('').trimEnd();
      line += '…';
    }
    lines.push(line);
  }
  return lines;
}

function textLines(lines: string[], x: number, y: number, size: number, leading: number, fill: string, weight = 400): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? leading : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`;
}

function qrSvg(url: string, x: number, y: number, side: number): string {
  const matrix = qrMatrix(url);
  const quiet = 4;
  const unit = Math.floor(side / (matrix.size + quiet * 2));
  const size = unit * (matrix.size + quiet * 2);
  const originX = x + Math.floor((side - size) / 2);
  const originY = y + Math.floor((side - size) / 2);
  const modules: string[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.modules[row][column]) modules.push(`M${originX + (column + quiet) * unit} ${originY + (row + quiet) * unit}h${unit}v${unit}h-${unit}z`);
    }
  }
  return `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="8" fill="#fff"/><path fill="#17181b" d="${modules.join('')}"/>`;
}

export function stackShareSvg(stack: PublishedStackShare, share: StackShareDetails, measure: Measure, brandImage: string): string {
  const theme = themeTokens(stack.theme);
  const title = wrapCardText(share.title, 70, 600, 760, 2, measure);
  const description = wrapCardText(share.description, 31, 400, 760, 2, measure);
  const apps = wrapCardText(share.apps.length ? share.apps.join(' · ') : 'No visible apps yet', 26, 500, 1056, 1, measure);
  const address = wrapCardText(share.url.replace('https://', ''), 24, 400, 1056, 1, measure);
  const descriptionY = title.length > 1 ? 382 : 304;
  // The renderer supplies the fixed bundled Composer PNG as a data URI. Stack
  // documents cannot select an image or make the card fetch an external asset.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${STACK_CARD_WIDTH}" height="${STACK_CARD_HEIGHT}" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${theme.background}"/>
<image x="72" y="108" width="48" height="48" href="${escapeXml(brandImage)}"/>
<g font-family="Space Grotesk">
${textLines(['App Composer'], 154, 144, 30, 0, theme.foreground, 500)}
${textLines(title, 72, 244, 70, 78, theme.foreground, 600)}
${textLines(description, 72, descriptionY, 31, 42, theme.muted)}
${qrSvg(share.url, 910, 200, 218)}
<path d="M72 464h1056" stroke="${theme.accent}" stroke-width="2"/>
${textLines(apps, 72, 510, 26, 0, theme.accent, 500)}
${textLines(address, 72, 570, 24, 0, theme.muted)}
</g>
</svg>`;
}
