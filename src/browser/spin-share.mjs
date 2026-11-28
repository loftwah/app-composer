import { spinImageFormats } from '../lib/spin-site.mjs';
import { encodeSpinPng, renderSpinPoster, renderSpinVideo, replayVideoType } from './spin-export.mjs';

export function mountSpinShare(dialog, result, previewMount, getVideoAudio, reducedMotion) {
  const content = dialog.querySelector('[data-share-content]');
  const get = name => content.querySelector('[data-' + name + ']');
  const url = get('share-url');
  const formats = get('share-formats');
  const image = new Image();
  image.dataset.shareImage = '';
  image.alt = '';
  image.hidden = true;
  const previewLink = previewMount.querySelector('[data-preview-link]');
  const status = previewMount.querySelector('[data-image-status]');
  previewLink.append(image);
  const saveImage = get('save-image');
  const copyImage = get('copy-image');
  const nativeImage = get('native-image');
  const openImage = get('open-image');
  const imageFeedback = get('image-feedback');
  const feedback = get('share-feedback');
  const textCopyButtons = ['copy-link', 'copy-caption', 'copy-alt'].map(get);
  const canCopyImage = typeof navigator.clipboard?.write === 'function' && typeof ClipboardItem !== 'undefined' &&
    (ClipboardItem.supports?.('image/png') ?? true);
  const formatKey = 'spin-share-image-format';
  const images = new Map();
  let current;
  let active;
  let imageUrl;
  let previewCanvas;
  let copying = false;
  let alt = '';
  try {
    const saved = localStorage.getItem(formatKey);
    const input = [...formats.querySelectorAll('input')].find(item => item.value === saved);
    if (input) input.checked = true;
  } catch {}

  copyImage.hidden = !canCopyImage;
  saveImage.parentElement.toggleAttribute('data-save-primary', !canCopyImage);

  function releasePreview() {
    previewCanvas?.remove();
    previewCanvas = undefined;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = undefined;
    previewLink.removeAttribute('href');
    previewLink.hidden = true;
    image.removeAttribute('src');
    image.hidden = true;
    saveImage.disabled = true;
    copyImage.disabled = true;
    nativeImage.hidden = true;
    openImage.removeAttribute('href');
    openImage.hidden = true;
  }

  function download(blob, name) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  async function preview() {
    const id = formats.querySelector('input:checked').value;
    const format = spinImageFormats.find(item => item.id === id);
    const { session, link } = current;
    releasePreview();
    status.hidden = false;
    status.textContent = 'Preparing image…';
    imageFeedback.textContent = '';
    let entry = images.get(id);
    if (!entry) {
      entry = { poster: renderSpinPoster(session, link, id) };
      images.set(id, entry);
    }
    const selection = { format, file: undefined, showOpen: !canCopyImage };
    active = selection;
    try {
      const poster = await entry.poster;
      if (selection !== active) return;
      if (poster) {
        poster.dataset.previewCanvas = '';
        poster.setAttribute('role', 'img');
        poster.setAttribute('aria-label', alt);
        previewCanvas = poster;
        previewMount.prepend(poster);
        status.hidden = true;
        entry.file ??= encodeSpinPng(poster).then(blob =>
          new File([blob], `spin-${session.id.slice(0, 8)}-${id}.png`, { type: 'image/png' }),
        ).finally(() => { entry.poster = undefined; });
      }
      const file = await entry.file;
      if (selection !== active) return;
      const src = URL.createObjectURL(file);
      imageUrl = src;
      image.src = src;
      image.alt = alt;
      await image.decode();
      if (selection !== active) return;
      selection.file = file;
      previewCanvas?.remove();
      previewCanvas = undefined;
      image.hidden = false;
      previewLink.href = src;
      previewLink.hidden = false;
      status.hidden = true;
      saveImage.disabled = false;
      copyImage.disabled = copying;
      openImage.href = src;
      openImage.hidden = !selection.showOpen;
      nativeImage.hidden = typeof navigator.share !== 'function' || !navigator.canShare?.({ files: [file] });
    } catch {
      if (images.get(id) === entry) images.delete(id);
      if (selection !== active) return;
      releasePreview();
      copyImage.disabled = true;
      status.hidden = false;
      status.textContent = 'The image didn’t load. Choose a size to retry.';
      imageFeedback.textContent = status.textContent;
    }
  }

  function configure(data) {
    if (current?.session !== data.session) images.clear();
    current = data;
    const { session, link, question, isDraft } = data;
    const completed = session?.status === 'completed';
    get('share-title').textContent = completed ? 'Share the result' : isDraft ? 'Share wheel' : 'Share draw';
    const description = get('share-description');
    description.hidden = completed;
    description.textContent = isDraft
      ? 'Send a copy of your wheel that friends can edit.'
      : 'Send this link now. Friends can come back to the same link to see where the wheel lands.';
    get('share-draft').hidden = !isDraft;
    get('share-social').hidden = !completed;
    get('link-field').hidden = completed;
    get('share-more').hidden = !completed;
    get('share-more').open = false;
    get('copy-link-label').textContent = completed ? 'Copy result link' : 'Copy link';
    get('receipt-actions').hidden = session?.status !== 'abandoned';
    get('native-share').hidden = typeof navigator.share !== 'function';
    get('replay-video').hidden = !completed || !replayVideoType();
    url.value = link;
    feedback.textContent = '';
    if (!completed) return;
    const winner = session.config.entries[session.winner];
    const outcome = winner ? `${winner} wins!` : 'It ended in a tie.';
    const spins = session.rounds.length;
    const count = `${spins} ${spins === 1 ? 'spin' : 'spins'}`;
    const leaders = session.config.entries.map((entry, index) => ({ entry, wins: session.totals[index] }))
      .filter(choice => choice.wins > 0).sort((left, right) => right.wins - left.wins).slice(0, 2);
    const tally = spins > 1 ? ' ' + leaders.map(choice => `${choice.entry} ${choice.wins}`).join(' · ') + '.' : '';
    alt = `Spin wheel for “${question}”. ${outcome} ${count}.${tally}`;
    get('share-caption').value = `${question}\n${outcome}${tally}\nSee the spin
${link}`;
    void preview();
  }

  function present(data) {
    if (!result.hidden && current?.session === data.session) return;
    if (dialog.open) dialog.close();
    result.append(content);
    result.hidden = false;
    configure(data);
  }

  function hideResult() {
    if (result.hidden) return;
    active = undefined;
    images.clear();
    releasePreview();
    result.hidden = true;
    dialog.append(content);
  }

  function open(data) {
    hideResult();
    configure(data);
    if (!dialog.open) dialog.showModal();
  }

  function setClipboardBusy(value) {
    copying = value;
    copyImage.disabled = value || !active?.file;
    for (const button of textCopyButtons) button.disabled = value;
  }

  async function copy(value, success, field) {
    if (copying) return;
    setClipboardBusy(true);
    try {
      await navigator.clipboard.writeText(value);
      feedback.textContent = success;
    } catch {
      if (field) {
        if (field === url) get('link-field').hidden = false;
        field.focus();
        field.select();
      }
      feedback.textContent = field ? 'Text selected. Copy it using your device’s Copy command.' : 'Image alt text: ' + value;
    } finally {
      setClipboardBusy(false);
    }
  }

  async function nativeShare(data, status, fallback) {
    try { await navigator.share(data); }
    catch (error) {
      if (error?.name !== 'AbortError') status.textContent = fallback;
    }
  }

  get('copy-link').addEventListener('click', () => void copy(url.value, 'Link copied.', url));
  const caption = get('share-caption');
  get('copy-caption').addEventListener('click', () => void copy(caption.value, 'Caption copied.', caption));
  get('copy-alt').addEventListener('click', () => void copy(alt, 'Image alt text copied.'));
  get('native-share').addEventListener('click', () => void nativeShare(
    { title: 'Spin by App Composer', url: url.value }, feedback, 'Sharing didn’t open. Use Copy link.',
  ));
  nativeImage.addEventListener('click', () => {
    if (active?.file) void nativeShare(
      { files: [active.file] }, imageFeedback, 'Sharing didn’t open. Use Save PNG.',
    );
  });
  copyImage.addEventListener('click', async () => {
    const selection = active;
    if (!selection?.file || copying) return;
    const { format, file } = selection;
    setClipboardBusy(true);
    imageFeedback.textContent = 'Copying image…';
    try {
      // Write the prepared PNG in the click handler to retain WebKit's user gesture.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]);
      if (selection === active) {
        imageFeedback.textContent = `${format.name} copied at ${format.width} × ${format.height}. Paste it into your post or message.`;
      }
    } catch {
      if (selection !== active) return;
      selection.showOpen = true;
      openImage.hidden = !selection.file;
      imageFeedback.textContent = 'Couldn’t copy here. Save the PNG or open it and use the image menu.';
    } finally {
      setClipboardBusy(false);
    }
  });
  saveImage.addEventListener('click', () => {
    if (!active?.file) return;
    download(active.file, active.file.name);
    imageFeedback.textContent = `${active.format.name} PNG saved.`;
  });
  const saveReceipt = () => {
    const { session } = current;
    download(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }), `spin-${session.id}.json`);
    feedback.textContent = 'Draw record saved.';
  };
  get('receipt').addEventListener('click', saveReceipt);
  get('abandoned-receipt').addEventListener('click', saveReceipt);
  get('replay-video').addEventListener('click', async event => {
    const button = event.currentTarget;
    const { session, link } = current;
    const report = message => { if (!result.hidden && current.session === session) feedback.textContent = message; };
    button.disabled = true;
    report('Making the video. Keep this tab open…');
    try {
      const video = await renderSpinVideo(session, link, reducedMotion.matches, getVideoAudio());
      download(video.blob, `spin-${session.id.slice(0, 8)}-replay.${video.extension}`);
      report('Video saved.');
    } catch (error) {
      report(error instanceof Error ? error.message : 'Spin couldn’t make the video. Try saving the story image.');
    } finally {
      button.disabled = false;
    }
  });
  formats.addEventListener('change', event => {
    try { localStorage.setItem(formatKey, event.target.value); } catch {}
    void preview();
  });
  dialog.addEventListener('close', () => {
    if (content.parentElement !== dialog) return;
    active = undefined;
    images.clear();
    releasePreview();
  });

  return { open, present, hideResult, error: message => { feedback.textContent = message; } };
}
