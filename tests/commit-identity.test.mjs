import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyIdentity,trailerIdentities,checkMessage} from '../scripts/commit-identity.mjs';

test('an approved owner or worker identity passes', () => {
  assert.equal(classifyIdentity({name:'Dean Lofts',email:'dean@deanlofts.xyz'}).level,'ok');
  assert.equal(classifyIdentity({name:'Worker',email:'worker@minimax.local'}).level,'ok');
  assert.equal(classifyIdentity({name:'Dean',email:'1234567+loftwah@users.noreply.github.com'}).level,'ok');
});

test('the Lane E incident cannot recur through an invented noreply address', () => {
  const result = classifyIdentity({name:'OpenCode Lane E',email:'lane-e@users.noreply.github.com'});
  assert.equal(result.level,'block');
  assert.match(result.reason,/attributed to a real stranger/);
  assert.equal(classifyIdentity({name:'Lane E',email:'lane.e@users.noreply.github.com'}).level,'block');
});

test('a lane name is not an identity', () => {
  assert.equal(classifyIdentity({name:'Lane E',email:'lane-e@example.com'}).level,'block');
  assert.equal(classifyIdentity({name:'Worker',email:'worker@minimax.local'}).level,'ok');
});

test('missing or placeholder addresses are caught without blocking ordinary addresses', () => {
  assert.equal(classifyIdentity({name:'Someone',email:''}).level,'block');
  assert.equal(classifyIdentity({name:'Someone',email:'ci@localhost'}).level,'warn');
  assert.equal(classifyIdentity({name:'Someone',email:'dev@example.com'}).level,'warn');
  assert.equal(classifyIdentity({name:'Someone',email:'dev@studio.test'}).level,'ok');
});

test('only authorship trailers are read, and a fabricated one is blocked', () => {
  const message = `Add the thing (#1)

Body text mentioning Co-authored-by: nobody <nobody@example.com> inline.

Co-authored-by: Lane E <lane-e@users.noreply.github.com>
Signed-off-by: Worker <worker@minimax.local>`;
  const trailers = trailerIdentities(message);
  assert.deepEqual(trailers.map(t=>t.email),['lane-e@users.noreply.github.com','worker@minimax.local']);
  const problems = checkMessage('Add the thing (#1)\n\nCo-authored-by: Lane E <lane-e@users.noreply.github.com>',{name:'Worker',email:'worker@minimax.local'});
  assert.equal(problems.length,1);
  assert.match(problems[0].who,/lane-e/);
});

test('a clean message with the approved author has no problems', () => {
  assert.deepEqual(checkMessage('Add the thing (#1)\n',{name:'Worker',email:'worker@minimax.local'}),[]);
});
