import { query, all, one, fail } from "./identity.mjs";
export const BACKUP_TABLES = [
  "accounts",
  "account_credentials",
  "mfa",
  "cafes",
  "cafe_memberships",
  "site_logins",
  "settings",
  "content",
  "library_preferences",
  "library_requests",
  "transactions",
  "tickets",
  "ticket_messages",
  "catalog_items",
  "finance_entries",
  "finance_lines",
  "stock_movements",
  "finance_voids",
  "inventory_audit",
  "audit",
  "rate_services",
  "rate_overrides",
  "rate_history",
  "rate_suggestions",
  "agent_conversations",
  "agent_messages",
  "import_records",
];
export async function exportBackup(db) {
  const tables = {};
  for (const name of BACKUP_TABLES) {
    const rows = await all(db, "SELECT * FROM " + name + " LIMIT 10001");
    if (rows.length > 10000)
      fail(
        "حجم این جدول برای خروجی وب زیاد است؛ از پشتیبان SQLite روی سرور استفاده کنید.",
        413,
      );
    tables[name] = rows;
  }
  return {
    format: "cafenetyar-portable",
    version: 1,
    createdAt: new Date().toISOString(),
    tables,
  };
}
export async function importLedger(db, user, body, audit) {
  const membership = await one(
    db,
    "SELECT m.*,c.status FROM cafe_memberships m JOIN cafes c ON c.id=m.cafe_id WHERE m.user_id=?",
    user.id,
  );
  if (!membership || membership.kind !== "owner")
    fail("فضای کاری مالک لازم است.", 403);
  if (body.cafeId && body.cafeId !== membership.cafe_id)
    fail("انتقال فقط به فضای کاری خود مالک مجاز است.", 403);
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items || items.length > 250) fail("هر مرحله حداکثر ۲۵۰ سند می‌پذیرد.");
  const statements = [],
    seen = new Set();
  let imported = 0;
  for (const x of items) {
    const sourceId = String(x.id || x._id || "");
    if (!sourceId || sourceId.length > 120) fail("شناسهٔ سند قبلی معتبر نیست.");
    const sourceKey = membership.cafe_id + ":" + sourceId;
    if (
      seen.has(sourceKey) ||
      (await one(
        db,
        "SELECT source_id FROM import_records WHERE source_id=?",
        sourceKey,
      ))
    )
      continue;
    seen.add(sourceKey);
    if (
      !["income", "expense"].includes(x.direction) ||
      !Number.isSafeInteger(x.amountToman) ||
      x.amountToman < 1 ||
      x.amountToman > 1000000000 ||
      typeof x.title !== "string" ||
      x.title.trim().length < 1 ||
      x.title.length > 120 ||
      !Number.isSafeInteger(x.occurredAt) ||
      x.occurredAt < 0
    )
      fail("مبلغ، عنوان، نوع یا تاریخ یکی از اسناد معتبر نیست.");
    const categories = [
      "شارژ و خدمات",
      "اینترنت",
      "بوفه",
      "تجهیزات",
      "حقوق و دستمزد",
      "اجاره",
      "قبوض",
      "سایر",
    ];
    const methods = ["نقدی", "کارت به کارت", "درگاه پرداخت", "کیف پول", "سایر"];
    if (!categories.includes(x.category) || !methods.includes(x.method))
      fail("دسته یا روش پرداخت سند ناشناخته است؛ فایل را بررسی کنید.");
    const id = "native:import:" + crypto.randomUUID(),
      t = Date.now();
    statements.push(
      query(
        db,
        "INSERT INTO finance_entries(id,cafe_id,created_by,title,direction,category,method,amount_toman,discount_toman,note,occurred_at,operator_name,created_at,voided_at,request_id,payload) VALUES(?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?)",
        id,
        membership.cafe_id,
        user.id,
        x.title.trim(),
        x.direction,
        x.category,
        x.method,
        x.amountToman,
        String(x.note || "").slice(0, 2000),
        x.occurredAt,
        String(x.operatorName || user.name).slice(0, 100),
        Number.isSafeInteger(x.createdAt) ? x.createdAt : t,
        x.isVoided ? t : null,
        "import:" + sourceKey,
        JSON.stringify({ sourceId, imported: true }),
      ),
      query(
        db,
        "INSERT INTO import_records VALUES(?,?,?,?)",
        sourceKey,
        membership.cafe_id,
        user.id,
        t,
      ),
    );
    imported++;
  }
  if (statements.length)
    await db.batch([
      ...statements,
      audit(user, "ledger.import", membership.cafe_id, { count: imported }),
    ]);
  return { ok: true, imported, skipped: items.length - imported };
}
