// Supported owner/content API journey for the two fictional demo postcards:
// upload -> pending -> owner approval -> public entry, then collection in
// Linkarooie. It also retires the previous demo fixtures through the same
// moderation API. No direct SQL and no secret values are printed.
import {readFileSync, writeFileSync} from 'node:fs';

const GUESTBOOK = 'https://guestbook.loftwah.com';
const SHOWCASE = 'https://showcase.loftwah.com';
const gbToken = readFileSync(new URL('../../../app-composer-guestbook/.private/OWNER_API_TOKEN', import.meta.url), 'utf8').trim();
const scToken = readFileSync(new URL('../../../app-composer-showcase/.private/OWNER_API_TOKEN', import.meta.url), 'utf8').trim();
const png = path => readFileSync(new URL('../masters/og/' + path, import.meta.url)).toString('base64');
const log = [];

async function call(url, {token, body, method = 'POST'}) {
  const response = await fetch(url, {
    method: method ?? 'POST',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'AppComposer demo fixture (owner API)'},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = {raw: text.slice(0, 200)}; }
  if (!response.ok) throw Error(url + ' -> ' + response.status + ' ' + JSON.stringify(data).slice(0, 300));
  return data;
}

const before = await (await fetch(GUESTBOOK + '/api/items')).json();
log.push({step: 'before', publicItems: before.items.map(item => ({id: item.id, title: item.title.slice(0, 40)}))});

const postcards = [
  {file: 'postcard-ringmarket-upload.png', caption: 'Signal check at the ring market · fictional demo postcard', author: 'App Composer demo'},
  {file: 'postcard-lighthouse-upload.png', caption: 'The tide lighthouse, slow moon · fictional demo postcard', author: 'App Composer demo'},
];
const created = [];
for (const card of postcards) {
  const uploaded = await call(GUESTBOOK + '/api/upload', {token: gbToken, body: {caption: card.caption, author: card.author, consent: true, png: png(card.file)}});
  const approved = await call(GUESTBOOK + '/api/moderate', {token: gbToken, body: {id: uploaded.id, status: 'approved'}});
  created.push({id: uploaded.id, status: approved.status, caption: card.caption});
  log.push({step: 'upload+approve', id: uploaded.id, status: approved.status});
}

// Collect the first postcard in Linkarooie through its own published-card API.
const featured = await call(SHOWCASE + '/api/cards', {token: scToken, body: {item: created[0].id, status: 'published'}});
await call(SHOWCASE + '/api/presentation', {token: scToken, body: {id: featured.id, pinned: false, icon: 'star', group: ''}});
log.push({step: 'collected', card: featured.id, item: created[0].id});

// Retire the previous fixtures: hide their Linkarooie cards, then delete the
// guestbook items so their media is revoked everywhere on the next request.
const cards = await call(SHOWCASE + '/api/cards', {token: scToken, method: 'GET'});
const stale = cards.cards.filter(card => /fictional fixture/.test(card.title));
for (const card of stale) {
  await call(SHOWCASE + '/api/cards', {token: scToken, body: {id: card.id, status: 'hidden'}});
  log.push({step: 'retired card', card: card.id, title: card.title.slice(0, 40)});
}
const items = await (await fetch(GUESTBOOK + '/api/items')).json();
for (const item of items.items.filter(entry => /fictional fixture/.test(entry.title))) {
  const deleted = await call(GUESTBOOK + '/api/moderate', {token: gbToken, body: {id: item.id, status: 'deleted'}});
  log.push({step: 'retired item', id: item.id, status: deleted.status});
}

const after = await (await fetch(GUESTBOOK + '/api/items')).json();
const collection = await (await fetch(SHOWCASE + '/api/cards')).json();
log.push({
  step: 'after',
  publicItems: after.items.map(item => ({id: item.id, title: item.title.slice(0, 50), image: item.image})),
  publicCards: collection.cards.filter(card => card.status === 'published').map(card => ({id: card.id, title: card.title.slice(0, 50), provider: card.provider, item: card.item_id, group: card.group, pinned: card.pinned})),
});
writeFileSync(new URL('./demo-postcards-evidence.json', import.meta.url), JSON.stringify(log, null, 2) + '\n');
console.log(JSON.stringify(log.slice(-3), null, 2));
