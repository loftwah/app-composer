import { featured, images, initialBench, transition } from './workbench';

export const scenes = ['Ring market', 'Moon lighthouse'] as const;
export type Scene = 0 | 1;
export type Edition = { name: string; captions: [string, string]; cover: Scene };

export function newEdition(): Edition {
  const {items} = initialBench();
  return {name: 'Orbital Post', captions: [items[0].caption, items[1].caption], cover: 0};
}

export function editionHash(edition: Edition) {
  return '#' + new URLSearchParams({
    postcards: '1', cover: String(edition.cover), name: edition.name,
    market: edition.captions[0], moon: edition.captions[1],
  }).toString();
}

export function readEdition(hash: string): Edition | null {
  if (hash.length > 5000) return null;
  const params = new URLSearchParams(hash.slice(1));
  const cover = params.get('cover');
  const name = params.get('name');
  const market = params.get('market');
  const moon = params.get('moon');
  if (params.get('postcards') !== '1' || (cover !== '0' && cover !== '1') ||
      name === null || name.length > 48 || market === null || market.length > 100 ||
      moon === null || moon.length > 100) return null;
  return {name, captions: [market, moon], cover: cover === '0' ? 0 : 1};
}

export function editionWorkbench(edition: Edition) {
  let state = transition(initialBench(), {type: 'title', value: edition.name.trim() || 'Untitled collection'});
  const order: Scene[] = edition.cover === 0 ? [0, 1] : [1, 0];
  for (const [slot, scene] of order.entries()) {
    state = transition(state, {type: 'select', id: state.items[scene].id});
    state = transition(state, {type: 'caption', value: edition.captions[scene].trim() || scenes[scene]});
    state = transition(state, {type: 'connect', slot});
  }
  return transition(state, {type: 'select', id: state.items[edition.cover].id});
}

export function editionCards(edition: Edition) {
  const state = editionWorkbench(edition);
  return featured(state).flatMap(item => item ? [{
    scene: item.image as Scene, caption: item.caption, image: images[item.image],
  }] : []);
}
