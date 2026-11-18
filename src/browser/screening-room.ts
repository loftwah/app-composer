import {initialEdition, screeningFilms, type Edition, type FilmId} from '../lib/screening-films';
import printCss from '../styles/screening-print.css?inline';

const print = document.querySelector<HTMLElement>('#screening-print')!;
const player = print.querySelector('video')!;
const title = document.querySelector<HTMLInputElement>('#room-title')!;
const note = document.querySelector<HTMLTextAreaElement>('#room-note')!;
const save = document.querySelector<HTMLButtonElement>('#room-save')!;
const file = document.querySelector<HTMLInputElement>('#room-file')!;
const status = document.querySelector<HTMLElement>('#room-status')!;
let edition = initialEdition(document.querySelector<HTMLInputElement>('input[name=room-film]:checked')!.value as FilmId);

function draw(next: Edition) {
  const film = screeningFilms[next.film];
  if (next.film !== edition.film) {
    player.pause();
    player.poster = film.poster;
    player.src = film.video;
    player.querySelector('track')!.src = film.captions;
    player.setAttribute('aria-label', film.name);
    print.querySelector('[data-duration]')!.textContent = film.duration + ' · ' + film.kind;
    const credit = print.querySelector<HTMLAnchorElement>('.credit a')!;
    credit.href = film.source;
    credit.textContent = film.name;
    print.querySelector('.credit span')!.textContent = film.credit;
    print.querySelector('details p')!.textContent = film.transcript;
  }
  edition = next;
  print.dataset.treatment = next.treatment;
  print.querySelector('.screen-title')!.textContent = next.title.trim() || film.name;
  print.querySelector('.screen-note')!.textContent = next.note;
}

function fill(next: Edition) {
  title.value = next.title;
  note.value = next.note;
  document.querySelector<HTMLInputElement>('input[name=room-film][value=' + next.film + ']')!.checked = true;
  document.querySelector<HTMLInputElement>('input[name=room-ink][value=' + next.treatment + ']')!.checked = true;
  draw(next);
}

title.addEventListener('input', () => draw({...edition, title: title.value}));
note.addEventListener('input', () => draw({...edition, note: note.value}));
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name=room-film]')) {
  radio.addEventListener('change', () => {
    const defaults = initialEdition(radio.value as FilmId);
    const previous = initialEdition(edition.film);
    fill({...defaults, treatment: edition.treatment,
      title: edition.title === previous.title ? defaults.title : edition.title,
      note: edition.note === previous.note ? defaults.note : edition.note});
  });
}
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name=room-ink]')) {
  radio.addEventListener('change', () => draw({...edition, treatment: radio.value as Edition['treatment']}));
}

async function embed(path: string, type: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith(type)) throw new Error('Asset unavailable');
  const blob = await response.blob();
  if (!blob.size) throw new Error('Empty asset');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read asset'));
    reader.readAsDataURL(blob);
  });
}

function encode(value: Edition) {
  return btoa(Array.from(new TextEncoder().encode(JSON.stringify(value)), byte => String.fromCharCode(byte)).join(''));
}

save.addEventListener('click', async () => {
  const saved = {...edition};
  const film = screeningFilms[saved.film];
  const page = document.implementation.createHTMLDocument(saved.title.trim() || film.name);
  const view = page.importNode(print, true);
  view.removeAttribute('id');
  const heading = page.createElement('h1');
  heading.className = 'screen-title';
  heading.textContent = view.querySelector('h2')!.textContent;
  view.querySelector('h2')!.replaceWith(heading);
  save.disabled = true;
  status.textContent = 'Packing the film and programme…';
  try {
    const [video, poster, captions] = await Promise.all([
      embed(film.video, 'video/mp4'), embed(film.poster, film.poster.endsWith('.jpg') ? 'image/jpeg' : 'image/webp'), embed(film.captions, 'text/vtt'),
    ]);
    const offlinePlayer = view.querySelector('video')!;
    offlinePlayer.src = video;
    offlinePlayer.poster = poster;
    offlinePlayer.querySelector('track')!.src = captions;
    page.documentElement.lang = 'en';
    const policy = page.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
    page.head.prepend(policy);
    const marker = page.createElement('meta');
    marker.name = 'composer-screening-room-v1';
    marker.content = encode(saved);
    page.head.prepend(marker);
    const charset = page.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    page.head.prepend(charset);
    const viewport = page.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    page.head.append(viewport);
    const style = page.createElement('style');
    style.textContent = printCss + '\nbody{margin:0;padding:clamp(12px,4vw,64px);background:#101316}.screening-print{max-width:960px;margin:auto}';
    page.head.append(style);
    const edit = page.createElement('p');
    edit.className = 'credit';
    const builder = page.createElement('a');
    builder.href = 'https://composer.loftwah.com/demo/screening-room#edit-title';
    builder.textContent = 'Edit this screening in App Composer';
    edit.append(builder, ' · Choose “Open a saved screening room” and select this file.');
    view.querySelector('.programme:last-child')!.append(edit);
    page.body.append(view);
    const url = URL.createObjectURL(new Blob(['<!doctype html>\n', page.documentElement.outerHTML], {type: 'text/html;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = (heading.textContent!.replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '') || 'screening-room') + '.html';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    status.textContent = 'Downloaded “' + heading.textContent + '”. Open the HTML file to watch offline.';
  } catch {
    status.textContent = 'The film could not be packed. Check your connection and try the download again.';
  } finally {
    save.disabled = false;
  }
});

document.querySelector('#room-open')!.addEventListener('click', () => file.click());
file.addEventListener('change', async () => {
  const selected = file.files?.[0];
  if (!selected) return;
  try {
    // Only read our bounded metadata. Never mount or execute an imported page.
    const head = await selected.slice(0, 8192).text();
    const payload = head.match(/<meta name="composer-screening-room-v1" content="([A-Za-z0-9+/=]{1,6000})">/)?.[1];
    if (!payload) throw new Error('Missing edition');
    const data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(payload), c => c.charCodeAt(0))));
    if (!data || typeof data.film !== 'string' || !Object.prototype.hasOwnProperty.call(screeningFilms, data.film) || (data.treatment !== 'midnight' && data.treatment !== 'matinee') ||
        typeof data.title !== 'string' || data.title.length > 80 || typeof data.note !== 'string' || data.note.length > 400) throw new Error('Invalid edition');
    fill({film: data.film, treatment: data.treatment, title: data.title, note: data.note});
    status.textContent = 'Screening room opened. Download again to keep your changes.';
  } catch {
    status.textContent = 'Choose an HTML file downloaded from this screening room maker.';
  } finally {
    file.value = '';
  }
});
