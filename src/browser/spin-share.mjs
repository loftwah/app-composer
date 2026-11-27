import { spinImageFormats } from '../lib/spin-site.mjs';
import { renderSpinPng, renderSpinVideo, replayVideoType } from './spin-export.mjs';

export function mountSpinShare(dialog, paintWheel, getVideoAudio, reducedMotion) {
  const get = name => dialog.querySelector('[data-' + name + ']');
  const url = get('share-url');
  const formats = get('share-formats');
  const image = new Image();
  image.dataset.shareImage = '';
  image.alt = '';
  image.hidden = true;
  get('share-preview').prepend(image);
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
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = undefined;
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
    const status = get('image-status');
    status.hidden = false;
    status.textContent = 'Preparing the image…';
    imageFeedback.textContent = '';
    let pending = images.get(id);
    if (!pending) {
      pending = renderSpinPng(session, link, id, paintWheel).then(blob =>
        new File([blob], `spin-${session.id.slice(0, 8)}-${id}.png`, { type: 'image/png' }),
      );
      images.set(id, pending);
    }
    const selection = { format, file: undefined, showOpen: !canCopyImage };
    active = selection;
    try {
      const file = await pending;
      if (selection !== active) return;
      const src = URL.createObjectURL(file);
      imageUrl = src;
      image.src = src;
      image.alt = alt;
      await image.decode();
      if (selection !== active) return;
      selection.file = file;
      image.hidden = false;
      status.hidden = true;
      saveImage.disabled = false;
      copyImage.disabled = copying;
      openImage.href = src;
      openImage.hidden = !selection.showOpen;
      nativeImage.hidden = typeof navigator.share !== 'function' || !navigator.canShare?.({ files: [file] });
    } catch {
      if (images.get(id) === pending) images.delete(id);
      if (selection !== active) return;
      releasePreview();
      copyImage.disabled = true;
      status.textContent = 'The image didn’t load. Pick another size or reopen sharing to retry.';
    }
  }

  function open(data) {
    if (current?.session !== data.session) images.clear();
    current = data;
    const { session, link, question, isDraft } = data;
    const completed = session?.status === 'completed';
    get('share-title').textContent = completed ? 'Share result' : isDraft ? 'Share wheel' : 'Share draw';
    const description = get('share-description');
    description.hidden = completed;
    description.textContent = isDraft
      ? 'Send an editable copy of your wheel. To let friends witness the same draw, lock it before spinning.'
      : 'Anyone with this link can see the draw. Send it now and friends can check the result at the same link.';
    get('share-draft').hidden = !isDraft;
    get('share-social').hidden = !completed;
    get('link-field').hidden = completed;
    get('share-more').hidden = !completed;
    get('share-more').open = false;
    get('copy-link-label').textContent = completed ? 'Copy replay link' : 'Copy link';
    get('receipt-actions').hidden = session?.status !== 'abandoned';
    get('native-share').hidden = typeof navigator.share !== 'function';
    get('replay-video').hidden = !completed || !replayVideoType();
    url.value = link;
    feedback.textContent = '';
    if (!dialog.open) dialog.showModal();
    if (!completed) return;
    const winner = session.config.entries[session.winner];
    const outcome = winner ? `${winner} wins!` : 'It ended in a tie.';
    const spins = session.rounds.length;
    const count = `${spins} ${spins === 1 ? 'spin' : 'spins'}`;
    const leaders = session.config.entries.map((entry, index) => ({ entry, wins: session.totals[index] }))
      .filter(choice => choice.wins > 0).sort((left, right) => right.wins - left.wins).slice(0, 2);
    const tally = spins > 1 ? ' ' + leaders.map(choice => `${choice.entry} ${choice.wins}`).join(' · ') + '.' : '';
    alt = `Spin decision wheel for “${question}”. ${outcome} ${count} recorded.${tally}`;
    get('share-caption').value = `${question}\n${outcome}${tally}\nReplay the draw on Spin: ${link}`;
    void preview();
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
    feedback.textContent = 'Receipt downloaded.';
  };
  get('receipt').addEventListener('click', saveReceipt);
  get('abandoned-receipt').addEventListener('click', saveReceipt);
  get('replay-video').addEventListener('click', async event => {
    const button = event.currentTarget;
    const { session, link } = current;
    const report = message => { if (dialog.open && current.session === session) feedback.textContent = message; };
    button.disabled = true;
    report('Recording the replay. Keep this tab visible…');
    try {
      const video = await renderSpinVideo(session, link, paintWheel, reducedMotion.matches, getVideoAudio());
      download(video.blob, `spin-${session.id.slice(0, 8)}-replay.${video.extension}`);
      report('Replay video downloaded.');
    } catch (error) {
      report(error instanceof Error ? error.message : 'The replay could not be exported. Try saving the story image.');
    } finally {
      button.disabled = false;
    }
  });
  formats.addEventListener('change', event => {
    try { localStorage.setItem(formatKey, event.target.value); } catch {}
    void preview();
  });
  dialog.addEventListener('close', () => {
    active = undefined;
    images.clear();
    releasePreview();
  });

  return { open, error: message => { feedback.textContent = message; } };
}
