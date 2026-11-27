const photos = new Map([
  ['kfc', 'chicken'],
  ['hungry jacks', 'grill'],
  ['maccas', 'fries'],
]);
const images = new Map();

function lookup(label) {
  return photos.get(label?.toLowerCase().replace(/[’']/g, '').trim());
}

export function spinPhoto(label) {
  return images.get(lookup(label))?.image;
}

export function loadSpinPhotos(labels) {
  const subjects = new Set(labels.map(lookup).filter(Boolean));
  const pending = [];
  for (const subject of subjects) {
    if (!images.has(subject)) {
      const image = new Image();
      const entry = {};
      image.src = `/spin-brand/counter/${subject}.webp`;
      entry.ready = image.decode().then(() => { entry.image = image; }).catch(() => {});
      images.set(subject, entry);
      pending.push(entry.ready);
    } else if (!images.get(subject).image) {
      pending.push(images.get(subject).ready);
    }
  }
  return pending.length ? Promise.all(pending) : null;
}

export function paintSpinPhoto(context, image, x, y, width, height) {
  const fit = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / fit;
  const sourceHeight = height / fit;
  context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2,
    sourceWidth, sourceHeight, x, y, width, height);
}
