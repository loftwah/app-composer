import { spinModeLabel } from '../lib/spin-protocol.mjs';
import { spinBrandFiles } from '../lib/spin-site.mjs';
import { qrMatrix } from '../lib/qr-code.ts';
import { spinClick, spinChime } from './spin-audio.mjs';

const palette = { blue: '#2821b1', ink: '#161349', paper: '#fffaf0', acid: '#edff40', pink: '#ff6fbc' };
const sizes = {
  square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 630],
};
const turn = Math.PI * 2;
export const winnerAngle = (winner, count) => -winner * turn / count;
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

function wrapped(context, value, x, y, width, size, weight, colour) {
  context.font = `${weight} ${size}px Space, sans-serif`;
  const letters = Array.from(value);
  const lines = [];
  let part = '';
  while (letters.length) {
    const next = letters.shift();
    if (part && context.measureText(part + next).width > width) {
      const space = part.lastIndexOf(' ');
      if (space > 0) {
        letters.unshift(...part.slice(space + 1), next);
        part = part.slice(0, space);
      } else letters.unshift(next);
      lines.push(part.trim());
      part = '';
    } else part += next;
  }
  if (part) lines.push(part.trim());
  if (lines.length > 2) return wrapped(context, value, x, y, width, size - 3, weight, colour);
  lines.forEach((text, index) => line(context, text, x, y + index * (size + 5), width, size, weight, colour));
}

function drawQr(target, qr, x, y) {
  const scale = 3;
  const quiet = 4;
  const size = (qr.size + quiet * 2) * scale;
  target.fillStyle = '#fff';
  target.fillRect(x, y, size, size);
  target.fillStyle = palette.ink;
  qr.modules.forEach((row, rowIndex) => row.forEach((dark, colIndex) => {
    if (dark) target.fillRect(x + (colIndex + quiet) * scale, y + (rowIndex + quiet) * scale, scale, scale);
  }));
  return size;
}

function composition(target, wheel, session, qr, style, frame, mark) {
  const { width, height } = target.canvas;
  const wide = style === 'landscape';
  const story = style === 'story';
  const square = style === 'square';
  const x = 56;
  const textWidth = wide ? 570 : width - 2 * x;
  const wheelSize = wide ? 460 : story ? 650 : square ? 425 : 570;
  const wheelX = wide ? 695 : (width - wheelSize) / 2;
  const wheelY = wide ? 78 : story ? 450 : square ? 250 : 278;
  const brandY = story ? 254 : 82;
  const resultY = wide ? 282 : wheelY + wheelSize + 15;
  const resultHeight = wide ? 178 : story ? 255 : 215;
  const footerY = resultY + resultHeight + 22;
  const winner = session.config.entries[session.winner];
  target.fillStyle = palette.blue;
  target.fillRect(0, 0, width, height);
  target.textAlign = 'left';
  if (mark) target.drawImage(mark, x, brandY - 42, 51, 51);
  const wordmarkX = x + (mark ? 65 : 0);
  line(target, 'Spin.', wordmarkX, brandY, 150, 57, 700, palette.paper);
  const attributionX = wordmarkX + target.measureText('Spin.').width + 15;
  line(target, 'by App Composer', attributionX, brandY, 300, 25, 650, palette.paper);
  wrapped(target, session.config.question, x, brandY + (story ? 95 : 78), textWidth, wide ? 42 : 49, 700, palette.paper);

  target.drawImage(wheel, wheelX, wheelY, wheelSize, wheelSize);
  target.beginPath();
  target.moveTo(wheelX + wheelSize * .463, wheelY + wheelSize * .013);
  target.lineTo(wheelX + wheelSize * .537, wheelY + wheelSize * .013);
  target.lineTo(wheelX + wheelSize * .5, wheelY + wheelSize * .091);
  target.closePath();
  target.fillStyle = palette.pink;
  target.fill();

  target.fillStyle = palette.acid;
  target.fillRect(x, resultY, textWidth, resultHeight);
  const spins = session.rounds.length;
  const mode = spinModeLabel(session.config.bestOf);
  const count = `${spins} ${spins === 1 ? 'spin' : 'spins'}`;
  const wins = session.totals[session.winner];
  const summary = session.config.bestOf === 1 ? mode :
    `${mode} · ${count}` + (winner ? ` · ${wins} ${wins === 1 ? 'win' : 'wins'}` : '');
  line(target, frame.note ?? summary, x + 26, resultY + 39, textWidth - 52, wide ? 22 : 28, 700, palette.ink);
  wrapped(target, frame.title ?? (winner ? winner + ' wins!' : 'It ended in a tie.'), x + 26, resultY + (wide ? 100 : 111),
    textWidth - 52, wide ? 48 : story ? 72 : 62, 700, palette.ink);

  const qrSize = drawQr(target, qr, x, footerY);
  line(target, 'Replay the draw', x + qrSize + 20, footerY + 47, textWidth - qrSize - 20, wide ? 24 : 31, 700, palette.paper);
  line(target, 'spin.loftwah.com', x + qrSize + 20, footerY + 79, textWidth - qrSize - 20, wide ? 20 : 24, 500, palette.paper);
}

async function loadSpinMark() {
  const logo = new Image();
  logo.src = spinBrandFiles.mark;
  try { await logo.decode(); } catch { return null; }
  return logo;
}

export async function renderSpinPng(session, link, style, paintWheel) {
  const output = makeCanvas(...sizes[style]);
  const wheel = makeCanvas(560, 560);
  paintWheel(session.config.entries, winnerAngle(session.winner < 0 ? session.rounds.at(-1).winner : session.winner, session.config.entries.length), wheel);
  const [mark] = await Promise.all([loadSpinMark(), document.fonts.ready]);
  const qr = qrMatrix(link);
  composition(output, wheel.canvas, session, qr, style, {}, mark);
  const blob = await new Promise(resolve => output.canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Image export did not finish.');
  return blob;
}

export async function renderSpinVideo(session, link, paintWheel, reduced, audio) {
  const audioType = audio ? replayVideoType(true) : '';
  const mimeType = audioType || replayVideoType();
  if (!mimeType) throw new Error('This browser cannot record replay video. Try the story PNG.');
  if (document.hidden) throw new Error('Keep Spin visible while exporting the replay.');
  const output = makeCanvas(...sizes.story);
  const wheel = makeCanvas(560, 560);
  const [mark] = await Promise.all([loadSpinMark(), document.fonts.ready]);
  const qr = qrMatrix(link);
  const rounds = session.rounds.slice(-3);
  const length = session.config.entries.length;
  const introMs = 1550;
  const roundMs = 1250;
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
      let lastSegment = -1;
      let announced = false;
      timer = setTimeout(() => reject(new Error('Keep Spin visible while exporting the replay.')), duration + 3500);
      function draw(now) {
        const elapsed = Math.max(0, now - startedAt);
        let angle = 0;
        let frame = {};
        if (elapsed < introMs) {
          frame = { title: 'The replay', note: session.config.bestOf === 1 ? 'Single recorded spin' : `${spinModeLabel(session.config.bestOf)} · Recorded rounds` };
        } else if (elapsed < end) {
          const index = Math.floor((elapsed - introMs) / roundMs);
          const round = rounds[index];
          const start = index ? winnerAngle(rounds[index - 1].winner, length) : 0;
          const final = winnerAngle(round.winner, length);
          const progress = Math.min(1, (elapsed - introMs - index * roundMs) / (roundMs * .72));
          const distance = (final - start + 3 * turn) % turn + 2 * turn;
          angle = reduced ? final : start + distance * (1 - (1 - progress) ** 3);
          const segment = Math.floor(angle / turn * length + .5);
          if (destination && progress < 1 && !reduced && segment !== lastSegment && elapsed - lastTick >= 45) {
            spinClick(audio, destination);
            lastTick = elapsed;
            lastSegment = segment;
          }
          frame = {
            title: `Round ${round.index + 1}`,
            note: progress === 1 || reduced ? session.config.entries[round.winner] : 'Wheel spinning',
          };
        } else {
          angle = winnerAngle(session.winner < 0 ? session.rounds.at(-1).winner : session.winner, length);
          if (destination && !announced) spinChime(audio, destination);
          announced = true;
        }
        paintWheel(session.config.entries, angle, wheel);
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
