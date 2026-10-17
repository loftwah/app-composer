import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  workspaceForUser, createStack, saveStack, publishStack, publicStack,
} from '../src/lib/stacks.mjs';

// Real SQLite behind a D1-shaped shim, with one extra control the earlier
// suites did not need: a hook that can run a competing request in the window
// between a read and its guarded UPDATE. That is the interleaving the previous
// tests missed, and the one the correctness defects actually live in.
const fixture = String.raw`import sqlite3,json,sys
p=json.load(sys.stdin)
db=sqlite3.connect(p['path'])
db.executescript(p['schema'])
db.row_factory=sqlite3.Row
try:
    cur=db.execute(p['sql'],p['params'])
    if p['mode']=='run':
        db.commit();print(json.dumps({'success':True,'meta':{'changes':cur.rowcount}}))
    elif p['mode']=='first':
        row=cur.fetchone();print(json.dumps({'row':dict(row) if row else None}))
    else:
        print(json.dumps({'rows':[dict(r) for r in cur.fetchall()]}))
except Exception as e:
    print(json.dumps({'error':str(e)}))
`;

function sqliteD1({interleave} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'composer-stacks-defects-'));
  const path = join(dir, 'stacks.db');
  const schema = readFileSync(new URL('../migrations/0003_stacks.sql', import.meta.url), 'utf8')
    + '\n' + readFileSync(new URL('../migrations/0004_stack_publications.sql', import.meta.url), 'utf8');
  const call = (mode, sql, params) => {
    const output = execFileSync('python3', ['-c', fixture], { input: JSON.stringify({ path, schema, sql, params, mode }), encoding: 'utf8' });
    const data = JSON.parse(output);
    if (data.error) throw Error(data.error);
    return data;
  };
  const db = {
    path,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() { return call('first', sql, params).row ?? null; },
            async all() { return { results: call('all', sql, params).rows }; },
            async run() {
              // The competing writer lands after this request read but before
              // its guarded UPDATE, so the UPDATE matches zero rows.
              if (interleave) await interleave(sql, params);
              return call('run', sql, params);
            },
          };
        },
      };
    },
  };
  return db;
}

const alice = { id: 'user-alice-0001', name: 'Alice', role: 50 };
const sample = name => ({ version: 1, name, description: 'Two useful apps', theme: 'midnight', instances: [{ id: 'aaaaaaaa-1111-2222-3333-444444444444', app: 'guestbook', label: 'Guestbook', caption: '', visible: true }] });

test('A: an unpublished rename never reaches public metadata', async () => {
  const db = sqliteD1();
  try {
    const space = await workspaceForUser(db, alice);
    const stack = await createStack(db, space.id, 'Public original');
    await saveStack(db, space.id, stack.id, sample('Public original'), stack.revision);
    const published = await publishStack(db, space.id, stack.id, 2);
    assert.equal(published.publishedRevision, 2);
    assert.equal((await publicStack(db, 'public-original')).name, 'Public original');

    // A private draft rename, never republished.
    await saveStack(db, space.id, stack.id, { ...sample('SECRET UNPUBLISHED TITLE'), description: 'SECRET COPY' }, 2);
    const after = await publicStack(db, 'public-original');
    assert.equal(after.name, 'Public original', 'public name must come from the published snapshot');
    assert.equal(after.document.name, 'Public original');
    assert.equal(after.document.description, 'Two useful apps');
    assert.equal(JSON.stringify(after).includes('SECRET'), false, 'no draft field may leak');
  } finally {
    db.cleanup();
  }
});

test('B: a save that loses the guarded write is a conflict, never a forged success', async () => {
  let ran = false;
  const db = sqliteD1({
    interleave: async (sql, params) => {
      if (!ran && sql.includes('UPDATE creator_stacks SET draft_json') && params[params.length - 1] === 2) {
        ran = true;
        await db.prepare('UPDATE creator_stacks SET draft_json = ?, name = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ?')
          .bind(JSON.stringify({...sample('Race'), description: 'competitor'}), 'Race', stack.id, space.id, 2).run();
      }
    },
  });
  const space = await workspaceForUser(db, alice);
  const stack = await createStack(db, space.id, 'Race');
  try {
    await saveStack(db, space.id, stack.id, sample('Race'), stack.revision); // revision 2
    await assert.rejects(
      saveStack(db, space.id, stack.id, { ...sample('Race'), description: 'loser' }, 2),
      error => error.code === 'CONFLICT',
      'a zero-row guarded write must not be acknowledged as success',
    );
    const after = await db.prepare('SELECT revision, draft_json FROM creator_stacks WHERE id = ?').bind(stack.id).first();
    assert.equal(JSON.parse(after.draft_json).description, 'competitor', 'the competitor work is preserved');
    assert.equal(JSON.parse(after.draft_json).description === 'loser', false, 'the losing write never lands');
  } finally {
    db.cleanup();
  }
});

test('C: a publish that loses the guarded write is a conflict and never turns the interface green', async () => {
  let ran = false;
  const db = sqliteD1({
    interleave: async (sql, params) => {
      if (!ran && sql.includes("SET status = 'published'")) {
        ran = true;
        await db.prepare('UPDATE creator_stacks SET draft_json = ?, name = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ?')
          .bind(JSON.stringify(sample('Publish race')), 'Publish race', stack.id, space.id, 2).run();
      }
    },
  });
  const space = await workspaceForUser(db, alice);
  const stack = await createStack(db, space.id, 'Publish race');
  try {
    await saveStack(db, space.id, stack.id, sample('Publish race'), stack.revision); // revision 2
    await assert.rejects(
      publishStack(db, space.id, stack.id, 2),
      error => error.code === 'CONFLICT',
      'a zero-row publish must not report success',
    );
    assert.equal(await publicStack(db, 'publish-race'), null, 'nothing was published');
  } finally {
    db.cleanup();
  }
});

test('D: concurrent bootstrap creates exactly one personal workspace', async () => {
  const db = sqliteD1();
  try {
    const [a, b] = await Promise.all([workspaceForUser(db, alice), workspaceForUser(db, alice)]);
    assert.equal(a.id, b.id, 'simultaneous bootstrap must converge on one workspace');
    const rows = await db.prepare('SELECT id FROM creator_workspaces').bind().all();
    assert.equal(rows.results.length, 1);
    const members = await db.prepare('SELECT workspace_id, user_id, role FROM creator_members').bind().all();
    assert.equal(members.results.length, 1);
    assert.equal(members.results[0].role, 'owner');
  } finally {
    db.cleanup();
  }
});
