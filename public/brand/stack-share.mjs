// Deliberate, stack-specific sharing for a published page. The card is drawn
// from the published snapshot the page already rendered — never from a draft —
// and the QR code encodes the exact canonical address. Both are produced in the
// browser, so the address never leaves it to make an image.
//
// Fonts and any images are awaited before drawing, so an export cannot capture
// a fallback face or a half-loaded mark.
import { currentShareURL } from './page-share-url.mjs';
import { qrMatrix } from './qr-code.mjs';

const CARD = { width: 1200, height: 630 };

function read(element) {
  const source = element.querySelector('script[data-stack-share-data]')?.textContent ?? element.getAttribute('data-stack-share') ?? '';
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

function wrap(context, text, font, maxWidth, maxLines) {
  context.font = font;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (context.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const remainder = words.slice(lines.join(' ').split(/\s+/).length);
    if (remainder.length) {
      let last = lines[maxLines - 1];
      while (context.measureText(last + ' …').width > maxWidth && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
      lines[maxLines - 1] = last + ' …';
    }
  }
  return lines;
}

// The product mark, drawn rather than fetched, so a missing asset can never
// produce a blank tile. It is the same two-module glyph the site header uses.
function drawMark(context, x, y, size, accent, background) {
  context.save();
  context.fillStyle = accent;
  const radius = size * 0.22;
  context.beginPath();
  context.roundRect(x, y, size, size, radius);
  context.fill();
  context.fillStyle = background;
  const pad = size * 0.24;
  const unit = (size - pad * 2) / 2;
  const gap = unit * 0.16;
  context.fillRect(x + pad, y + pad, unit - gap, unit - gap);
  context.fillRect(x + pad + unit, y + pad + unit, unit - gap, unit - gap);
  context.fillRect(x + pad, y + pad + unit, unit - gap, unit - gap);
  context.fillStyle = accent;
  context.fillRect(x + pad + unit, y + pad, unit - gap, unit - gap);
  context.restore();
}

function drawQr(context, matrix, x, y, size, dark, light) {
  const quiet = 3;
  const total = matrix.size + quiet * 2;
  const unit = size / total;
  context.save();
  context.fillStyle = light;
  context.fillRect(x, y, size, size);
  context.fillStyle = dark;
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!matrix.modules[row][column]) continue;
      context.fillRect(
        x + (column + quiet) * unit,
        y + (row + quiet) * unit,
        Math.ceil(unit),
        Math.ceil(unit),
      );
    }
  }
  context.restore();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(Error('The image could not be produced.'))), 'image/png');
  });
}

export async function stackShareArtifacts(element) {
  const data = read(element);
  if (!data || !data.url) throw Error('This page has no published stack to share yet.');
  if (document.fonts?.ready) await document.fonts.ready;
  const theme = data.theme ?? { background: '#17181b', foreground: '#f2f3f5', muted: '#a7abb3', accent: '#ff9b55' };

  let shareUrl = data.url;
  try {
    shareUrl = await currentShareURL(data.url, data.title, data.description ?? '', '');
  } catch {
    shareUrl = data.url;
  }
  // The card and the QR both name the clean published address; a scan or a read
  // of the card should show the address a person can type. The revisioned share
  // URL is only used for the copy/share metadata identity.
  const url = data.url;

  const card = document.createElement('canvas');
  card.width = CARD.width;
  card.height = CARD.height;
  const context = card.getContext('2d');
  context.fillStyle = theme.background;
  context.fillRect(0, 0, CARD.width, CARD.height);
  context.fillStyle = theme.foreground;
  drawMark(context, 72, 64, 64, theme.accent, theme.background);
  context.font = '600 30px Space, system-ui, sans-serif';
  context.fillText('App Composer', 156, 108);

  context.fillStyle = theme.foreground;
  const titleLines = wrap(context, data.title, '500 68px Space, system-ui, sans-serif', CARD.width - 460, 2);
  let y = 236;
  for (const line of titleLines) {
    context.fillText(line, 72, y);
    y += 78;
  }
  if (data.description) {
    context.fillStyle = theme.muted;
    for (const line of wrap(context, data.description, '400 32px Space, system-ui, sans-serif', CARD.width - 460, 2)) {
      context.fillText(line, 72, y + 6);
      y += 42;
    }
  }
  if (Array.isArray(data.apps) && data.apps.length) {
    context.fillStyle = theme.accent;
    context.font = '600 28px Space, system-ui, sans-serif';
    context.fillText(data.apps.slice(0, 4).join('  ·  '), 72, CARD.height - 118);
  }
  context.fillStyle = theme.muted;
  context.font = '400 24px Space, system-ui, sans-serif';
  context.fillText(url, 72, CARD.height - 66);

  // A scanner reads dark modules on a light plate most reliably, so the card's
  // code keeps that contrast regardless of the stack's own theme.
  drawQr(context, qrMatrix(url), CARD.width - 292, 150, 220, '#17181b', '#ffffff');

  const qr = document.createElement('canvas');
  qr.width = 640;
  qr.height = 640;
  const qrContext = qr.getContext('2d');
  qrContext.fillStyle = '#ffffff';
  qrContext.fillRect(0, 0, 640, 640);
  drawQr(qrContext, qrMatrix(url), 32, 32, 576, '#17181b', '#ffffff');

  return { url, shareUrl, card: await canvasToBlob(card), qr: await canvasToBlob(qr), title: data.title, slug: data.slug };
}

function save(blob, filename) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}

for (const element of document.querySelectorAll('[data-stack-share]')) {
  const status = element.querySelector('[data-stack-share-status]');
  const cardButton = element.querySelector('[data-stack-card]');
  const qrButton = element.querySelector('[data-stack-qr]');
  const nativeButton = element.querySelector('[data-stack-native]');
  const fallback = element.querySelector('[data-stack-share-fallback]');
  const data = read(element);
  if (!data) continue;
  element.hidden = false;
  let cached;
  let failure;

  // Produced once per page and reused, so a click never redraws and a failure is
  // reported instead of leaving a control that looks like it worked.
  const artefacts = async () => {
    if (cached) return cached;
    if (failure) throw failure;
    try {
      cached = await stackShareArtifacts(element);
      for (const button of [cardButton, qrButton, nativeButton]) if (button) button.disabled = false;
      if (fallback) fallback.querySelector('input').value = cached.shareUrl;
      return cached;
    } catch (error) {
      failure = error;
      if (status) status.textContent = error instanceof Error ? error.message : 'The share images could not be produced.';
      throw error;
    }
  };

  const use = work => void artefacts().then(work).catch(() => undefined);

  cardButton?.addEventListener('click', () => use(async built => {
    save(built.card, `${data.slug}-share-card-1200x630.png`);
    if (status) status.textContent = `Saved the 1200 × 630 card for published revision ${data.revision}.`;
  }));

  qrButton?.addEventListener('click', () => use(async built => {
    save(built.qr, `${data.slug}-qr-code.png`);
    if (status) status.textContent = 'Saved the QR code. It decodes to the same published address as the link above.';
  }));

  if (typeof navigator.canShare === 'function' && nativeButton) {
    nativeButton.hidden = false;
    nativeButton.addEventListener('click', () => use(async built => {
      const file = new File([built.card], `${data.slug}-share-card.png`, { type: 'image/png' });
      if (!navigator.canShare({ files: [file] })) {
        if (status) status.textContent = 'This browser cannot attach the card; use Download share card instead.';
        return;
      }
      try {
        await navigator.share({ title: built.title, text: data.description ?? '', url: built.shareUrl, files: [file] });
        if (status) status.textContent = 'Shared.';
      } catch (error) {
        if (status && error?.name !== 'AbortError') status.textContent = 'Sharing was cancelled or unavailable. Download the card instead.';
      }
    }));
  }

  // Prepare the artefacts as soon as the page is idle, so the first click is
  // instant; a missing font or a failure surfaces in the status region.
  const start = () => void artefacts().catch(() => undefined);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
