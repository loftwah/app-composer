import { spinModeLabel } from '../lib/spin-protocol.mjs';
import { spinBrandFiles, spinImageFormats } from '../lib/spin-site.mjs';
import { qrMatrix } from '../lib/qr-code.ts';
import { loadSpinPhotos, paintSpinPhoto, spinPhoto } from './spin-art.mjs';
import { spinClick, spinChime } from './spin-audio.mjs';
import { paintSpinWheel, spinAngleAt, spinDetent, spinDistance, spinDuration, winnerAngle } from './spin-wheel.mjs';

const palette = { orange: '#ff5e00', ink: '#1d1c25', lilac: '#ddd1ff' };
const sizes = Object.fromEntries(spinImageFormats.map(({ id, width, height }) => [id, [width, height]]));
const layouts = {
  landscape: { x: 48, brand: 83, question: 131, textWidth: 473, tally: 389, art: [558, 0, 642, 630], footer: 465, title: 111 },
  square: { x: 62, brand: 86, question: 117, textWidth: 956, tally: 328, art: [0, 348, 1080, 496], footer: 877, title: 145 },
  portrait: { x: 64, brand: 105, question: 156, textWidth: 952, tally: 378, art: [0, 405, 1080, 675], footer: 1138, title: 165 },
  story: { x: 72, brand: 269, question: 325, textWidth: 936, tally: 577, art: [0, 603, 1080, 763], footer: 1427, title: 176 },
};
const types = ['video/mp4;codecs=avc1.420034', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp8', 'video/webm'];
const soundTypes = ['video/mp4;codecs=avc1.420034,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp8,opus'];

export function replayVideoType(withSound = false) {
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function' || typeof MediaRecorder === 'undefined') return '';
  return (withSound ? soundTypes : types).find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image export is unavailable.');
  return context;
}

function line(context, value, x, y, width, size, weight, colour) {
  context.font = `${weight} ${size}px Space, sans-serif`;
  context.fillStyle = colour;
  context.fillText(value, x, y, width);
}

function wrapLines(context, value, width) {
  const lines = [];
  let part = '';
  for (const glyph of value) {
    if (part && context.measureText(part + glyph).width > width) {
      const space = part.lastIndexOf(' ');
      if (space > 0) {
        lines.push(part.slice(0, space));
        part = part.slice(space + 1);
      } else {
        lines.push(part);
        part = '';
      }
    }
    if (part || glyph !== ' ') part += glyph;
  }
  if (part) lines.push(part.trimEnd());
  return lines;
}

function fitBlock(target, value, x, y, width, height, maxSize, weight, colour) {
  let size = maxSize;
  let lines;
  let leading;
  do {
    target.font = `${weight} ${size}px Space, sans-serif`;
    leading = Math.round(size * 1.04);
    lines = wrapLines(target, value, width);
    if (lines.length * leading <= height || size <= 16) break;
    size -= 2;
  } while (true);
  target.textBaseline = 'top';
  lines.forEach((text, index) => line(target, text, x, y + index * leading, width, size, weight, colour));
  target.textBaseline = 'alphabetic';
  return lines.length * leading;
}

function replayQr(url) {
  const qr = qrMatrix(url);
  const scale = 4;
  const quiet = 4;
  const modules = qr.size + quiet * 2;
  const size = modules * scale;
  const target = makeCanvas(size, size);
  target.fillStyle = '#fff';
  target.fillRect(0, 0, size, size);
  target.fillStyle = palette.ink;
  qr.modules.forEach((row, rowIndex) => row.forEach((dark, colIndex) => {
    if (dark) target.fillRect((colIndex + quiet) * scale, (rowIndex + quiet) * scale, scale, scale);
  }));
  return { canvas: target.canvas, modules };
}

function paintResultArt(target, wheel, photo, art, wide) {
  const [artX, artY, artWidth, artHeight] = art;
  const centerX = artX + artWidth / 2;
  const centerY = artY + artHeight / 2;
  target.beginPath();
  target.moveTo(artX, artY + artHeight * .24);
  target.lineTo(artX + artWidth, artY);
  target.lineTo(artX + artWidth, artY + artHeight * .76);
  target.lineTo(artX, artY + artHeight);
  target.closePath();
  target.fillStyle = palette.orange;
  target.fill();

  const dial = Math.min(artWidth * .85, artHeight * .92);
  if (photo) {
    target.save();
    target.shadowColor = 'rgba(61, 23, 19, .35)';
    target.shadowBlur = 28;
    target.shadowOffsetY = 16;
    const photoWidth = artWidth * (wide ? .86 : .76);
    const photoHeight = artHeight * .84;
    paintSpinPhoto(target, photo, centerX - photoWidth / 2, centerY - photoHeight / 2, photoWidth, photoHeight);
    target.restore();
    const smallDial = Math.round(dial * .27);
    target.drawImage(wheel, artX + artWidth - (wide ? 28 : 64) - smallDial, artY + artHeight * .80 - smallDial / 2,
      smallDial, smallDial);
  } else {
    target.drawImage(wheel, centerX - dial / 2, centerY - dial / 2, dial, dial);
  }
}

function composition(target, wheel, session, qr, style, frame, mark) {
  const { width, height } = target.canvas;
  const { x, brand, question, textWidth, tally, art, footer, title } = layouts[style];
  const wide = style === 'landscape';
  const winner = session.config.entries[session.winner];
  const wins = session.totals[session.winner];
  const spins = session.rounds.length;
  const summary = session.config.bestOf === 1 ? 'Won in one spin' :
    `${spinModeLabel(session.config.bestOf)} · ${spins} ${spins === 1 ? 'spin' : 'spins'}` + (winner ? ` · ${wins} ${wins === 1 ? 'win' : 'wins'}` : '');

  target.fillStyle = palette.lilac;
  target.fillRect(0, 0, width, height);
  target.textAlign = 'left';
  if (mark) target.drawImage(mark, x, brand - 47, 58, 58);
  const wordmarkX = x + (mark ? 72 : 0);
  line(target, 'Spin', wordmarkX, brand, 132, 60, 700, palette.ink);
  const attributionX = wordmarkX + target.measureText('Spin').width + 14;
  line(target, 'by App Composer', attributionX, brand - 3, 280, 30, 650, palette.ink);

  const questionHeight = fitBlock(target, session.config.question, x, question, textWidth,
    wide ? 72 : 61, wide ? 35 : 42, 650, palette.ink);
  const headlineTop = question + questionHeight + (wide ? 16 : 13);
  fitBlock(target, frame.title ?? winner ?? 'It’s a tie', x, headlineTop, textWidth,
    tally - headlineTop - 45, title, 700, palette.ink);
  line(target, frame.note ?? summary, x, tally, textWidth, wide ? 27 : 34, 700, palette.ink);

  paintResultArt(target, wheel, frame.title ? null : spinPhoto(winner), art, wide);

  // Keep each QR module an integer number of pixels in the exported PNG.
  const qrSize = qr.modules * Math.floor((wide ? 126 : 152) / qr.modules);
  const qrX = x + textWidth - qrSize;
  target.fillStyle = palette.ink;
  target.fillRect(x, footer - 18, textWidth, wide ? 3 : 4);
  const replayWidth = qrX - x - 18;
  line(target, 'See the spin', x, footer + (wide ? 45 : 58), replayWidth, wide ? 36 : 47, 700, palette.ink);
  line(target, 'spin.loftwah.com', x, footer + (wide ? 76 : 99), replayWidth, wide ? 26 : 34, 600, palette.ink);
  target.imageSmoothingEnabled = false;
  target.drawImage(qr.canvas, qrX, footer, qrSize, qrSize);
  target.imageSmoothingEnabled = true;
}

async function loadSpinMark() {
  const logo = new Image();
  logo.src = spinBrandFiles.mark;
  try { await logo.decode(); } catch { return null; }
  return logo;
}

export async function renderSpinPoster(session, link, style) {
  let mark;
  const assets = Promise.allSettled([
    loadSpinMark().then(logo => { mark = logo; }),
    document.fonts.load('650 38px Space'),
    loadSpinPhotos([session.config.entries[session.winner]]),
  ]);
  // A slow optional asset can fall back to the wheel, text or system font.
  let timeout;
  await Promise.race([assets, new Promise(resolve => { timeout = setTimeout(resolve, 350); })]);
  clearTimeout(timeout);

  const output = makeCanvas(...sizes[style]);
  const wheel = makeCanvas(560, 560);
  const settled = session.winner < 0 ? session.rounds.at(-1).winner : session.winner;
  paintSpinWheel(wheel, session.config.entries, winnerAngle(settled, session.config.entries.length), { winner: session.winner });
  const qr = replayQr(link);
  composition(output, wheel.canvas, session, qr, style, {}, mark);
  return output.canvas;
}

export async function encodeSpinPng(canvas) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Image export did not finish.');
  return blob;
}

export async function renderSpinVideo(session, link, reduced, audio) {
  const audioType = audio ? replayVideoType(true) : '';
  const mimeType = audioType || replayVideoType();
  if (!mimeType) throw new Error('This browser can’t make a video. Try saving the story image.');
  if (document.hidden) throw new Error('Keep this tab open while Spin makes the video.');
  const output = makeCanvas(...sizes.story);
  const wheel = makeCanvas(560, 560);
  const [mark] = await Promise.all([loadSpinMark(), document.fonts.ready, loadSpinPhotos(session.config.entries)]);
  const qr = replayQr(link);
  const rounds = session.rounds.slice(-3);
  const length = session.config.entries.length;
  const introMs = 1250;
  const roundMs = spinDuration + 510;
  const holdMs = 2100;
  const end = introMs + rounds.length * roundMs;
  const duration = end + holdMs;
  const chunks = [];
  const stream = output.canvas.captureStream(30);
  let recorder;
  let frameId;
  let timer;
  try {
    const destination = audioType && audio.state === 'running' ? audio.createMediaStreamDestination() : null;
    if (destination) stream.addTrack(destination.stream.getAudioTracks()[0]);
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_200_000 });
    const stopped = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = resolve;
      recorder.onerror = () => reject(new Error('Video recording stopped early. Try the story PNG.'));
    });
    // Listen while drawing so a recorder error ends the export immediately.
    recorder.start();
    const drawing = new Promise((resolve, reject) => {
      const startedAt = performance.now();
      let lastTick = -Infinity;
      let lastTooth = -Infinity;
      let lastKnock = -Infinity;
      let announced = false;
      timer = setTimeout(() => reject(new Error('Keep this tab open while Spin makes the video.')), duration + 3500);
      function draw(now) {
        const elapsed = Math.max(0, now - startedAt);
        let angle = 0;
        let frame = {};
        let winner = -1;
        let bend = 0;
        if (elapsed < introMs) {
          frame = { title: 'Watch the spin', note: session.config.bestOf === 1 ? 'Single spin' : `${spinModeLabel(session.config.bestOf)} · Recorded rounds` };
        } else if (elapsed < end) {
          const index = Math.floor((elapsed - introMs) / roundMs);
          const round = rounds[index];
          const start = index ? winnerAngle(rounds[index - 1].winner, length) : 0;
          const final = winnerAngle(round.winner, length);
          const progress = reduced ? 1 : Math.min(1, (elapsed - introMs - index * roundMs) / spinDuration);
          angle = progress === 1 ? final : spinAngleAt(start, spinDistance(start, final), progress);
          const tooth = spinDetent(angle, length);
          if (progress < 1 && tooth !== lastTooth) {
            lastTooth = tooth;
            lastKnock = elapsed;
            if (destination && elapsed - lastTick >= 43) {
              spinClick(audio, destination, .54 + .46 * progress);
              lastTick = elapsed;
            }
          }
          if (progress === 1) winner = round.winner;
          else bend = -.23 * Math.max(0, 1 - (elapsed - lastKnock) / 76);
          frame = {
            title: progress === 1 ? session.config.entries[winner] : `Round ${round.index + 1}`,
            note: progress === 1 ? `Round ${round.index + 1} result` : 'Wheel spinning',
          };
        } else {
          angle = winnerAngle(session.winner < 0 ? session.rounds.at(-1).winner : session.winner, length);
          winner = session.winner;
          if (destination && !announced) spinChime(audio, destination);
          announced = true;
        }
        paintSpinWheel(wheel, session.config.entries, angle, { winner, bend });
        composition(output, wheel.canvas, session, qr, 'story', frame, mark);
        if (elapsed < duration) frameId = requestAnimationFrame(draw);
        else resolve();
      }
      frameId = requestAnimationFrame(draw);
    });
    await Promise.race([drawing, stopped]);
    if (recorder.state === 'recording') recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: recorder.mimeType });
    if (!blob.size) throw new Error('Video recording came back empty. Try the story PNG.');
    return { blob, extension: recorder.mimeType.includes('mp4') ? 'mp4' : 'webm' };
  } finally {
    clearTimeout(timer);
    cancelAnimationFrame(frameId);
    if (recorder?.state === 'recording') recorder.stop();
    for (const track of stream.getTracks()) track.stop();
  }
}
