import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
export function openDatabase(file, migrationsDir) {
  const path = file === ":memory:" ? file : resolve(file);
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const sqlite = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  sqlite.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)",
  );
  for (const name of readdirSync(migrationsDir)
    .filter((x) => /^\d{4}_.+\.sql$/.test(x))
    .sort()) {
    if (
      sqlite
        .prepare("SELECT name FROM schema_migrations WHERE name=?")
        .get(name)
    )
      continue;
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.exec(readFileSync(resolve(migrationsDir, name), "utf8"));
      sqlite
        .prepare("INSERT INTO schema_migrations VALUES(?,?)")
        .run(name, Date.now());
      sqlite.exec("COMMIT");
    } catch (e) {
      sqlite.exec("ROLLBACK");
      sqlite.close();
      throw e;
    }
  }
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          const statement = sqlite.prepare(sql),
            values = args.map((x) =>
              x === undefined ? null : typeof x === "boolean" ? Number(x) : x,
            );
          const execute = () => {
            const result = statement.run(...values);
            return { meta: { changes: Number(result.changes) } };
          };
          return {
            async first() {
              return statement.get(...values) || null;
            },
            async all() {
              return { results: statement.all(...values) };
            },
            async run() {
              return execute();
            },
            _execute: execute,
          };
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((x) => x._execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { sqlite, DB, path, close: () => sqlite.close() };
}
