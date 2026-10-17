// The demonstration is only useful if it is what it claims: two fictional
// stacks, one of them containing two instances of the same app, published from
// a real publication row, and free of credentials or real people.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_STACKS, seedSQL } from '../scripts/seed-demo-stacks.mjs';

test('the demonstration is two named fictional stacks with different purposes', () => {
  assert.equal(DEMO_STACKS.length, 2);
  const [trail, launch] = DEMO_STACKS;
  assert.equal(trail.slug, 'trail-notes');
  assert.equal(launch.slug, 'launch-board');
  assert.notEqual(trail.document.theme, launch.document.theme, 'the two stacks do not look the same');
  for (const stack of DEMO_STACKS) {
    assert.match(stack.document.name, /^Fictional /, 'a demo stack is labelled as fiction in its own name');
    assert.ok(stack.document.instances.length >= 3);
  }
});

test('one stack shows the same app twice, once independent and once shared', () => {
  const trail = DEMO_STACKS[0].document;
  const guestbook = trail.instances.filter(instance => instance.app === 'guestbook');
  assert.equal(guestbook.length, 2, 'the same app appears twice');
  const own = guestbook.find(instance => instance.binding.mode === 'own');
  const shared = guestbook.find(instance => instance.binding.mode === 'shared');
  assert.ok(own && shared, 'one is independently configured and one reuses it');
  assert.equal(shared.binding.shareOf, own.id);
  assert.deepEqual(shared.config, {}, 'the reused instance inherits rather than duplicates settings');
  assert.ok(Object.keys(own.config).length >= 3, 'the independent instance carries declared settings');
  // Independent instances are genuinely configured, not merely relabelled.
  assert.equal(trail.instances.filter(instance => instance.binding.mode === 'own').length, 2);
});

test('the seed SQL publishes from a real publication row and holds no credentials', () => {
  const sql = seedSQL();
  const publications = sql.match(/INSERT INTO creator_stack_publications/g) ?? [];
  assert.equal(publications.length, 2, 'both stacks get an immutable publication row');
  assert.equal((sql.match(/status, revision/g) ?? []).length, 2);
  assert.match(sql, /'workspace-demo-fictional-0001'/);
  assert.equal(/(token|secret|credential|api[_-]?key|Bearer)/i.test(sql), false, 'a demo seed never carries credential material');
  assert.equal(/(dean|loftwah@)/i.test(sql), false, 'the demo stays separate from the owner’s own content');
  // Re-running replaces only this workspace's demonstration stacks.
  assert.match(sql, /DELETE FROM creator_stacks WHERE workspace_id = 'workspace-demo-fictional-0001'/);
});

test('a stack that would not validate is never emitted as a demonstration', () => {
  const trail = DEMO_STACKS[0].document;
  assert.ok(trail.instances.every(instance => instance.id && instance.label));
  for (const stack of DEMO_STACKS) {
    assert.equal(stack.document.version, 1);
    assert.ok(JSON.stringify(stack.document).length < 8000);
  }
});
