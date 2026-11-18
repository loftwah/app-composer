import { copyTutorialPrompt } from '../lib/tutorial-copy';

type Point = { x: number; y: number };

function rgb(image: ImageData, point: Point) {
  const offset = 4 * (point.y * image.width + point.x);
  return [...image.data.subarray(offset, offset + 3)];
}

function hex(image: ImageData, point: Point) {
  return '#' + rgb(image, point).map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Rank occupied colour bins, then spread the picks across distinct colours.
// Each marker retains the location of an actual pixel in the preview.
function initialPoints(image: ImageData): Point[] {
  const bins = new Map<number, { count: number; point: Point; values: number[] }>();
  const step = Math.max(1, Math.floor(Math.max(image.width, image.height) / 90));
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const values = rgb(image, { x, y });
      const key = (values[0] >> 5) * 64 + (values[1] >> 5) * 8 + (values[2] >> 5);
      const bin = bins.get(key);
      if (bin) bin.count++;
      else bins.set(key, { count: 1, point: { x, y }, values });
    }
  }
  const candidates = [...bins.values()].sort((a, b) => b.count - a.count);
  const chosen = [candidates.shift()!];
  while (chosen.length < 5 && candidates.length) {
    let best = 0;
    let bestScore = -1;
    candidates.forEach((bin, index) => {
      const distance = Math.min(...chosen.map(other =>
        bin.values.reduce((sum, value, k) => sum + (value - other.values[k]) ** 2, 0)));
      const score = distance * Math.sqrt(bin.count);
      if (score > bestScore) { best = index; bestScore = score; }
    });
    chosen.push(candidates.splice(best, 1)[0]);
  }
  return Array.from({length: 5}, (_, index) => ({...chosen[index % chosen.length].point}));
}

function download(file: Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function swatchSheet(title: string, source: string, colours: string[]) {
  const sheet = document.createElement('canvas');
  sheet.width = 1440;
  sheet.height = 900;
  const ctx = sheet.getContext('2d')!;
  ctx.fillStyle = '#f6f2e9';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = '#24221f';
  ctx.font = '600 28px system-ui';
  ctx.fillText('App Composer Share  /  Colour study', 64, 82);
  ctx.font = '600 72px Space, system-ui';
  ctx.fillText(title, 60, 189, 1312);
  colours.forEach((colour, i) => {
    const x = 64 + i * 264;
    ctx.fillStyle = colour;
    ctx.fillRect(x, 250, 254, 425);
    ctx.fillStyle = '#24221f';
    ctx.font = '500 31px monospace';
    ctx.fillText(colour, x, 735);
  });
  ctx.font = '400 22px system-ui';
  ctx.fillText(source.replace('https://', ''), 64, 842, 1312);
  return sheet;
}

export async function startColourStudy(desk: HTMLElement) {
  const canvas = desk.querySelector<HTMLCanvasElement>('[data-picker]')!;
  const status = desk.querySelector<HTMLElement>('[data-status]')!;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const photo = new Image();
  photo.src = desk.dataset.preview!;
  try {
    await photo.decode();
    if (!ctx) throw Error('No canvas');
  } catch {
    status.textContent = 'The colour picker could not load this preview. Reload the page to try again.';
    return;
  }
  const scale = Math.min(1, 960 / Math.max(photo.naturalWidth, photo.naturalHeight));
  canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const points = initialPoints(image);
  const buttons = [...desk.querySelectorAll<HTMLButtonElement>('[data-swatch]')];
  const brief = desk.querySelector<HTMLTextAreaElement>('[data-brief]')!;
  const goal = desk.querySelector<HTMLInputElement>('[data-goal]')!;
  const copyStatus = desk.querySelector<HTMLElement>('[data-copy-status]')!;
  const source = desk.dataset.source!;
  const colours = () => points.map(point => hex(image, point));
  let active = 0;

  function updateBrief() {
    const project = goal.value.trim() || 'a new project using this palette';
    brief.value = 'Make ' + project + '.\n\nUse these five sampled colours as the starting palette: ' + colours().join(', ') +
      '.\nColour reference: ' + source +
      '\n\nChoose tools appropriate to the deliverable. Use original imagery or assets cleared for reuse. Check that text and controls are readable on the chosen backgrounds. Show the finished result at its intended size and include the editable source.';
    copyStatus.textContent = '';
  }

  function render() {
    ctx!.putImageData(image, 0, 0);
    const radius = Math.max(5, Math.min(image.width, image.height) * .018);
    // Draw the active marker last so it stays visible over coincident samples.
    for (const index of [...points.keys()].filter(i => i !== active).concat(active)) {
      const point = points[index];
      const colour = hex(image, point);
      const button = buttons[index];
      button.setAttribute('aria-pressed', String(index === active));
      button.setAttribute('aria-label', 'Swatch ' + (index + 1) + ', ' + colour);
      button.querySelector<HTMLElement>('.chip')!.style.backgroundColor = colour;
      button.querySelector('.hex')!.textContent = colour;
      ctx!.beginPath();
      ctx!.arc(point.x, point.y, index === active ? radius * 1.35 : radius, 0, 2 * Math.PI);
      ctx!.strokeStyle = '#181818';
      ctx!.lineWidth = radius * .48;
      ctx!.stroke();
      ctx!.strokeStyle = '#fff';
      ctx!.lineWidth = radius * .22;
      ctx!.stroke();
    }
    updateBrief();
  }

  const clamp = (value: number, max: number) => Math.max(0, Math.min(max - 1, Math.round(value)));
  function pick(x: number, y: number) {
    points[active] = { x: clamp(x, image.width), y: clamp(y, image.height) };
    render();
    status.textContent = 'Swatch ' + (active + 1) + ' · ' + hex(image, points[active]);
  }
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    active = index;
    render();
    status.textContent = 'Swatch ' + (active + 1) + ' selected. Choose a point on the artwork.';
  }));
  canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    pick((event.clientX - rect.left) * image.width / rect.width, (event.clientY - rect.top) * image.height / rect.height);
  });
  canvas.addEventListener('keydown', event => {
    const moves: Record<string, [number, number]> = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    pick(points[active].x + step * move[0], points[active].y + step * move[1]);
  });
  goal.addEventListener('input', updateBrief);
  desk.querySelector('[data-copy]')!.addEventListener('click', async () => {
    const outcome = await copyTutorialPrompt(brief.value, navigator.clipboard && (value => navigator.clipboard.writeText(value)));
    if (outcome === 'copied') copyStatus.textContent = 'Brief copied.';
    else { brief.focus(); brief.select(); copyStatus.textContent = 'Copy the selected brief.'; }
  });
  desk.querySelector('[data-css]')!.addEventListener('click', () => {
    const css = '/* Colour study from ' + source + ' */\n:root {\n' +
      colours().map((colour, i) => '  --swatch-' + (i + 1) + ': ' + colour + ';').join('\n') + '\n}\n';
    download(new Blob([css], {type: 'text/css'}), desk.dataset.id + '-palette.css');
  });
  desk.querySelector('[data-png]')!.addEventListener('click', () => {
    swatchSheet(desk.dataset.title!, source, colours()).toBlob(blob => {
      if (blob) download(blob, desk.dataset.id + '-palette.png');
      else status.textContent = 'The sheet could not be saved. Try again.';
    }, 'image/png');
  });
  canvas.hidden = false;
  desk.querySelector<HTMLElement>('[data-poster]')!.hidden = true;
  desk.querySelector<HTMLElement>('[data-controls]')!.hidden = false;
  status.textContent = 'Five colours sampled from the artwork.';
  render();
}
