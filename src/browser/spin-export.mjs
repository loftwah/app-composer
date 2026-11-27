import { openSpinMode, spinModeLabel } from '../lib/spin-protocol.mjs';
import { spinBrandFiles } from '../lib/spin-site.mjs';
import { loadWinnerArtwork } from './spin-winner-art.mjs';
import { spinClick, spinChime } from './spin-audio.mjs';

const palette = { background: '#17181b', paper: '#faf9f7', orange: '#fc5b05', muted: '#d4ceca' };
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

function composition(target, wheel, session, link, style, frame, artwork, mark) {
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
  target.fillStyle = palette.orange;
  target.fillRect(0, 0, width, wide ? 7 : 12);
  const brandY = wide ? 105 : story ? 215 : 92;
  const brand = 'SPIN BY APP COMPOSER';
  target.font = '750 30px system-ui';
  const brandWidth = target.measureText(brand).width + (mark ? 42 : 0);
  const brandX = wide ? x : (width - brandWidth) / 2;
  target.textAlign = 'left';
  if (mark) target.drawImage(mark, brandX, brandY - 26, 30, 30);
  label(target, brand, brandX + (mark ? 42 : 0), brandY, maxText, 30, 750, palette.orange);
  target.textAlign = wide ? 'left' : 'center';
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
  target.fillStyle = palette.orange;
  target.fill();
  const resultY = wide ? 305 : wheelY + size + (story ? 140 : 96);
  label(target, frame.title ?? (winner ? winner + ' wins!' : 'Session ended in a tie'), x, resultY, maxText, wide ? 55 : story ? 78 : 65, 800, palette.paper);
  const wins = session.totals[session.winner];
  const spins = session.rounds.length;
  const score = session.config.entries.length <= 5
    ? session.config.entries.map((entry, index) => ({ entry, score: session.totals[index] }))
      .sort((left, right) => right.score - left.score).slice(0, 2).map(({entry, score}) => `${entry} ${score}`).join(' · ')
    : `${wins} ${wins === 1 ? 'win' : 'wins'} across ${spins} ${spins === 1 ? 'spin' : 'spins'}`;
  const mode = spinModeLabel(session.config.bestOf);
  const count = `${spins} ${spins === 1 ? 'spin' : 'spins'}`;
  const details = session.config.bestOf === openSpinMode ? `${mode} · ${count}` : session.config.bestOf === 1 ? mode : `${mode} · ${score}`;
  label(target, frame.note ?? details, x, resultY + (story ? 89 : 62), maxText, wide ? 22 : 30, 600, palette.muted);
  label(target, 'Replay & verify', x, height - (story ? 190 : 106), maxText, 25, 700, palette.orange);
  label(target, link, x, height - (story ? 145 : 65), maxText, wide ? 15 : 22, 500, palette.paper);
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
  const [artwork, mark] = await Promise.all([
    loadWinnerArtwork(session.config.entries[session.winner]), loadSpinMark(),
  ]);
  composition(output, wheel.canvas, session, link, style, {}, artwork, mark);
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
  const [artwork, mark] = await Promise.all([
    loadWinnerArtwork(session.config.entries[session.winner]), loadSpinMark(),
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
        composition(output, wheel.canvas, session, link, 'story', frame, artwork, mark);
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
