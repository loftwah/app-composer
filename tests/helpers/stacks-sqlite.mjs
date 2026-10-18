import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// D1 enforces foreign keys and executes batch statements in one transaction.
// Use real SQLite for both, including constraints, rollback and RETURNING.
const fixture = String.raw`import sqlite3,json,sys
p=json.load(sys.stdin)
db=sqlite3.connect(p['path'])
db.execute('PRAGMA foreign_keys=ON')
db.row_factory=sqlite3.Row
try:
    if p['mode']=='schema':
        db.executescript(p['schema'])
        print('{}')
    else:
        results=[]
        observations=[]
        db.execute('BEGIN IMMEDIATE' if p['mode']=='batch' else 'BEGIN')
        for statement in p['statements']:
            cur=db.execute(statement['sql'],statement['params'])
            rows=[dict(row) for row in cur.fetchall()] if cur.description else []
            results.append({'success':True,'meta':{'changes':max(cur.rowcount,0)},'results':rows})
            if p.get('observe'):
                reader=sqlite3.connect(p['path'])
                reader.row_factory=sqlite3.Row
                observations.append([dict(row) for row in reader.execute(p['observe']['sql'],p['observe']['params']).fetchall()])
                reader.close()
        db.commit()
        print(json.dumps({'results':results,'observations':observations}))
except Exception as e:
    db.rollback()
    print(json.dumps({'error':str(e)}))
finally:
    db.close()
`;

export const migration = name => readFileSync(new URL('../../migrations/' + name, import.meta.url), 'utf8');
export const stackSchema = () => ['0003_stacks.sql', '0004_stack_publications.sql', '0005_stack_publications_backfill.sql', '0006_stack_resources.sql'].map(migration).join('\n');

export function sqliteD1({ schema = stackSchema(), interleave, afterBatch } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'composer-stacks-'));
  const path = join(dir, 'stacks.db');
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  const call = payload => {
    const data = JSON.parse(execFileSync('python3', ['-c', fixture], {
      input: JSON.stringify({ path, ...payload }), encoding: 'utf8',
    }));
    if (data.error) throw Error(data.error);
    return data;
  };
  try { call({ mode: 'schema', schema }); } catch (error) { cleanup(); throw error; }
  const db = {
    path,
    cleanup,
    observations: [],
    observe: null,
    migrate(schema) { call({ mode: 'schema', schema }); },
    prepare(sql) {
      const prepared = params => ({
        sql,
        params,
        bind(...values) { return prepared(values); },
        async all() {
          if (interleave) await interleave(sql, params);
          return call({ mode: 'single', statements: [{ sql, params }] }).results[0];
        },
        async first() { return (await this.all()).results[0] ?? null; },
        async run() { return this.all(); },
      });
      return prepared([]);
    },
    async batch(statements) {
      // A competing request can land before the transaction begins, never in
      // the middle of its writes. Independent readers below inspect every gap.
      if (interleave) for (const { sql, params } of statements) await interleave(sql, params);
      const data = call({ mode: 'batch', statements, observe: db.observe });
      db.observations.push(...data.observations);
      if (afterBatch) await afterBatch(statements);
      return data.results;
    },
  };
  return db;
}
