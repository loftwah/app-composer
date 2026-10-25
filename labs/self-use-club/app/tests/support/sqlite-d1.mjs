// Minimal D1 adapter over node:sqlite for focused Worker tests.
// It supports only the statement methods this app actually uses.
import { DatabaseSync } from 'node:sqlite';

function statement(db, sql, params) {
  const prepared = db.prepare(sql);
  return {
    all: () => ({ results: prepared.all(...params), success: true, meta: {} }),
    first: () => prepared.get(...params) ?? null,
    run: () => {
      const result = prepared.run(...params);
      return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) }, results: [] };
    },
  };
}

export function createD1(path = ':memory:') {
  const db = new DatabaseSync(path);
  return {
    raw: db,
    prepare(sql) {
      return {
        bind(...params) {
          return statement(db, sql, params);
        },
        ...statement(db, sql, []),
      };
    },
    exec(sql) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
    close() {
      db.close();
    },
  };
}

export function applyFile(d1, path, readFile) {
  d1.exec(readFile(path, 'utf8'));
}
