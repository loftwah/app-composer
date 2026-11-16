// The Share wall is public: it lists current publications and nothing else.
// These checks cover the read that feeds it, the pure selection it renders and
// the two empty states, without a browser or a deployed environment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStack,
  publicStack,
  publishStack,
  publicStacks,
  saveStack,
  setArchived,
  unpublishStack,
  PUBLIC_STACK_LIMIT,
} from '../src/lib/stacks.mjs';
import {
  filterShareWall,
  shareWallCard,
  shareWallEmptyCopy,
  shareWallHref,
  shareWallOptions,
  shareWallQuery,
  shareWallSummary,
} from '../src/lib/share-wall.ts';
import { sqliteD1 } from './helpers/stacks-sqlite.mjs';

const workspaceId = 'fictional-workspace-wall01';
const document = (name, extra = {}) => ({
  version: 1,
  name,
  description: `${name} description`,
  theme: 'daylight',
  instances: [
    { id: 'fictional-instance-wall-hello', app: 'hello', label: 'Hello World' },
    { id: 'fictional-instance-wall-book', app: 'guestbook', label: 'Here / there' },
  ],
  ...extra,
});

async function seededStack(db, name, extra) {
  const created = await createStack(db, workspaceId, name);
  return saveStack(db, workspaceId, created.id, document(name, extra), created.revision);
}

async function database() {
  const db = sqliteD1();
  await db.prepare('INSERT INTO creator_workspaces (id, name) VALUES (?, ?)').bind(workspaceId, 'Fixture wall workspace').run();
  return db;
}

test('the wall lists current publications only, newest publication first', async () => {
  const db = await database();
  try {
    const older = await seededStack(db, 'Older stack');
    await publishStack(db, workspaceId, older.id, older.revision);
    const newer = await seededStack(db, 'Newer stack');
    await publishStack(db, workspaceId, newer.id, newer.revision);
    const draft = await seededStack(db, 'Draft stack');
    const archived = await seededStack(db, 'Archived stack');
    const archivedLive = await publishStack(db, workspaceId, archived.id, archived.revision);
    const unpublished = await seededStack(db, 'Unpublished stack');
    const unpublishedLive = await publishStack(db, workspaceId, unpublished.id, unpublished.revision);
    await setArchived(db, workspaceId, archived.id, true, archivedLive.revision);
    await unpublishStack(db, workspaceId, unpublished.id, unpublishedLive.revision);
    // A damaged snapshot is not a card, even though the stack row still claims
    // a publication. publicStack() refuses it, so the wall must too.
    const damaged = await seededStack(db, 'Damaged stack');
    const damagedLive = await publishStack(db, workspaceId, damaged.id, damaged.revision);
    await db.prepare('UPDATE creator_stack_publications SET document_json = ? WHERE stack_id = ? AND revision = ?')
      .bind('{}', damaged.id, damagedLive.publishedRevision).run();
    // Pin the dates so the order does not depend on the second a test runs in.
    await db.prepare('UPDATE creator_stack_publications SET published_at = ? WHERE stack_id = ?').bind('2026-11-01 09:00:00', older.id).run();
    await db.prepare('UPDATE creator_stack_publications SET published_at = ? WHERE stack_id = ?').bind('2026-11-12 09:00:00', newer.id).run();
    await db.prepare('UPDATE creator_stack_publications SET published_at = ? WHERE stack_id = ?').bind('2026-11-20 09:00:00', damaged.id).run();

    const wall = await publicStacks(db);
    assert.deepEqual(wall.map((entry) => entry.slug), [newer.slug, older.slug]);
    assert.deepEqual(wall[0], await publicStack(db, newer.slug), 'a card is exactly the page it opens');
    assert.equal(await publicStack(db, draft.slug), null);
    assert.equal(await publicStack(db, damaged.slug), null);
  } finally {
    db.cleanup();
  }
});

test('the wall read refuses a list size outside its own bound', async () => {
  const db = await database();
  try {
    for (const limit of [0, PUBLIC_STACK_LIMIT + 1, 1.5]) {
      await assert.rejects(publicStacks(db, limit), (error) => error.code === 'INVALID');
    }
  } finally {
    db.cleanup();
  }
});

const stack = (overrides = {}) => ({
  id: 'fictional-stack-wall-0001',
  slug: 'fictional-trail-notes',
  revision: 3,
  publishedAt: '2026-11-17 04:05:06',
  name: 'Fictional Trail Notes',
  description: 'A walk log for the invented Brimbank Ridge trail.',
  theme: 'daylight',
  document: {
    version: 1,
    name: 'Fictional Trail Notes',
    description: 'A walk log for the invented Brimbank Ridge trail.',
    theme: 'daylight',
    instances: [
      { id: 'fictional-instance-wall-1', app: 'guestbook', label: 'Trail book', visible: true },
      { id: 'fictional-instance-wall-2', app: 'showcase', label: 'Trail links', visible: false },
    ],
  },
  ...overrides,
});

const card = (overrides = {}, imagePath = '/s/fictional-trail-notes/share/fixture.png') =>
  shareWallCard(stack(overrides), imagePath);

test('a card carries the published name, sentence, date and visible apps', () => {
  const entry = card();
  assert.equal(entry.slug, 'fictional-trail-notes');
  assert.equal(entry.name, 'Fictional Trail Notes');
  assert.equal(entry.description, 'A walk log for the invented Brimbank Ridge trail.');
  assert.equal(entry.published, '17 November 2026');
  assert.equal(entry.revision, 3);
  assert.equal(entry.themeLabel, 'Daylight');
  assert.deepEqual(entry.appIds, ['guestbook'], 'a hidden instance is not named');
  assert.equal(entry.appsLabel, 'Here / there');
  assert.equal(entry.imagePath, '/s/fictional-trail-notes/share/fixture.png');
  assert.equal(
    card({ description: '', document: { ...stack().document, description: '' } }).description,
    'A published App Composer stack: Trail book.',
    'an empty description falls back to the real apps, not invented copy',
  );
});

test('search reads the card name and description, and every word must match', () => {
  const notes = card();
  const board = shareWallCard(
    stack({
      id: 'fictional-stack-wall-0002',
      slug: 'fictional-launch-board',
      name: 'Fictional Launch Board',
      description: 'Checklists and links for an invented launch day.',
      theme: 'midnight',
      document: {
        ...stack().document,
        name: 'Fictional Launch Board',
        description: 'Checklists and links for an invented launch day.',
        theme: 'midnight',
        instances: [{ id: 'fictional-instance-wall-3', app: 'linkcheck', label: 'Link check', visible: true }],
      },
    }),
    '/s/fictional-launch-board/share/fixture.png',
  );
  const everything = { query: '', app: '', theme: '' };
  assert.deepEqual(filterShareWall([notes, board], everything).map((entry) => entry.slug), ['fictional-trail-notes', 'fictional-launch-board']);
  assert.deepEqual(filterShareWall([notes, board], { ...everything, query: 'TRAIL' }).map((entry) => entry.slug), ['fictional-trail-notes']);
  assert.deepEqual(filterShareWall([notes, board], { ...everything, query: 'walk log' }).map((entry) => entry.slug), ['fictional-trail-notes']);
  assert.deepEqual(filterShareWall([notes, board], { ...everything, query: 'launch invented' }).map((entry) => entry.slug), ['fictional-launch-board']);
  assert.deepEqual(filterShareWall([notes, board], { ...everything, query: 'trail launch' }), [], 'words from two cards do not match either');
  assert.deepEqual(filterShareWall([notes, board], { ...everything, query: 'guestbook' }), [], 'search is name and description, not app id');
  assert.deepEqual(filterShareWall([notes, board], { ...everything, app: 'guestbook' }).map((entry) => entry.slug), ['fictional-trail-notes']);
  assert.deepEqual(filterShareWall([notes, board], { ...everything, theme: 'midnight' }).map((entry) => entry.slug), ['fictional-launch-board']);
  assert.deepEqual(filterShareWall([notes, board], { query: 'trail', app: 'guestbook', theme: 'daylight' }).map((entry) => entry.slug), ['fictional-trail-notes']);
  assert.deepEqual(filterShareWall([notes, board], { query: 'trail', app: 'linkcheck', theme: '' }), []);
});

test('a filtered address round-trips and drops values the wall cannot honour', () => {
  assert.deepEqual(shareWallQuery(new URLSearchParams('q=%20%20walk%20%20log%20&app=guestbook&theme=daylight')), { query: 'walk log', app: 'guestbook', theme: 'daylight' });
  assert.deepEqual(shareWallQuery(new URLSearchParams('app=fictional-app&theme=noon')), { query: '', app: '', theme: '' });
  assert.deepEqual(shareWallQuery(new URLSearchParams('q=toString&app=toString')), { query: 'toString', app: '', theme: '' });
  assert.equal(shareWallHref({ query: 'walk log', app: 'guestbook', theme: 'daylight' }), '/share?q=walk+log&app=guestbook&theme=daylight');
  assert.equal(shareWallHref({ query: '', app: '', theme: '' }), '/share');
});

test('filter options offer only reachable values, plus the active filter', () => {
  const notes = card();
  const board = card({
    slug: 'fictional-launch-board',
    name: 'Fictional Launch Board',
    theme: 'midnight',
    document: {
      ...stack().document,
      theme: 'midnight',
      instances: [{ id: 'fictional-instance-wall-3', app: 'linkcheck', label: 'Link check', visible: true }],
    },
  });
  const options = shareWallOptions([notes, board], { query: '', app: '', theme: '' });
  assert.deepEqual(options.apps, [
    { value: 'guestbook', label: 'Here / there' },
    { value: 'linkcheck', label: 'Link Check' },
  ]);
  assert.deepEqual(options.themes, [
    { value: 'daylight', label: 'Daylight' },
    { value: 'midnight', label: 'Midnight' },
  ]);
  const active = shareWallOptions([notes], { query: '', app: 'showcase', theme: 'midnight' });
  assert.ok(active.apps.some((option) => option.value === 'showcase' && option.label === 'Linkarooie'));
  assert.ok(active.themes.some((option) => option.value === 'midnight' && option.label === 'Midnight'));
});

test('the result line stays honest about totals and the active filters', () => {
  const none = { query: '', app: '', theme: '' };
  assert.equal(shareWallSummary(1, 1, none), '1 published stack');
  assert.equal(shareWallSummary(4, 4, none), '4 published stacks');
  assert.equal(shareWallSummary(4, 2, { ...none, query: 'trail' }), 'Showing 2 of 4 published stacks for “trail”');
  assert.equal(shareWallSummary(1, 0, { ...none, app: 'hello', theme: 'midnight' }), 'Showing 0 of 1 published stack for Hello World and Midnight');
});

test('empty copy separates a wall with no publications from a filter that matched nothing', () => {
  const none = { query: '', app: '', theme: '' };
  const emptyWall = shareWallEmptyCopy(0, none);
  assert.equal(emptyWall.heading, 'Nothing has been published yet.');
  assert.match(emptyWall.body, /stays empty/);
  const noMatch = shareWallEmptyCopy(4, { query: 'trail', app: 'guestbook', theme: '' });
  assert.equal(noMatch.heading, 'No published stack matches those filters.');
  assert.match(noMatch.body, /“trail” and Here \/ there/);
  assert.match(noMatch.body, /all 4 published stacks/);
  assert.match(shareWallEmptyCopy(1, { ...none, theme: 'midnight' }).body, /all 1 published stack/);
});
