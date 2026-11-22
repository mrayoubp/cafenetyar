const MAX = 1_000_000_000,
  LIMIT = 1000,
  DAY = 86400000,
  IRAN = 12600000;
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
const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
const one = (db, sql, ...args) => stmt(db, sql, ...args).first();
const all = async (db, sql, ...args) =>
  (await stmt(db, sql, ...args).all()).results;
const integer = (v, label, min = 0, max = MAX) => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    fail(label + " معتبر نیست.");
  return v;
};
const text = (v, label, max = 120, min = 1) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    fail(label + " معتبر نیست.");
  return v.trim();
};
const requestId = (body) => text(body.requestId, "شناسه درخواست", 100, 16);
const audit = (db, c, action, detail) =>
  stmt(
    db,
    "INSERT INTO inventory_audit(id,cafe_id,actor_id,action,detail,created_at) VALUES(?,?,?,?,?,?)",
    crypto.randomUUID(),
    c.cafe.id,
    c.user.id,
    action,
    JSON.stringify(detail),
    Date.now(),
  );
const itemFor = (x) => ({
  id: x.id,
  title: x.title,
  kind: x.kind,
  unit: x.unit,
  sku: x.sku || "",
  priceToman: x.price_toman,
  costToman: x.cost_toman,
  quantity: x.quantity,
  lowStock: x.low_stock,
  archived: !!x.archived,
  version: x.version,
});
const entryFor = (x) => ({
  id: x.id,
  title: x.title,
  direction: x.direction,
  category: x.category,
  method: x.method,
  amountToman: x.amount_toman,
  discountToman: x.discount_toman,
  note: x.note || null,
  occurredAt: x.occurred_at,
  operatorName: x.operator_name,
  isVoided: x.voided_at !== null,
  createdAt: x.created_at,
  origin: "inventory",
});

export function summarize(entries, now = Date.now()) {
  const start = Math.floor((now + IRAN) / DAY) * DAY - IRAN,
    week = start - 6 * DAY;
  const s = {
    incomeToman: 0,
    expenseToman: 0,
    balanceToman: 0,
    todayIncomeToman: 0,
    todayExpenseToman: 0,
    weekIncomeToman: 0,
    weekExpenseToman: 0,
    count: 0,
    voidedCount: 0,
    limitedTo: LIMIT,
  };
  for (const e of entries) {
    if (e.isVoided) {
      s.voidedCount++;
      continue;
    }
    s.count++;
    const income = e.direction === "income";
    s[income ? "incomeToman" : "expenseToman"] += e.amountToman;
    if (e.occurredAt >= start)
      s[income ? "todayIncomeToman" : "todayExpenseToman"] += e.amountToman;
    if (e.occurredAt >= week)
      s[income ? "weekIncomeToman" : "weekExpenseToman"] += e.amountToman;
  }
  s.balanceToman = s.incomeToman - s.expenseToman;
  return s;
}

export async function handleAccounting(
  request,
  env,
  body = {},
  context = null,
) {
  try {
    const db = env.DB;
    if (!db) fail("دیتابیس حسابداری متصل نیست.", 503);
    if (!["GET", "POST"].includes(request.method))
      return json({ error: "روش درخواست مجاز نیست." }, 405);
    const c = context;
    if(!c?.user?.id || !c.cafe?.id)fail("ابتدا با حساب کافی‌نت وارد شوید.",401);
    if(c.isGuest||c.isBlocked||c.membershipActive===false||c.cafe.status!=="active"||!c.permissions?.includes("accounting.view"))fail("مجوز حسابداری یا فضای کاری فعال لازم است.",403);
    const cafe = c.cafe.id,
      path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/api/accounting") {
      const [rows, catalog, movements, lines] = await Promise.all([
        all(
          db,
          "SELECT * FROM finance_entries WHERE cafe_id=? ORDER BY occurred_at DESC LIMIT ?",
          cafe,
          LIMIT,
        ),
        all(
          db,
          "SELECT * FROM catalog_items WHERE cafe_id=? ORDER BY archived,title LIMIT 2000",
          cafe,
        ),
        all(
          db,
          "SELECT m.*,i.title,i.unit FROM stock_movements m JOIN catalog_items i ON i.id=m.item_id WHERE m.cafe_id=? ORDER BY m.created_at DESC LIMIT 100",
          cafe,
        ),
        all(
          db,
          "SELECT l.* FROM finance_lines l JOIN finance_entries e ON e.id=l.entry_id WHERE e.cafe_id=? ORDER BY e.occurred_at DESC LIMIT 40000",
          cafe,
        ),
      ]);
      const byEntry = new Map();
      for (const l of lines) {
        if (!byEntry.has(l.entry_id)) byEntry.set(l.entry_id, []);
        byEntry.get(l.entry_id).push({
          title: l.title,
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unit_price,
          total: l.line_total,
        });
      }
      const items = [
        ...rows.map((x) => ({
          ...entryFor(x),
          lines: byEntry.get(x.id) || [],
        })),
      ]
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, LIMIT);
      return json({
        items,
        summary: summarize(items),
        catalog: catalog.map(itemFor),
        movements: movements.map((m) => ({
          id: m.id,
          title: m.title,
          unit: m.unit,
          delta: m.delta,
          kind: m.kind,
          reason: m.reason,
          createdAt: m.created_at,
        })),
        canWrite: c.permissions.includes("transactions.write"),
        isOwner: !!c.isOwner,
      });
    }
    if (request.method !== "POST") fail("مسیر پیدا نشد.", 404);
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail("درخواست معتبر نیست.");
    if (!c.permissions.includes("transactions.write"))
      fail("اجازهٔ ثبت یا تغییر اطلاعات مالی را ندارید.", 403);
    if (path === "/api/accounting/catalog") {
      const id = body.id || crypto.randomUUID(),
        before = body.id
          ? await one(
              db,
              "SELECT * FROM catalog_items WHERE id=? AND cafe_id=?",
              id,
              cafe,
            )
          : null;
      if (body.id && !before) fail("کالا یا خدمت پیدا نشد.", 404);
      if (body.archive !== undefined) {
        if (!c.isOwner)
          fail("فقط صاحب کافی‌نت می‌تواند کالا را بایگانی کند.", 403);
        await db.batch([
          stmt(
            db,
            "UPDATE catalog_items SET archived=?,version=version+1,updated_at=? WHERE id=? AND cafe_id=?",
            body.archive ? 1 : 0,
            Date.now(),
            id,
            cafe,
          ),
          audit(db, c, "catalog.archive", { id, archived: !!body.archive }),
        ]);
        return json({ ok: true, id });
      }
      const title = text(body.title, "نام کالا یا خدمت"),
        unit = text(body.unit || "عدد", "واحد", 30),
        sku = body.sku ? text(body.sku, "کد کالا", 60) : null;
      const price = integer(body.priceToman, "قیمت"),
        cost = integer(body.costToman ?? 0, "بهای خرید"),
        low = integer(body.lowStock ?? 5, "حد هشدار");
      if (before) {
        if (body.kind !== before.kind)
          fail("نوع کالای ثبت‌شده قابل تغییر نیست.");
        integer(body.version, "نسخهٔ کالا", 1);
        if (body.version !== before.version)
          fail("این کالا هم‌زمان ویرایش شده؛ صفحه را به‌روز کنید.", 409);
        await db.batch([
          stmt(
            db,
            "UPDATE catalog_items SET title=?,unit=?,sku=?,price_toman=?,cost_toman=?,low_stock=?,version=CASE WHEN version=? THEN version+1 ELSE NULL END,updated_at=? WHERE id=? AND cafe_id=?",
            title,
            unit,
            sku,
            price,
            cost,
            low,
            body.version,
            Date.now(),
            id,
            cafe,
          ),
          audit(db, c, "catalog.update", {
            before: itemFor(before),
            after: { title, unit, sku, price, cost, low },
          }),
        ]);
        return json({ ok: true, id });
      }
      const rid = requestId(body),
        prior = await one(
          db,
          "SELECT * FROM catalog_items WHERE cafe_id=? AND request_id=?",
          cafe,
          rid,
        );
      if (prior) return json({ ok: true, id: prior.id });
      if (!["product", "service"].includes(body.kind))
        fail("نوع کالا یا خدمت معتبر نیست.");
      if (
        (
          await one(
            db,
            "SELECT count(*) AS n FROM catalog_items WHERE cafe_id=?",
            cafe,
          )
        ).n >= 2000
      )
        fail("حداکثر تعداد کالا و خدمت ثبت شده است.");
      const qty =
          body.kind === "product"
            ? integer(body.quantity ?? 0, "موجودی اولیه")
            : 0,
        at = Date.now();
      const statements = [
        stmt(
          db,
          "INSERT INTO catalog_items(id,cafe_id,title,kind,unit,sku,price_toman,cost_toman,quantity,low_stock,request_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          cafe,
          title,
          body.kind,
          unit,
          sku,
          price,
          cost,
          qty,
          low,
          rid,
          at,
          at,
        ),
        audit(db, c, "catalog.create", {
          id,
          title,
          kind: body.kind,
          quantity: qty,
        }),
      ];
      if (qty)
        statements.push(
          stmt(
            db,
            "INSERT INTO stock_movements(id,cafe_id,item_id,delta,kind,reason,actor_id,created_at,request_id) VALUES(?,?,?,?,?,?,?,?,?)",
            crypto.randomUUID(),
            cafe,
            id,
            qty,
            "opening",
            "موجودی اولیه",
            c.user.id,
            at,
            "opening:" + rid,
          ),
        );
      try {
        await db.batch(statements);
      } catch (e) {
        const replay = await one(
          db,
          "SELECT id FROM catalog_items WHERE cafe_id=? AND request_id=?",
          cafe,
          rid,
        );
        if (replay) return json({ ok: true, id: replay.id });
        throw e;
      }
      return json({ ok: true, id });
    }
    if (path === "/api/accounting/stock") {
      const rid = requestId(body),
        prior = await one(
          db,
          "SELECT id FROM stock_movements WHERE cafe_id=? AND request_id=?",
          cafe,
          rid,
        );
      if (prior) {
        const current = await one(
          db,
          "SELECT id,quantity,version FROM catalog_items WHERE id=(SELECT item_id FROM stock_movements WHERE id=?) AND cafe_id=?",
          prior.id,
          cafe,
        );
        return json({
          ok: true,
          itemId: current.id,
          quantity: current.quantity,
          version: current.version,
        });
      }
      const item = await one(
        db,
        "SELECT * FROM catalog_items WHERE id=? AND cafe_id=? AND archived=0",
        body.itemId,
        cafe,
      );
      if (!item || item.kind !== "product") fail("کالای انبار پیدا نشد.", 404);
      const qty = integer(body.quantity, "تعداد", 1),
        reason = text(body.reason, "شرح ورود یا خروج", 300);
      if (!["in", "out"].includes(body.kind))
        fail("نوع گردش انبار معتبر نیست.");
      const delta = body.kind === "in" ? qty : -qty,
        at = Date.now();
      if (item.quantity + delta < 0)
        fail("موجودی کالا برای این خروج کافی نیست.", 409);
      try {
        await db.batch([
          stmt(
            db,
            "INSERT INTO stock_movements(id,cafe_id,item_id,delta,kind,reason,actor_id,created_at,request_id) VALUES(?,?,?,?,?,?,?,?,?)",
            crypto.randomUUID(),
            cafe,
            item.id,
            delta,
            body.kind,
            reason,
            c.user.id,
            at,
            rid,
          ),
          stmt(
            db,
            "UPDATE catalog_items SET quantity=quantity+?,version=version+1,updated_at=? WHERE id=? AND cafe_id=?",
            delta,
            at,
            item.id,
            cafe,
          ),
          audit(db, c, "stock." + body.kind, {
            itemId: item.id,
            delta,
            reason,
          }),
        ]);
      } catch (e) {
        if (
          await one(
            db,
            "SELECT id FROM stock_movements WHERE cafe_id=? AND request_id=?",
            cafe,
            rid,
          )
        ) {
          const current = await one(
            db,
            "SELECT quantity,version FROM catalog_items WHERE id=? AND cafe_id=?",
            item.id,
            cafe,
          );
          return json({
            ok: true,
            itemId: item.id,
            quantity: current.quantity,
            version: current.version,
          });
        }
        throw e;
      }
      const current = await one(
        db,
        "SELECT quantity,version FROM catalog_items WHERE id=? AND cafe_id=?",
        item.id,
        cafe,
      );
      return json({
        ok: true,
        itemId: item.id,
        quantity: current.quantity,
        version: current.version,
      });
    }
    if (path === "/api/accounting/entries") {
      const rid = requestId(body),
        canonical = JSON.stringify({
          title: body.title,
          direction: body.direction,
          category: body.category,
          method: body.method,
          amountToman: body.amountToman,
          discountToman: body.discountToman ?? 0,
          note: body.note || "",
          occurredAt: body.occurredAt ?? null,
          lines: body.lines || [],
        });
      const replay = await one(
        db,
        "SELECT * FROM finance_entries WHERE cafe_id=? AND request_id=?",
        cafe,
        rid,
      );
      if (replay) {
        if (replay.payload !== canonical)
          fail(
            "این شناسهٔ درخواست قبلاً برای تراکنش دیگری استفاده شده است.",
            409,
          );
        return json({ ok: true, transactionId: replay.id });
      }
      const title = text(body.title, "عنوان تراکنش", 120, 3),
        note = text(body.note || "", "یادداشت", 500, 0);
      if (
        !["income", "expense"].includes(body.direction) ||
        !categories.includes(body.category) ||
        !methods.includes(body.method)
      )
        fail("نوع، دسته یا روش پرداخت معتبر نیست.");
      if (body.lines !== undefined && !Array.isArray(body.lines))
        fail("اقلام تراکنش معتبر نیستند.");
      const lines = Array.isArray(body.lines) ? body.lines : [];
      if (lines.length > 40) fail("حداکثر ۴۰ ردیف در یک تراکنش مجاز است.");
      if (body.direction === "expense" && lines.length)
        fail("اقلام فروش فقط برای درآمد ثبت می‌شوند.");
      const discount = integer(body.discountToman ?? 0, "تخفیف"),
        snapshots = [],
        stock = new Map();
      let gross = 0;
      for (const line of lines) {
        const qty = integer(line.quantity, "تعداد", 1, 10000000),
          price = integer(line.unitPrice, "قیمت واحد");
        let item = null;
        if (line.itemId) {
          item = await one(
            db,
            "SELECT * FROM catalog_items WHERE id=? AND cafe_id=? AND archived=0",
            line.itemId,
            cafe,
          );
          if (!item)
            fail("یکی از کالاها دیگر فعال نیست؛ فهرست را به‌روز کنید.", 409);
        }
        const total = qty * price;
        integer(total, "مجموع ردیف");
        gross += total;
        integer(gross, "جمع اقلام");
        snapshots.push({
          itemId: item?.id || null,
          title: item?.title || text(line.title, "نام ردیف"),
          unit: item?.unit || "عدد",
          quantity: qty,
          unitPrice: price,
          total,
        });
        if (item?.kind === "product") {
          const prior = stock.get(item.id);
          stock.set(item.id, { item, quantity: qty + (prior?.quantity || 0) });
        }
      }
      if (!lines.length && discount)
        fail("تخفیف فقط برای تراکنش دارای اقلام قابل ثبت است.");
      const amount = lines.length
        ? integer(gross - discount, "مبلغ نهایی", 1)
        : integer(body.amountToman, "مبلغ", 1);
      if (lines.length && body.amountToman !== amount)
        fail("جمع مبلغ تراکنش با اقلام آن مطابقت ندارد.");
      for (const { item, quantity } of stock.values())
        if (item.quantity < quantity)
          fail("موجودی «" + item.title + "» کافی نیست.", 409);
      const at = Date.now(),
        occurred = integer(
          body.occurredAt ?? at,
          "تاریخ",
          at - 5 * 365 * DAY,
          at + 300000,
        ),
        id = "native:" + crypto.randomUUID();
      const statements = [
        stmt(
          db,
          "INSERT INTO finance_entries(id,cafe_id,created_by,title,direction,category,method,amount_toman,discount_toman,note,occurred_at,operator_name,created_at,request_id,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          cafe,
          c.user.id,
          title,
          body.direction,
          body.category,
          body.method,
          amount,
          discount,
          note,
          occurred,
          c.user.name || "همکار کافی‌نت",
          at,
          rid,
          canonical,
        ),
      ];
      for (const line of snapshots)
        statements.push(
          stmt(
            db,
            "INSERT INTO finance_lines(id,entry_id,item_id,title,unit,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?,?)",
            crypto.randomUUID(),
            id,
            line.itemId,
            line.title,
            line.unit,
            line.quantity,
            line.unitPrice,
            line.total,
          ),
        );
      for (const { item, quantity } of stock.values())
        statements.push(
          stmt(
            db,
            "UPDATE catalog_items SET quantity=quantity-?,version=version+1,updated_at=? WHERE id=? AND cafe_id=?",
            quantity,
            at,
            item.id,
            cafe,
          ),
          stmt(
            db,
            "INSERT INTO stock_movements(id,cafe_id,item_id,delta,kind,reason,entry_id,actor_id,created_at,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
            crypto.randomUUID(),
            cafe,
            item.id,
            -quantity,
            "sale",
            title,
            id,
            c.user.id,
            at,
            "sale:" + rid + ":" + item.id,
          ),
        );
      statements.push(
        audit(db, c, "finance.create", {
          id,
          amount,
          direction: body.direction,
          lines: snapshots,
        }),
      );
      try {
        await db.batch(statements);
      } catch (e) {
        const done = await one(
          db,
          "SELECT id,payload FROM finance_entries WHERE cafe_id=? AND request_id=?",
          cafe,
          rid,
        );
        if (done && done.payload === canonical)
          return json({ ok: true, transactionId: done.id });
        throw e;
      }
      return json({ ok: true, transactionId: id });
    }
    if (path === "/api/accounting/void") {
      if (!c.isOwner)
        fail("فقط صاحب کافی‌نت می‌تواند تراکنش را ابطال کند.", 403);
      const id = text(body.transactionId, "شناسه تراکنش", 100);
      const entry = await one(
        db,
        "SELECT * FROM finance_entries WHERE id=? AND cafe_id=?",
        id,
        cafe,
      );
      if (!entry) fail("تراکنش پیدا نشد.", 404);
      if (entry.voided_at !== null) return json({ ok: true });
      const at = Date.now(),
        sales = await all(
          db,
          "SELECT item_id,-sum(delta) AS quantity FROM stock_movements WHERE cafe_id=? AND entry_id=? AND kind='sale' GROUP BY item_id",
          cafe,
          id,
        );
      const statements = [
        stmt(
          db,
          "INSERT INTO finance_voids(entry_id,cafe_id,created_at) VALUES(?,?,?)",
          id,
          cafe,
          at,
        ),
        stmt(
          db,
          "UPDATE finance_entries SET voided_at=?,voided_by=? WHERE id=? AND cafe_id=?",
          at,
          c.user.id,
          id,
          cafe,
        ),
      ];
      for (const sale of sales)
        statements.push(
          stmt(
            db,
            "UPDATE catalog_items SET quantity=quantity+?,version=version+1,updated_at=? WHERE id=? AND cafe_id=?",
            sale.quantity,
            at,
            sale.item_id,
            cafe,
          ),
          stmt(
            db,
            "INSERT INTO stock_movements(id,cafe_id,item_id,delta,kind,reason,entry_id,actor_id,created_at,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
            crypto.randomUUID(),
            cafe,
            sale.item_id,
            sale.quantity,
            "void",
            "برگشت ابطال: " + entry.title,
            id,
            c.user.id,
            at,
            "void:" + id + ":" + sale.item_id,
          ),
        );
      statements.push(
        audit(db, c, "finance.void", { id, amount: entry.amount_toman }),
      );
      try {
        await db.batch(statements);
      } catch (e) {
        if (
          await one(
            db,
            "SELECT entry_id FROM finance_voids WHERE entry_id=? AND cafe_id=?",
            id,
            cafe,
          )
        )
          return json({ ok: true });
        throw e;
      }
      return json({ ok: true });
    }
    fail("مسیر پیدا نشد.", 404);
  } catch (error) {
    if (error.status) return json({ error: error.message }, error.status);
    if (/constraint|unique/i.test(error.message))
      return json(
        {
          error: new URL(request.url).pathname.endsWith("/catalog")
            ? "کد کالا تکراری است یا کالا هم‌زمان تغییر کرده؛ فهرست را به‌روز کنید."
            : "موجودی کافی نیست یا هم‌زمان تغییر کرده؛ فهرست را به‌روز کنید.",
        },
        409,
      );
    return json({ error: "ثبت اطلاعات انجام نشد؛ دوباره تلاش کنید." }, 500);
  }
}
