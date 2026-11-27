import { spinModeLabel } from '../lib/spin-protocol.mjs';
import { spinBrandFiles, spinImageFormats } from '../lib/spin-site.mjs';
import { qrMatrix } from '../lib/qr-code.ts';
import { loadSpinPhotos, paintSpinPhoto, spinPhoto } from './spin-art.mjs';
import { spinClick, spinChime } from './spin-audio.mjs';
import { paintSpinWheel, spinAngleAt, spinDetent, spinDistance, spinDuration, spinSectorColours, winnerAngle } from './spin-wheel.mjs';

const palette = { orange: '#ff691f', ink: '#1d1c25', paper: '#fbfafe' };
const sizes = Object.fromEntries(spinImageFormats.map(({ id, width, height }) => [id, [width, height]]));
const layouts = {
  landscape: { x: 42, top: 76, textWidth: 482, art: [559, 0, 641, 630], footer: 475, title: 94 },
  square: { x: 54, top: 100, textWidth: 972, art: [54, 345, 972, 505], footer: 904, title: 122 },
  portrait: { x: 54, top: 116, textWidth: 972, art: [54, 394, 972, 703], footer: 1157, title: 137 },
  story: { x: 64, top: 270, textWidth: 952, art: [64, 571, 952, 806], footer: 1468, title: 137 },
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
  const offset = Math.max(0, Math.floor((height - lines.length * leading) / 2));
  lines.forEach((text, index) => line(target, text, x, y + offset + index * leading, width, size, weight, colour));
  target.textBaseline = 'alphabetic';
}

function replayQr(url) {
  const qr = qrMatrix(url);
  const scale = 4;
  const quiet = 4;
  const size = (qr.size + quiet * 2) * scale;
  const target = makeCanvas(size, size);
  target.fillStyle = '#fff';
  target.fillRect(0, 0, size, size);
  target.fillStyle = palette.ink;
  qr.modules.forEach((row, rowIndex) => row.forEach((dark, colIndex) => {
    if (dark) target.fillRect((colIndex + quiet) * scale, (rowIndex + quiet) * scale, scale, scale);
  }));
  return target.canvas;
}

function composition(target, wheel, session, qr, style, frame, mark) {
  const { width, height } = target.canvas;
  const { x, top, textWidth, art, footer, title } = layouts[style];
  const [artX, artY, artWidth, artHeight] = art;
  const wide = style === 'landscape';
  const winner = session.config.entries[session.winner];
  const photo = frame.title ? null : spinPhoto(winner);
  const wins = session.totals[session.winner];
  const spins = session.rounds.length;
  const summary = session.config.bestOf === 1 ? 'One spin' :
    `${spinModeLabel(session.config.bestOf)} · ${spins} ${spins === 1 ? 'spin' : 'spins'}` + (winner ? ` · ${wins} ${wins === 1 ? 'win' : 'wins'}` : '');

  const colour = spinSectorColours[session.winner % spinSectorColours.length] ?? spinSectorColours[2];

  target.fillStyle = palette.paper;
  target.fillRect(0, 0, width, height);
  target.fillStyle = palette.orange;
  target.fillRect(0, 0, width, wide ? 9 : 13);
  target.textAlign = 'left';
  if (mark) target.drawImage(mark, x, top - 38, 46, 46);
  const wordmarkX = x + (mark ? 55 : 0);
  line(target, 'Spin.', wordmarkX, top, 152, 51, 750, palette.ink);
  const attributionX = wordmarkX + target.measureText('Spin.').width + 13;
  line(target, 'by App Composer', attributionX, top - 3, 215, 22, 600, palette.ink);

  const questionTop = top + (wide ? 36 : 30);
  const headlineTop = questionTop + (wide ? 87 : 61);
  const baseline = wide ? 422 : artY - 27;
  fitBlock(target, session.config.question, x, questionTop, textWidth, wide ? 80 : 56, wide ? 33 : 38, 650, '#4e495d');
  fitBlock(target, frame.title ?? winner ?? 'It’s a tie', x, headlineTop, textWidth,
    baseline - headlineTop - 20, title, 750, palette.ink);
  line(target, frame.note ?? summary, x, baseline, textWidth, wide ? 25 : 30, 650, '#4e495d');

  target.save();
  target.beginPath();
  if (target.roundRect) target.roundRect(artX, artY, artWidth, artHeight, wide ? 0 : 26);
  else target.rect(artX, artY, artWidth, artHeight);
  target.clip();
  target.fillStyle = colour;
  target.fillRect(artX, artY, artWidth, artHeight);
  const centerX = artX + artWidth * .5;
  const centerY = artY + artHeight * .51;
  target.lineWidth = 2;
  target.strokeStyle = 'rgba(29, 28, 37, .22)';
  const radius = Math.min(artWidth, artHeight) * .42;
  for (let index = 0; index < 5; index++) {
    target.beginPath();
    target.ellipse(centerX, centerY, radius + index * 39, radius * .76 + index * 38, -.51, 0, 2 * Math.PI);
    target.stroke();
  }
  if (photo) {
    const pad = artHeight * .07;
    target.shadowColor = 'rgba(32, 23, 46, .25)';
    target.shadowBlur = 24;
    target.shadowOffsetY = 15;
    paintSpinPhoto(target, photo, artX + pad, artY + pad * .7, artWidth - 2 * pad, artHeight - pad * 1.55);
    target.shadowColor = 'transparent';
  } else {
    const dial = Math.min(artWidth * .93, artHeight * .98);
    target.drawImage(wheel, centerX - dial / 2, centerY - dial / 2, dial, dial);
  }
  target.restore();

  const qrSize = Math.min(qr.width, wide ? 116 : 134);
  const textX = x + qrSize + (wide ? 15 : 23);
  target.strokeStyle = '#bdb8ca';
  target.lineWidth = 1.5;
  target.beginPath();
  target.moveTo(x, footer - 19);
  target.lineTo(x + textWidth, footer - 19);
  target.stroke();
  target.imageSmoothingEnabled = false;
  target.drawImage(qr, x, footer, qrSize, qrSize);
  target.imageSmoothingEnabled = true;
  line(target, 'See the spin', textX, footer + 51, textWidth - qrSize - 23, wide ? 27 : 37, 700, palette.ink);
  line(target, 'spin.loftwah.com', textX, footer + 81, textWidth - qrSize - 23, wide ? 20 : 24, 550, '#514b60');
  if (photo) target.drawImage(wheel, x + textWidth - qrSize, footer, qrSize, qrSize);
}

async function loadSpinMark() {
  const logo = new Image();
  logo.src = spinBrandFiles.mark;
  try { await logo.decode(); } catch { return null; }
  return logo;
}

export async function renderSpinPng(session, link, style) {
  const output = makeCanvas(...sizes[style]);
  const wheel = makeCanvas(560, 560);
  const settled = session.winner < 0 ? session.rounds.at(-1).winner : session.winner;
  const [mark] = await Promise.all([loadSpinMark(), document.fonts.ready, loadSpinPhotos(session.config.entries)]);
  paintSpinWheel(wheel, session.config.entries, winnerAngle(settled, session.config.entries.length), { winner: session.winner });
  const qr = replayQr(link);
  composition(output, wheel.canvas, session, qr, style, {}, mark);
  const blob = await new Promise(resolve => output.canvas.toBlob(resolve, 'image/png'));
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
