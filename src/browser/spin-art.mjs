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
      image.src = `/spin-brand/live/${subject}.webp`;
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
  const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * fit;
  const drawnHeight = image.naturalHeight * fit;
  context.drawImage(image, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2,
    drawnWidth, drawnHeight);
}
