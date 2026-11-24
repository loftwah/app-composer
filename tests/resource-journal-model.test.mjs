import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { migration, stackSchema } from './helpers/stacks-sqlite.mjs';

const recovery = '0024_resource_operation_recovery.sql';
const historical = process.env.COMPOSER_RESOURCE_JOURNAL_HISTORICAL === '1';
const settled = ['confirmed', 'refused'];
const afterRecovery = historical ? settled : [...settled, 'abandoned'];

function checkJournal(resources) {
  const db = new DatabaseSync(':memory:');
  try {
    return exploreJournal(db, resources);
  } finally {
    db.close();
  }
}

function exploreJournal(db, resources) {
  db.exec(stackSchema({ recovery: false }));
  if (!historical) db.exec(migration(recovery));
  db.exec("INSERT INTO creator_workspaces(id,name) VALUES('fixture','Fictional model')");
  const addResource = db.prepare(`
    INSERT INTO creator_app_resources (id,workspace_id,app,account_id,environment,target)
    VALUES (?,'fixture','guestbook','fixture','test','https://example.test')`);
  for (const resource of new Set(resources)) addResource.run(resource);

  const findOpen = db.prepare(`
    SELECT id,resource_id,state FROM creator_resource_operations
    WHERE state IN ('pending','unknown') AND (? IS NULL OR resource_id=?) ORDER BY id`);
  const reserve = db.prepare(`
    INSERT OR IGNORE INTO creator_resource_operations
      (id,resource_id,stack_id,instance_id,action,state,source_revision,request_json)
    VALUES (?,?,?,'instance','stage','pending','fixture','{}')`);
  const settle = db.prepare('UPDATE creator_resource_operations SET state=? WHERE id=?');
  const phases = ['start', 'start'];
  const trace = [];
  const visited = new Set();
  const covered = new Set();
  let maxOpen = 0;

  function move(actor, next) {
    const previous = phases[actor];
    phases[actor] = next;
    covered.add(next);
    trace.push(`stack ${actor + 1}: ${next}`);
    explore();
    trace.pop();
    phases[actor] = previous;
  }

  function explore() {
    const open = findOpen.all(null, null);
    maxOpen = Math.max(open.length, maxOpen);
    assert.equal(open.length, new Set(open.map(row => row.resource_id)).size,
      `Two operations stayed open on one resource: ${trace.join(' → ')}`);
    const key = phases.join(',');
    if (visited.has(key)) return;
    visited.add(key);
    for (const [actor, phase] of phases.entries()) {
      const resource = resources[actor];
      const id = `operation-${actor + 1}`;
      const stack = `stack-${actor + 1}`;
      db.exec('SAVEPOINT transition');
      if (phase === 'start') {
        move(actor, findOpen.get(resource, resource) ? 'found open' : 'read free');
      } else if (phase === 'read free') {
        move(actor, reserve.run(id, resource, stack).changes ? 'pending' : 'reservation refused');
      } else if (phase === 'pending' || phase === 'unknown') {
        const outcomes = phase === 'pending' ? ['unknown', ...settled] : afterRecovery;
        for (const outcome of outcomes) {
          settle.run(outcome, id);
          move(actor, outcome);
          db.exec('ROLLBACK TO transition');
        }
      }
      db.exec('ROLLBACK TO transition; RELEASE transition');
    }
  }

  explore();
  return { visited: visited.size, covered, maxOpen };
}

test('all schedules for two stacks sharing a resource leave at most one open journal operation', (t) => {
  const result = checkJournal(['shared', 'shared']);
  assert.equal(result.maxOpen, 1);
  for (const phase of ['found open', 'reservation refused', 'unknown', ...afterRecovery]) assert.ok(result.covered.has(phase), phase);
  t.diagnostic(`${result.visited} distinct states explored`);
});

test('the same journal lets distinct resources hold open operations concurrently', (t) => {
  const result = checkJournal(['first', 'second']);
  assert.equal(result.maxOpen, 2);
  t.diagnostic(`${result.visited} distinct states explored`);
});

test('journal upgrades preserve the exact linked outcome intents', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(stackSchema({ recovery: false }));
    db.exec(`
      INSERT INTO creator_workspaces (id,name) VALUES ('workspace','Fictional');
      INSERT INTO creator_stacks (id,workspace_id,slug,name,draft_json)
        VALUES ('stack','workspace','fictional','Fictional','{}');
      INSERT INTO creator_app_resources (id,workspace_id,app,account_id,environment,target)
        VALUES ('resource','workspace','guestbook','fixture','test','https://example.test');
      INSERT INTO creator_resource_operations
        (id,resource_id,stack_id,instance_id,action,state,source_revision,request_json)
        VALUES ('operation','resource','stack','instance','moderate','unknown','source','{}');
      INSERT INTO creator_outcome_intents
        (operation_id,workspace_id,stack_id,instance_id,event,expected_version,request_digest)
        VALUES ('operation','workspace','stack','instance','postcard_approved',7,printf('%064d',15));
    `);
    const intents = db.prepare('SELECT * FROM creator_outcome_intents');
    const before = intents.all();
    assert.equal(before.length, 1);
    db.exec(migration(recovery));
    assert.deepEqual(intents.all(), before, 'the journal rebuild cascaded away the outcome intent');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.exec("DELETE FROM creator_resource_operations WHERE id='operation'");
    assert.deepEqual(intents.all(), [], 'a real operation deletion still cascades to its intent');
  } finally {
    db.close();
  }
});
