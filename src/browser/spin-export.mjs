import { loadWinnerArtwork } from './spin-winner-art.mjs';

const palette = { background: '#211521', paper: '#fff0d7', coral: '#ff946b', muted: '#dbc2d5' };
const sizes = {
  square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 630],
};
const turn = Math.PI * 2;
export const winnerAngle = (winner, count) => -winner * turn / count;
const types = ['video/mp4;codecs=avc1.420034', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp8', 'video/webm'];

export function replayVideoType() {
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function' || typeof MediaRecorder === 'undefined') return '';
  return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image export is unavailable.');
  return context;
}

function label(context, value, x, y, width, size, weight, colour) {
  context.font = `${weight} ${size}px system-ui`;
  context.fillStyle = colour;
  const letters = Array.from(value);
  const count = letters.length;
  while (letters.length > 1 && context.measureText(letters.join('') + (letters.length < count ? '…' : '')).width > width) {
    letters.pop();
  }
  const short = letters.join('');
  context.fillText(short === value ? short : short + '…', x, y);
}

function composition(target, wheel, session, link, style, frame, artwork, composer) {
  const { width, height } = target.canvas;
  const wide = style === 'landscape';
  const story = style === 'story';
  const maxText = wide ? 565 : width - 110;
  const x = wide ? 60 : width / 2;
  const size = wide ? 490 : story ? 720 : style === 'portrait' ? 650 : 500;
  const wheelX = wide ? width - size - 35 : (width - size) / 2;
  const wheelY = wide ? (height - size) / 2 : story ? 440 : Math.round(height * .20);
  const winner = session.config.entries[session.winner];
  target.fillStyle = palette.background;
  target.fillRect(0, 0, width, height);
  target.fillStyle = palette.coral;
  target.fillRect(0, 0, width, wide ? 7 : 12);
  target.textAlign = wide ? 'left' : 'center';
  const brandY = wide ? 105 : story ? 215 : 92;
  if (composer) target.drawImage(composer, wide ? x : x - 174, brandY - 28, 30, 30);
  label(target, 'APP COMPOSER SPIN', x + (composer ? (wide ? 43 : 16) : 0), brandY, maxText, 30, 750, palette.coral);
  label(target, session.config.question, x, wide ? 170 : story ? 320 : 164, maxText, wide ? 34 : 48, 650, palette.paper);
  target.drawImage(wheel, wheelX, wheelY, size, size);
  if (artwork && !frame.title) {
    const radius = size * .11;
    const x = wheelX + size / 2;
    const y = wheelY + size / 2;
    target.save();
    target.beginPath();
    target.arc(x, y, radius, 0, turn);
    target.clip();
    target.drawImage(artwork, x - radius, y - radius, radius * 2, radius * 2);
    target.restore();
  }
  target.beginPath();
  target.moveTo(wheelX + size / 2 - size * .027, wheelY + size * .01);
  target.lineTo(wheelX + size / 2 + size * .027, wheelY + size * .01);
  target.lineTo(wheelX + size / 2, wheelY + size * .067);
  target.closePath();
  target.fillStyle = palette.paper;
  target.fill();
  const resultY = wide ? 305 : wheelY + size + (story ? 140 : 96);
  label(target, frame.title ?? winner + ' wins!', x, resultY, maxText, wide ? 55 : story ? 78 : 65, 800, palette.paper);
  const score = session.config.entries.length <= 5
    ? session.config.entries.map((entry, index) => ({ entry, score: session.totals[index] }))
      .sort((left, right) => right.score - left.score).slice(0, 2).map(({entry, score}) => `${entry} ${score}`).join(' · ')
    : `${session.totals[session.winner]} wins across ${session.rounds.length} spins`;
  label(target, frame.note ?? `Best of ${session.config.bestOf} · ${score}`, x, resultY + (story ? 89 : 62), maxText, wide ? 22 : 30, 600, palette.muted);
  label(target, 'Replay & verify', x, height - (story ? 190 : 106), maxText, 25, 700, palette.coral);
  label(target, link, x, height - (story ? 145 : 65), maxText, wide ? 15 : 22, 500, palette.paper);
}

async function loadComposerMark() {
  const logo = new Image();
  logo.src = '/brand/composer-icon-20261022b-96.png';
  try { await logo.decode(); } catch { return null; }
  return logo;
}

export async function renderSpinPng(session, link, style, paintWheel) {
  const output = makeCanvas(...sizes[style]);
  const wheel = makeCanvas(560, 560);
  paintWheel(session.config.entries, winnerAngle(session.winner, session.config.entries.length), wheel);
  const [artwork, composer] = await Promise.all([
    loadWinnerArtwork(session.config.entries[session.winner]), loadComposerMark(),
  ]);
  composition(output, wheel.canvas, session, link, style, {}, artwork, composer);
  const blob = await new Promise(resolve => output.canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Image export did not finish.');
  return blob;
}

export async function renderSpinVideo(session, link, paintWheel, reduced) {
  const mimeType = replayVideoType();
  if (!mimeType) throw new Error('This browser cannot record replay video. Try the story PNG.');
  if (document.hidden) throw new Error('Keep Spin visible while exporting the replay.');
  const output = makeCanvas(...sizes.story);
  const wheel = makeCanvas(560, 560);
  const [artwork, composer] = await Promise.all([
    loadWinnerArtwork(session.config.entries[session.winner]), loadComposerMark(),
  ]);
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
      timer = setTimeout(() => reject(new Error('Keep Spin visible while exporting the replay.')), duration + 3500);
      function draw(now) {
        const elapsed = Math.max(0, now - startedAt);
        let angle = 0;
        let frame = {};
        if (elapsed < introMs) {
          frame = { title: 'The replay', note: `Best of ${session.config.bestOf} · Recorded rounds` };
        } else if (elapsed < end) {
          const index = Math.floor((elapsed - introMs) / roundMs);
          const round = rounds[index];
          const start = index ? winnerAngle(rounds[index - 1].winner, length) : 0;
          const final = winnerAngle(round.winner, length);
          const progress = Math.min(1, (elapsed - introMs - index * roundMs) / (roundMs * .72));
          const distance = (final - start + 3 * turn) % turn + 2 * turn;
          angle = reduced ? final : start + distance * (1 - (1 - progress) ** 3);
          frame = {
            title: `Round ${round.index + 1}`,
            note: progress === 1 || reduced ? session.config.entries[round.winner] : 'Wheel spinning',
          };
        } else angle = winnerAngle(session.winner, length);
        paintWheel(session.config.entries, angle, wheel);
        composition(output, wheel.canvas, session, link, 'story', frame, artwork, composer);
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
