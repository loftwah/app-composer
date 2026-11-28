const choicesByIcon = {
  mcdonalds: ['Maccas', 'McDonald’s'],
  hungryjacks: ['Hungry Jack’s'],
  kfc: ['KFC', 'Kentucky Fried Chicken'],
  pizza: ['Pizza', 'Veggie pizza'],
  hamburger: ['Burgers', 'Local burger shop', 'Carl’s Jr.'],
  sandwich: ['Bánh mì', 'Tofu bánh mì', 'Toastie', 'Loaded toastie', 'Wrap', 'Falafel wrap', 'Picnic'],
  fish: ['Fish and chips', 'Sushi', 'Sushi rolls'],
  salad: ['Salad bowl', 'Roast vegetables and couscous'],
  soup: ['Soup', 'Miso noodles', 'Mushroom ramen', 'Dumplings', 'Veggie dumplings'],
  bean: ['Bean tacos', 'Chana masala', 'Chickpea curry'],
  'cooking-pot': ['Pesto pasta', 'Cook at home', 'Cook together', 'Egg fried rice', 'Stir-fry', 'Tray bake', 'Fried rice'],
  coffee: ['Flat white', 'Long black', 'Cappuccino', 'Iced latte', 'Piccolo', 'Cold brew'],
  brain: ['Codenames', 'Twenty questions', 'Categories'],
  flag: ['Mario Kart', 'Racing'],
  'gamepad-2': ['Jackbox', 'Overcooked 2', 'It Takes Two', 'Co-op adventure', 'Platformer'],
  'chess-knight': ['Chess', 'Strategy'],
  drama: ['Charades', 'Comedy special', 'Community theatre'],
  layers: ['Uno', 'Patchwork', 'Carcassonne'],
  'messages-square': ['Would you rather', 'Two truths and a lie', 'Call a friend'],
  headphones: ['Name that tune', 'Hip hop', 'Soul', 'House', 'Jazz', 'Indie rock', 'Drum and bass', 'Funk', 'Ambient', 'Make a playlist', 'Play a whole album', 'Trade three songs each', 'Find a local artist', 'Make a two-sided mix'],
  clapperboard: ['A short film', 'An old favourite', 'A new series', 'A documentary', 'Cinema', 'Movie night'],
  'shopping-basket': ['Farmers market', 'A market', 'Community market'],
  mountain: ['Day hike', 'A lookout', 'Creek walk', 'Rock'],
  shirt: ['Op shop', 'Laundry', 'Fold one basket'],
  sprout: ['Garden', 'Botanic gardens'],
  dices: ['Board games'],
  bike: ['Bike ride', 'Bike path'],
  'waves-horizontal': ['Swim', 'Beach walk'],
  trees: ['A park', 'Dog park'],
  'book-open': ['Read a chapter', 'Visit the library', 'A library', 'Library event', 'Second-hand bookshop', 'Paper'],
  camera: ['Take a photo walk', 'Photo composition', 'Street art walk'],
  'map-pin': ['Outdoor court', 'Free gallery'],
  check: ['Yes'],
  'circle-x': ['No'],
  scissors: ['Scissors'],
};
const normalize = label => label?.toLowerCase().replace(/[’']/g, '').trim();
const choiceIcons = new Map(Object.entries(choicesByIcon).flatMap(([icon, labels]) =>
  labels.map(label => [normalize(label), icon]),
));
const images = new Map();

const lookup = label => choiceIcons.get(normalize(label));
const iconUrl = name => `/spin-brand/choices/${name}.svg`;

export function spinChoiceIconUrl(label) {
  const name = lookup(label);
  return name ? iconUrl(name) : '';
}

export function spinChoiceIcon(label) {
  return images.get(lookup(label))?.image;
}

export function loadSpinChoiceIcons(labels) {
  if (labels.length > 6) return null;
  const names = new Set(labels.map(lookup).filter(Boolean));
  const pending = [];
  for (const name of names) {
    if (!images.has(name)) {
      const image = new Image();
      const entry = {};
      image.src = iconUrl(name);
      entry.ready = image.decode().then(() => { entry.image = image; }).catch(() => {});
      images.set(name, entry);
      pending.push(entry.ready);
    } else if (!images.get(name).image) {
      pending.push(images.get(name).ready);
    }
  }
  return pending.length ? Promise.all(pending) : null;
}
