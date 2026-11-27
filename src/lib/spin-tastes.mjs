const artPrefix = '/spin-brand/taste-20261127e/';
export const spinTastes = [
  { id: 'burgers', label: 'Burgers', art: artPrefix + 'burgers.webp' },
  { id: 'chicken', label: 'Chicken', art: artPrefix + 'chicken.webp' },
  { id: 'pizza', label: 'Pizza', art: artPrefix + 'pizza.webp' },
  { id: 'fish', label: 'Fish & chips', art: artPrefix + 'fish.webp' },
  { id: 'kebabs', label: 'Kebabs', art: artPrefix + 'kebabs.webp' },
  { id: 'noodles', label: 'Noodles', art: artPrefix + 'noodles.webp' },
  { id: 'veggie', label: 'Vegetarian', art: artPrefix + 'veggie.webp' },
  { id: 'sweet', label: 'Dessert', art: artPrefix + 'sweet.webp' },
];

const ideas = [
  ['Local burger shop', 'burgers'], ['Fish and chips', 'fish'],
  ['Charcoal chicken', 'chicken'], ['Pizza', 'pizza'], ['Kebabs', 'kebabs'],
  ['Laksa', 'noodles'], ['Falafel wrap', 'veggie kebabs'], ['Gelato', 'sweet'],
  ['Veggie pizza', 'pizza veggie'], ['Chicken kebab', 'kebabs chicken'],
  ['Veggie burger', 'burgers veggie'], ['Veggie noodle stir-fry', 'noodles veggie'],
  ['Chicken noodle soup', 'noodles chicken'], ['Chicken burger', 'burgers chicken'],
  ['Grilled fish and chips', 'fish'], ['Chips and potato cakes', 'fish veggie'],
  ['Margherita pizza', 'pizza veggie'], ['HSP', 'kebabs chicken'],
  ['Maccas', 'burgers chicken'], ['Hungry Jack’s', 'burgers'],
  ['KFC', 'chicken'], ['Charcoal chicken and chips', 'chicken'],
  ['Churros', 'sweet'], ['Sticky date pudding', 'sweet'],
  ['Chocolate thickshake', 'sweet burgers'], ['Thai noodles', 'noodles'],
].map(([label, tasteList]) => ({ label, tastes: tasteList.split(' ') }));

const tastesById = new Map(spinTastes.map(taste => [taste.id, taste]));
const artByLabel = new Map(ideas.map(idea => [idea.label, tastesById.get(idea.tastes[0]).art]));

export function spinTasteArt(label) {
  return artByLabel.get(label) ?? '';
}

export function recommendTakeaway(selection, limit = 6) {
  const selected = new Set(selection.filter(taste => tastesById.has(taste)));
  if (!selected.size) return [];
  const ranked = ideas.map(idea => ({
    ...idea,
    art: artByLabel.get(idea.label),
    matches: idea.tastes.filter(taste => selected.has(taste)).length,
  })).filter(idea => idea.matches > 0)
    .sort((left, right) => right.matches - left.matches);
  const picks = ranked.slice(0, Math.min(limit, 1));
  const covered = new Set(picks.flatMap(idea => idea.tastes));
  for (const taste of selected) {
    if (picks.length >= limit) break;
    if (covered.has(taste)) continue;
    const match = ranked.find(idea => idea.tastes.includes(taste));
    if (!match) continue;
    picks.push(match);
    for (const represented of match.tastes) covered.add(represented);
  }
  return [...picks, ...ranked.filter(idea => !picks.includes(idea))].slice(0, limit);
}
