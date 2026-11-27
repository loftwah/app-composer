import { paintSpinPhoto, spinPhoto } from './spin-art.mjs';

export const turn = 2 * Math.PI;
export const winnerAngle = (winner, count) => -winner * turn / count;
export const spinDuration = 1510;

const ink = '#302019';
const paper = '#fff4df';
const gold = '#ffc34c';
const red = '#f2573a';
const sectors = [
  [gold, ink], ['#206750', paper], [red, ink],
  ['#b6cfdb', ink], [paper, ink], ['#eb9e7a', ink],
];

const wrap = angle => ((angle % turn) + turn) % turn;
const teeth = count => Math.max(18, count);

export function spinDistance(start, target, direction = 1) {
  return direction * (4 * turn + wrap((target - start) * direction));
}

export function spinAngleAt(start, distance, progress) {
  return start + distance * (1 - (1 - progress) ** 3.5);
}

export function spinDetent(angle, count) {
  return Math.floor(angle / turn * teeth(count));
}

function disc(context, x, y, radius, fill, stroke, width = 1) {
  context.beginPath();
  context.arc(x, y, radius, 0, turn);
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.stroke();
  }
}

function shortLabel(context, label, width) {
  if (context.measureText(label).width <= width) return label;
  const glyphs = Array.from(label);
  while (glyphs.length > 1 && context.measureText(glyphs.join('') + '…').width > width) glyphs.pop();
  return glyphs.join('') + '…';
}

function paintSectorPhoto(context, photo, radius, first, last) {
  const corners = [first, last];
  for (let cardinal = 0; cardinal < turn; cardinal += Math.PI / 2) {
    if (wrap(cardinal - first) < last - first) corners.push(cardinal);
  }
  const xs = corners.map(angle => Math.cos(angle) * radius);
  const ys = corners.map(angle => Math.sin(angle) * radius);
  const x = Math.min(0, ...xs);
  const y = Math.min(0, ...ys);
  const width = Math.max(0, ...xs) - x;
  const height = Math.max(0, ...ys) - y;
  context.save();
  context.clip();
  paintSpinPhoto(context, photo, x, y, width, height);
  context.restore();
}

function paintPointer(context, bend) {
  context.save();
  context.translate(0, -266);
  context.rotate(bend);
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(-27, 0);
  context.lineTo(27, 0);
  context.lineTo(23, 22);
  context.lineTo(0, 58);
  context.lineTo(-23, 22);
  context.closePath();
  context.fillStyle = red;
  context.fill();
  context.strokeStyle = ink;
  context.lineWidth = 6;
  context.stroke();
  disc(context, 0, 10, 5, ink);
  context.restore();
}

export function paintSpinWheel(context, labels, angle = 0, { winner = -1, bend = 0, shade = true } = {}) {
  if (!context) return;
  const choices = labels.length > 1 ? labels : ['Add choices', 'Make a wheel'];
  const count = choices.length;
  const spacing = turn / count;
  const radius = 222;
  const pegs = teeth(count);
  const scale = context.canvas.width / 560;
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.save();
  context.scale(scale, scale);
  context.translate(280, 280);

  disc(context, 0, 9, 252, '#281813');
  disc(context, 0, 0, 252, ink, '#ad7860', 3);
  disc(context, 0, 0, 243, '#6f3a29', '#af7255', 3);
  for (let index = 0; index < pegs; index++) {
    const bearing = angle - Math.PI / 2 + index * turn / pegs;
    const major = index % 3 === 0;
    disc(context, Math.cos(bearing) * 235, Math.sin(bearing) * 235, major ? 4.4 : 2.6, major ? gold : '#dba484');
  }

  const labelSize = count < 5 ? 31 : count < 13 ? 23 : count < 29 ? 18 : 13;
  for (const [index, label] of choices.entries()) {
    const bearing = angle - Math.PI / 2 + index * spacing;
    const first = bearing - spacing / 2;
    const last = bearing + spacing / 2;
    const [surface, text] = sectors[index % sectors.length];
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, first, last);
    context.closePath();
    context.fillStyle = surface;
    context.fill();
    const photo = count <= 6 ? spinPhoto(label) : null;
    if (photo) paintSectorPhoto(context, photo, radius, first, last);
    context.lineWidth = 2.8;
    context.strokeStyle = ink;
    context.stroke();

    if (shade && winner >= 0 && index !== winner) {
      context.fillStyle = 'rgba(39,24,17,.35)';
      context.fill();
    }
    if (index === winner) {
      context.beginPath();
      context.arc(0, 0, radius - 8, first + spacing * .07, last - spacing * .07);
      context.strokeStyle = surface === paper ? '#a13f29' : paper;
      context.lineWidth = 7;
      context.lineCap = 'round';
      context.stroke();
      context.lineCap = 'butt';
    }

    // Paint labels after the dividers and avoid crowded body text on large wheels.
    const labelRadius = count < 5 ? 145 : count > 12 ? 184 : 161;
    context.save();
    context.translate(Math.cos(bearing) * labelRadius, Math.sin(bearing) * labelRadius);
    if (count > 6 && count <= 12) context.rotate(Math.cos(bearing) < 0 ? bearing + Math.PI : bearing);
    context.fillStyle = text;
    context.font = `750 ${labelSize}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    if (photo) {
      const maxWidth = count < 5 ? 174 : 106;
      context.font = `800 ${count < 5 ? 22 : 18}px system-ui, sans-serif`;
      const short = shortLabel(context, label, maxWidth);
      const pill = context.measureText(short).width + 20;
      context.fillStyle = paper;
      context.beginPath();
      if (context.roundRect) context.roundRect(-pill / 2, -16, pill, 32, 7);
      else context.rect(-pill / 2, -16, pill, 32);
      context.fill();
      context.fillStyle = ink;
      context.fillText(short, 0, 0);
      context.restore();
      continue;
    }
    if (count > 12) {
      context.fillText(String(index + 1), 0, 0);
    } else {
      const maxWidth = count < 5 ? 158 : count <= 6 ? 126 : 111;
      const breakAt = label.lastIndexOf(' ');
      if (count < 5 && breakAt > 0 && context.measureText(label).width > maxWidth) {
        context.fillText(shortLabel(context, label.slice(0, breakAt), maxWidth), 0, -labelSize * .52);
        context.fillText(shortLabel(context, label.slice(breakAt + 1), maxWidth), 0, labelSize * .52);
      } else {
        context.fillText(shortLabel(context, label, maxWidth), 0, 0);
      }
    }
    context.restore();
  }

  disc(context, 0, 3, 56, '#291912');
  disc(context, 0, 0, 53, ink, paper, 3);
  disc(context, 0, 0, 40, '#9e3023', '#dc7152', 2);
  context.save();
  context.rotate(angle);
  context.fillStyle = gold;
  context.beginPath();
  context.moveTo(-24, -8);
  context.lineTo(4, -8);
  context.lineTo(4, -18);
  context.lineTo(25, 0);
  context.lineTo(4, 18);
  context.lineTo(4, 8);
  context.lineTo(-24, 8);
  context.closePath();
  context.fill();
  context.restore();
  paintPointer(context, bend);
  context.restore();
}
