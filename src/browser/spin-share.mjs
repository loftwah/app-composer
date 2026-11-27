import { renderSpinPng, renderSpinVideo, replayVideoType } from './spin-export.mjs';

export function mountSpinShare(dialog, paintWheel, getVideoAudio, reducedMotion) {
  const get = name => dialog.querySelector('[data-' + name + ']');
  const url = get('share-url');
  const format = get('share-format');
  const image = new Image();
  image.dataset.shareImage = '';
  image.alt = '';
  image.hidden = true;
  get('share-preview').prepend(image);
  const saveImage = get('save-image');
  const copyImage = get('copy-image');
  const nativeImage = get('native-image');
  const feedback = get('share-feedback');
  let current;
  let imageUrl;
  let file;
  let alt = '';
  let rendering = 0;

  function releasePreview() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = undefined;
    image.removeAttribute('src');
    image.hidden = true;
    file = undefined;
    saveImage.disabled = true;
    copyImage.disabled = true;
    nativeImage.disabled = true;
    nativeImage.hidden = true;
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
    const task = ++rendering;
    releasePreview();
    const status = get('image-status');
    status.hidden = false;
    status.textContent = 'Making your preview…';
    try {
      const { session, link } = current;
      const style = format.value;
      const blob = await renderSpinPng(session, link, style, paintWheel);
      if (task !== rendering) return;
      file = new File([blob], `spin-${session.id.slice(0, 8)}-${style}.png`, { type: 'image/png' });
      imageUrl = URL.createObjectURL(blob);
      image.src = imageUrl;
      image.alt = alt;
      image.hidden = false;
      status.hidden = true;
      saveImage.disabled = false;
      copyImage.hidden = typeof ClipboardItem === 'undefined' || typeof navigator.clipboard?.write !== 'function';
      copyImage.disabled = copyImage.hidden;
      nativeImage.hidden = !navigator.canShare?.({ files: [file] });
      nativeImage.disabled = nativeImage.hidden;
    } catch {
      if (task !== rendering) return;
      status.textContent = 'The image could not be made. Try another format or copy the result link.';
    }
  }

  function open(data) {
    current = data;
    const { session, link, question, isDraft } = data;
    const completed = session?.status === 'completed';
    const title = completed ? 'Share result' : isDraft ? 'Share wheel' : 'Share draw';
    get('share-title').textContent = title;
    get('share-description').textContent = completed
      ? 'Send the replay or take the result to your feed. The post text and image include your question and result.'
      : isDraft
        ? 'Send an editable copy of your wheel. To let friends witness the same draw, lock it before spinning.'
        : 'Anyone with this link can see the draw. Send it now and friends can check the result at the same link.';
    get('share-draft').hidden = !isDraft;
    get('share-preview').hidden = !completed;
    get('share-social').hidden = !completed;
    get('receipt-actions').hidden = !session || session.status === 'open';
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

  async function copy(value, success, field) {
    try {
      await navigator.clipboard.writeText(value);
      feedback.textContent = success;
    } catch {
      if (field) {
        field.focus();
        field.select();
      }
      feedback.textContent = field ? 'Text selected. Copy it using your device’s Copy command.' : 'Image alt text: ' + value;
    }
  }

  async function nativeShare(data) {
    try { await navigator.share(data); }
    catch (error) {
      if (error?.name !== 'AbortError') feedback.textContent = 'Sharing didn’t open. Copy the link or save the image.';
    }
  }

  get('copy-link').addEventListener('click', () => void copy(url.value, 'Link copied.', url));
  const caption = get('share-caption');
  get('copy-caption').addEventListener('click', () => void copy(caption.value, 'Post text copied.', caption));
  get('copy-alt').addEventListener('click', () => void copy(alt, 'Image alt text copied.'));
  get('native-share').addEventListener('click', () => void nativeShare({ title: 'Spin by App Composer', url: url.value }));
  nativeImage.addEventListener('click', () => {
    if (file) void nativeShare({ files: [file] });
  });
  copyImage.addEventListener('click', async () => {
    if (!file) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]);
      feedback.textContent = 'Image copied.';
    } catch {
      feedback.textContent = 'The clipboard couldn’t copy this image. Use Save image to get the same PNG.';
    }
  });
  saveImage.addEventListener('click', () => {
    if (!file) return;
    download(file, file.name);
    feedback.textContent = 'Image downloaded.';
  });
  get('receipt').addEventListener('click', () => {
    const { session } = current;
    download(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }), `spin-${session.id}.json`);
    feedback.textContent = 'Receipt downloaded.';
  });
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
  format.addEventListener('change', () => void preview());
  dialog.addEventListener('close', () => {
    rendering++;
    releasePreview();
  });

  return { open, error: message => { feedback.textContent = message; } };
}
