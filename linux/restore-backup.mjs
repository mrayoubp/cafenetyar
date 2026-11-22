import { readFileSync } from "node:fs";
import { database } from "./server.mjs";
import { BACKUP_TABLES } from "./backup-format.mjs";
if (!process.argv[2]) throw new Error("مسیر فایل JSON پشتیبان لازم است.");
const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (data.format !== "cafenetyar-portable" || data.version !== 1 || !data.tables)
  throw new Error("قالب پشتیبان معتبر نیست.");
const store = database();
try {
  for (const name of BACKUP_TABLES)
    if (store.sqlite.prepare("SELECT count(*) AS n FROM " + name).get().n > 0)
      throw new Error("دیتابیس مقصد خالی نیست؛ فایل DB_FILE تازه انتخاب کنید.");
  store.sqlite.exec("BEGIN IMMEDIATE");
  try {
    for (const name of BACKUP_TABLES) {
      const rows = data.tables[name] || [];
      if (!Array.isArray(rows)) throw new Error("جدول پشتیبان معتبر نیست.");
      const columns = new Set(
        store.sqlite
          .prepare("PRAGMA table_info(" + name + ")")
          .all()
          .map((x) => x.name),
      );
      for (const row of rows) {
        const keys = Object.keys(row);
        if (!keys.length || keys.some((k) => !columns.has(k)))
          throw new Error("ستون ناشناخته در " + name);
        const statement = store.sqlite.prepare(
          "INSERT INTO " +
            name +
            "(" +
            keys.map((k) => '"' + k + '"').join(",") +
            ") VALUES(" +
            keys.map(() => "?").join(",") +
            ")",
        );
        statement.run(...keys.map((k) => row[k]));
      }
    }
    store.sqlite.exec("COMMIT");
    console.log(
      "پشتیبان کامل وارد شد. نشست‌های مرورگر منتقل نمی‌شوند؛ دوباره وارد شوید.",
    );
  } catch (error) {
    store.sqlite.exec("ROLLBACK");
    throw error;
  }
} finally {
  store.close();
}
