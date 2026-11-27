import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { advanceSpin, createSpin, purgeExpiredSpins, readSpin } from '../src/lib/spin-session.ts';
import { spinProgress, unbiasedIndex, validateSpinConfig, verifySpin } from '../src/lib/spin-protocol.mjs';

const now = Date.parse('2026-11-27T08:00:00Z');
const config = { question: 'What should we play?', entries: ['Chess', 'Codenames'], bestOf: 3 };

function database(test) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0045_spin_sessions.sql', import.meta.url), 'utf8'));
  test.after(() => db.close());
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        bind(...values) {
          return {
            first: async () => stmt.get(...values) ?? null,
            run: async () => ({ meta: { changes: Number(stmt.run(...values).changes) } }),
          };
        },
      };
    },
  };
}

test('series rules, duplicate labels and rejection sampling', () => {
  assert.equal(validateSpinConfig({ ...config, entries: ['Chess', 'chess'] }), null);
  assert.equal(validateSpinConfig({ ...config, bestOf: 4 }), null);
  assert.equal(spinProgress(config, [{ winner: 1 }, { winner: 1 }]).winner, 1);
  const three = { ...config, entries: ['Chess', 'Codenames', 'Jackbox'] };
  const rounds = [{ winner: 1 }, { winner: 0 }, { winner: 2 }];
  assert.deepEqual(spinProgress(three, rounds), { totals: [1, 1, 1], eligible: [0, 1, 2], winner: -1, tieBreak: true });
  assert.equal(spinProgress(three, [...rounds, { winner: 2 }]).winner, 2);
  assert.equal(unbiasedIndex(0xffffffff, 3), -1);
  assert.equal(unbiasedIndex(0xfffffffe, 3), 2);
});

test('a session reveals no seed before completion and concurrent requests append one draw', async ctx => {
  const db = database(ctx);
  const { owner, session } = await createSpin(db, config, now);
  assert.equal('seed' in session, false);
  assert.equal('owner' in await readSpin(db, session.id, now), false);
  assert.equal((await advanceSpin(db, session.id, 'bad', 0, false, now)).status, 403);
  const attempts = await Promise.all(Array.from({ length: 12 }, () =>
    advanceSpin(db, session.id, owner, 0, false, now)));
  assert.ok(attempts.every(result => result.session.rounds.length === 1));
  assert.ok(attempts.every(result => result.session.rounds[0].winner === attempts[0].session.rounds[0].winner));
  let next = await readSpin(db, session.id, now);
  assert.equal(next.configHash, session.configHash);
  while (next.status === 'open') next = (await advanceSpin(db, session.id, owner, next.revision, false, now)).session;
  assert.equal(next.status, 'completed');
  assert.equal(await verifySpin(next), true);
  assert.equal(await verifySpin({ ...next, config: { ...next.config, entries: ['Chess', 'Tacos'] } }), false);
  assert.equal(await verifySpin({ ...next, rounds: [{ ...next.rounds[0], winner: 1 - next.rounds[0].winner }, ...next.rounds.slice(1)] }), false);
  assert.deepEqual((await advanceSpin(db, session.id, owner, next.revision, false, now)).session, next);
});

test('abandonment closes the wheel, reveals its seed and never extends retention', async ctx => {
  const db = database(ctx);
  const { owner, session } = await createSpin(db, config, now);
  const next = (await advanceSpin(db, session.id, owner, 0, true, now)).session;
  assert.equal(next.status, 'abandoned');
  assert.equal(await verifySpin(next), true);
  assert.deepEqual((await advanceSpin(db, session.id, owner, 1, false, now)).session, next);
  assert.equal(await readSpin(db, session.id, Date.parse(next.expiresAt)), null);
  await purgeExpiredSpins(db, Date.parse(next.expiresAt));
  assert.equal(await readSpin(db, session.id, now), null);
});
