import {editionCards, editionHash, newEdition, readEdition, type Edition} from '../lib/postcard-edition';

const desk = document.querySelector<HTMLElement>('[data-post-editor], [data-post-reader]');
if (desk) {
  const editor = desk.hasAttribute('data-post-editor');
  const name = desk.querySelector<HTMLInputElement>('[data-post-name]');
  const note = desk.querySelector<HTMLInputElement>('[data-post-note]');
  const radio = [...desk.querySelectorAll<HTMLInputElement>('input[name=post-cover]')];
  const prints = [...desk.querySelectorAll<HTMLElement>('[data-post-print]')];
  const status = desk.querySelector<HTMLElement>('[data-post-status]');
  let edition: Edition;

  function paint() {
    const cards = editionCards(edition);
    const title = edition.name.trim() || 'Untitled collection';
    const heading = desk?.querySelector('[data-post-heading]');
    if (heading) {
      heading.textContent = title;
      document.title = title + ' · App Composer';
    }
    for (const [index, print] of prints.entries()) {
      const card = cards[index];
      const photo = print.querySelector<HTMLImageElement>('[data-post-photo]')!;
      if (photo.getAttribute('src') !== card.image.src) photo.src = card.image.src;
      photo.alt = card.image.alt;
      print.querySelector('[data-post-title]')!.textContent = title;
      print.querySelector('[data-post-caption]')!.textContent = card.caption;
    }
    const hash = editionHash(edition);
    for (const [selector, path] of [['[data-post-view]', '/demo/postcards'], ['[data-post-bench]', '/demo/connected-apps'], ['[data-post-remix]', '/']]) {
      const link = desk?.querySelector<HTMLAnchorElement>(selector);
      if (link) link.href = path + hash;
    }
  }

  function load() {
    const incoming = readEdition(location.hash);
    edition = incoming ?? newEdition();
    if (status && location.hash.startsWith('#postcards=') && !incoming) {
      status.textContent = 'This link is incomplete. The sample collection is shown.';
    }
    if (name) name.value = edition.name;
    if (note) note.value = edition.captions[edition.cover];
    for (const input of radio) input.checked = input.value === String(edition.cover);
    paint();
  }
  load();
  window.addEventListener('hashchange', load);
  if (editor) {
    name?.addEventListener('input', () => { edition.name = name.value; paint(); });
    note?.addEventListener('input', () => { edition.captions[edition.cover] = note.value; paint(); });
    for (const input of radio) input.addEventListener('change', () => {
      edition.cover = input.value === '1' ? 1 : 0;
      if (note) note.value = edition.captions[edition.cover];
      paint();
    });
  } else {
    desk.querySelector('[data-post-print-action]')?.addEventListener('click', () => window.print());
    desk.querySelector('[data-post-copy]')?.addEventListener('click', async () => {
      const url = new URL('/demo/postcards', location.origin);
      url.hash = editionHash(edition);
      try {
        await navigator.clipboard.writeText(url.href);
        if (status) status.textContent = 'Page link copied. It opens this edition with both captions.';
      } catch {
        const field = desk.querySelector<HTMLInputElement>('[data-post-address]')!;
        field.hidden = false;
        field.value = url.href;
        field.select();
        if (status) status.textContent = 'Copy the selected page address.';
      }
    });
  }
}
