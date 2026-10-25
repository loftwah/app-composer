// A tiny local D1-compatible adapter for the local-first proposal CLI.
//
// This is deliberately not a Worker. It opens one explicitly selected SQLite
// file, applies the maintained forward migrations once, and exposes only the
// D1 methods the proposal store uses. It grants no network or deploy authority.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0003_stacks.sql",
  "0004_stack_publications.sql",
  "0008_workspace_access.sql",
  "0016_agent_proposals.sql",
];

function statement(sqlite, sql, params = []) {
  return {
    sql,
    params,
    bind(...values) {
      return statement(sqlite, sql, values);
    },
    async first() {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...params) };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(result.changes) } };
    },
  };
}

export function openLocalDatabase(path) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  const sqlite = new DatabaseSync(absolute);
  sqlite.exec("PRAGMA foreign_keys=ON");
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS _composer_local_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  for (const file of migrations) {
    const applied = sqlite
      .prepare("SELECT version FROM _composer_local_migrations WHERE version=?")
      .get(file);
    if (applied) continue;
    sqlite.exec(readFileSync(resolve(here, "../../migrations", file), "utf8"));
    sqlite
      .prepare(
        "INSERT INTO _composer_local_migrations (version,applied_at) VALUES (?,?)",
      )
      .run(file, new Date().toISOString());
  }
  const db = {
    prepare(sql) {
      return statement(sqlite, sql);
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((entry) => {
          if (/^\s*SELECT/i.test(entry.sql))
            return {
              success: true,
              results: sqlite.prepare(entry.sql).all(...entry.params),
            };
          const result = sqlite.prepare(entry.sql).run(...entry.params);
          return {
            success: true,
            results: [],
            meta: { changes: Number(result.changes) },
          };
        });
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return {
    db,
    sqlite,
    path: absolute,
    close() {
      sqlite.close();
    },
  };
}

export function ensureWorkspace(sqlite, id, name) {
  const existing = sqlite
    .prepare("SELECT id,name FROM creator_workspaces WHERE id=?")
    .get(id);
  if (existing) return existing;
  sqlite
    .prepare("INSERT INTO creator_workspaces (id,name) VALUES (?,?)")
    .run(id, name);
  return { id, name };
}
