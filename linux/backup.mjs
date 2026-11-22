import { backup } from "node:sqlite";
import { mkdirSync, chmodSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { database } from "./server.mjs";
const target = resolve(
  process.argv[2] ||
    "./backups/cafenetyar-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".sqlite",
);
if (existsSync(target)) throw new Error("فایل خروجی از قبل وجود دارد.");
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
const store = database();
try {
  await backup(store.sqlite, target);
  chmodSync(target, 0o600);
  console.log("پشتیبان سازگار SQLite ذخیره شد: " + target);
} finally {
  store.close();
}
