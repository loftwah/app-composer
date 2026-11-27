import { spinModeLabel } from '../lib/spin-protocol.mjs';
import { spinBrandFiles, spinImageFormats } from '../lib/spin-site.mjs';
import { qrMatrix } from '../lib/qr-code.ts';
import { spinClick, spinChime } from './spin-audio.mjs';
import { paintSpinWheel, spinAngleAt, spinDetent, spinDistance, spinDuration, winnerAngle } from './spin-wheel.mjs';

const palette = { blue: '#2821b1', ink: '#161349', paper: '#fffaf0', acid: '#edff40' };
const sizes = Object.fromEntries(spinImageFormats.map(({ id, width, height }) => [id, [width, height]]));
const layouts = {
  landscape: { x: 44, brand: 83, ticket: 124, ticketWidth: 535, ticketHeight: 308, dial: [614, 37, 542], footer: 465, title: 84 },
  square: { x: 55, brand: 99, ticket: 132, ticketWidth: 970, ticketHeight: 228, dial: [282, 367, 516], footer: 911, title: 112 },
  portrait: { x: 55, brand: 115, ticket: 154, ticketWidth: 970, ticketHeight: 275, dial: [216, 444, 648], footer: 1156, title: 124 },
  story: { x: 62, brand: 265, ticket: 311, ticketWidth: 956, ticketHeight: 302, dial: [174, 646, 732], footer: 1456, title: 126 },
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
  const { x, brand, ticket, ticketWidth, ticketHeight, dial, footer, title } = layouts[style];
  const wide = style === 'landscape';
  const wideDial = dial[2];
  const winner = session.config.entries[session.winner];
  const wins = session.totals[session.winner];
  const mode = spinModeLabel(session.config.bestOf);
  const spins = session.rounds.length;
  const count = `${spins} ${spins === 1 ? 'spin' : 'spins'}`;
  const summary = session.config.bestOf === 1
    ? mode
    : `${mode} · ${count}` + (winner ? ` · ${wins} ${wins === 1 ? 'win' : 'wins'}` : '');

  target.fillStyle = palette.blue;
  target.fillRect(0, 0, width, height);
  target.textAlign = 'left';
  if (mark) target.drawImage(mark, x, brand - 44, 53, 53);
  const wordmarkX = x + (mark ? 68 : 0);
  line(target, 'Spin.', wordmarkX, brand, 160, 59, 700, palette.paper);
  const attributionX = wordmarkX + target.measureText('Spin.').width + 16;
  line(target, 'by App Composer', attributionX, brand, 350, 24, 600, palette.paper);

  target.fillStyle = palette.acid;
  target.beginPath();
  if (target.roundRect) target.roundRect(x, ticket, ticketWidth, ticketHeight, wide ? 13 : 20);
  else target.rect(x, ticket, ticketWidth, ticketHeight);
  target.fill();
  const innerX = x + (wide ? 22 : 30);
  const innerWidth = ticketWidth - (wide ? 44 : 60);
  const divider = ticket + ticketHeight - (wide ? 54 : 62);
  target.strokeStyle = '#777d27';
  target.lineWidth = 1.5;
  target.setLineDash([6, 7]);
  target.beginPath();
  target.moveTo(innerX, divider);
  target.lineTo(innerX + innerWidth, divider);
  target.stroke();
  target.setLineDash([]);
  target.fillStyle = palette.blue;
  for (const edge of [x, x + ticketWidth]) {
    target.beginPath();
    target.arc(edge, divider, wide ? 8 : 11, 0, 2 * Math.PI);
    target.fill();
  }
  const questionHeight = wide ? 78 : 65;
  fitBlock(target, session.config.question, innerX, ticket + 11, innerWidth, questionHeight, wide ? 32 : 40, 650, palette.ink);
  const headlineTop = ticket + questionHeight + 12;
  fitBlock(target, frame.title ?? winner ?? 'It’s a tie', innerX, headlineTop, innerWidth, divider - headlineTop - 6, title, 700, palette.ink);
  line(target, frame.note ?? summary, innerX, divider + (wide ? 35 : 40), innerWidth, wide ? 24 : 31, 700, palette.ink);

  target.drawImage(wheel, dial[0], dial[1], wideDial, wideDial);

  const qrSize = Math.min(qr.width, wide ? 126 : 144);
  const textX = x + qrSize + (wide ? 17 : 23);
  target.imageSmoothingEnabled = false;
  target.drawImage(qr, x, footer, qrSize, qrSize);
  target.imageSmoothingEnabled = true;
  line(target, 'See the spin', textX, footer + 53, ticketWidth - qrSize - 17, wide ? 27 : 38, 700, palette.paper);
  line(target, 'spin.loftwah.com', textX, footer + 84, ticketWidth - qrSize - 17, wide ? 20 : 25, 500, palette.paper);
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
  paintSpinWheel(wheel, session.config.entries, winnerAngle(settled, session.config.entries.length), { winner: session.winner });
  const [mark] = await Promise.all([loadSpinMark(), document.fonts.ready]);
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
  const [mark] = await Promise.all([loadSpinMark(), document.fonts.ready]);
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
