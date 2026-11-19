import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleAccounting, summarize } from "./accounting.mjs";
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of [
    "0000_native",
    "0001_content_metadata",
    "0002_library_preferences",
    "0003_accounting_inventory",
  ])
    sqlite.exec(
      readFileSync(
        new URL("../drizzle/" + name + ".sql", import.meta.url),
        "utf8",
      ),
    );
  let queue = Promise.resolve();
  const DB = {
    prepare(sql) {
      return {
        bind(...v) {
          const s = sqlite.prepare(sql);
          return {
            async first() {
              return s.get(...v) ?? null;
            },
            async all() {
              return { results: s.all(...v) };
            },
            async run() {
              const r = s.run(...v);
              return { meta: { changes: Number(r.changes) } };
            },
          };
        },
      };
    },
    batch(queries) {
      const result = queue.then(async () => {
        sqlite.exec("BEGIN");
        try {
          const out = [];
          for (const q of queries) out.push(await q.run());
          sqlite.exec("COMMIT");
          return out;
        } catch (e) {
          sqlite.exec("ROLLBACK");
          throw e;
        }
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  const users = {
    owner: {
      user: { id: "u1", name: "مالک" },
      cafe: { id: "c1", status: "active" },
      permissions: ["accounting.view", "transactions.write"],
      isOwner: true,
      membershipActive: true,
    },
    other: {
      user: { id: "u2", name: "دیگری" },
      cafe: { id: "c2", status: "active" },
      permissions: ["accounting.view", "transactions.write"],
      isOwner: true,
    },
    staff: {
      user: { id: "u3" },
      cafe: { id: "c1", status: "active" },
      permissions: ["accounting.view", "transactions.write"],
      isOwner: false,
    },
    read: {
      user: { id: "u4" },
      cafe: { id: "c1", status: "active" },
      permissions: ["accounting.view"],
      isOwner: false,
    },
  };
  const legacy = {
    items: [
      {
        id: "legacy-entry",
        title: "تراکنش قبلی",
        direction: "income",
        amountToman: 1000,
        category: "سایر",
        method: "نقدی",
        occurredAt: Date.now(),
        createdAt: Date.now(),
        operatorName: "مالک",
        isVoided: false,
      },
    ],
  };
  const calls = [];
  const remote = async (url, options) => {
    assert.ok(url.startsWith("https://striped-cobra-115.convex.cloud/api/"));
    const args = JSON.parse(options.body),
      who = options.headers.Authorization.replace("Bearer ", "");
    calls.push({ url, args, who });
    if (args.path === "tenancy:myContext")
      return Response.json({ status: "success", value: users[who] || null });
    if (args.path === "accounting:list")
      return Response.json({
        status: "success",
        value: who === "other" ? { items: [] } : legacy,
      });
    if (args.path === "accounting:voidTransaction") {
      legacy.items[0].isVoided = true;
      return Response.json({ status: "success", value: { ok: true } });
    }
    return Response.json({ status: "error" });
  };
  async function request(path = "", body, who = "owner") {
    return handleAccounting(
      new Request("https://test.site/api/accounting" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: who ? { Authorization: "Bearer " + who } : {},
      }),
      { DB },
      body,
      remote,
    );
  }
  return { sqlite, DB, users, legacy, calls, request };
}
const rid = () => crypto.randomUUID();
async function product(f, changes = {}, who = "owner") {
  const r = await f.request(
    "/catalog",
    {
      requestId: rid(),
      title: "کاغذ A4",
      kind: "product",
      unit: "برگ",
      priceToman: 10000,
      costToman: 5000,
      quantity: 10,
      lowStock: 2,
      ...changes,
    },
    who,
  );
  assert.equal(r.status, 200, await r.clone().text());
  return (await r.json()).id;
}
const entry = (changes = {}) => ({
  requestId: rid(),
  title: "کار چاپ مشتری",
  direction: "income",
  category: "شارژ و خدمات",
  method: "نقدی",
  amountToman: 20000,
  lines: [],
  ...changes,
});
const sale = (id, changes = {}) =>
  entry({
    lines: [{ itemId: id, title: "کاغذ A4", quantity: 2, unitPrice: 10000 }],
    ...changes,
  });

test("ledger requires verified cafe identity, preserves legacy rows, and rejects blocked or disabled accounts", async () => {
  const f = fixture();
  assert.equal((await f.request("", undefined, null)).status, 401);
  assert.equal((await f.request("", undefined, "unknown")).status, 403);
  for (const change of [
    { isBlocked: true },
    { isGuest: true },
    { membershipActive: false },
    { cafe: { id: "c1", status: "suspended" } },
    { permissions: [] },
  ]) {
    const base = f.users.owner;
    f.users.owner = { ...base, ...change };
    assert.equal((await f.request()).status, 403);
    f.users.owner = base;
  }
  const d = await (await f.request()).json();
  assert.equal(d.items[0].id, "legacy-entry");
  assert.equal(d.summary.incomeToman, 1000);
  assert.ok(f.calls.every((x) => x.who === "owner" || x.who === "unknown"));
});
test("catalog and stock are isolated per cafe; read-only staff cannot change data", async () => {
  const f = fixture(),
    id = await product(f);
  assert.equal(
    (await (await f.request("", undefined, "other")).json()).catalog.length,
    0,
  );
  assert.equal(
    (
      await f.request(
        "/stock",
        {
          requestId: rid(),
          itemId: id,
          kind: "out",
          quantity: 1,
          reason: "مصرف",
        },
        "other",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await f.request(
        "/catalog",
        { requestId: rid(), title: "کالا", kind: "product", priceToman: 10 },
        "read",
      )
    ).status,
    403,
  );
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    10,
  );
});
test("sale stores custom prices and discounts, decreases stock once, and keeps item snapshots after edits", async () => {
  const f = fixture(),
    id = await product(f);
  const payload = sale(id, {
    amountToman: 11000,
    discountToman: 1000,
    lines: [
      {
        itemId: id,
        title: "نباید عنوان کالا را عوض کند",
        quantity: 2,
        unitPrice: 6000,
      },
    ],
  });
  const r = await f.request("/entries", payload);
  assert.equal(r.status, 200, await r.clone().text());
  const tx = (await r.json()).transactionId;
  assert.equal((await f.request("/entries", payload)).status, 200);
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    8,
  );
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM finance_entries").get().n,
    1,
  );
  assert.equal(
    (await f.request("/entries", { ...payload, amountToman: 12000 })).status,
    409,
  );
  const item = (await (await f.request()).json()).catalog[0];
  assert.equal(
    (
      await f.request("/catalog", {
        ...item,
        title: "نام تازه",
        priceToman: 90000,
      })
    ).status,
    200,
  );
  const d = await (await f.request()).json(),
    row = d.items.find((x) => x.id === tx);
  assert.equal(row.amountToman, 11000);
  assert.equal(row.lines[0].unitPrice, 6000);
  assert.equal(row.lines[0].title, "کاغذ A4");
  assert.equal(d.summary.incomeToman, 12000);
});
test("services and one-off custom work do not need stock or a predefined catalog item", async () => {
  const f = fixture(),
    id = await product(f, {
      kind: "service",
      title: "تایپ فارسی",
      quantity: 30,
    });
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    0,
  );
  const r = await f.request(
    "/entries",
    entry({
      amountToman: 26000,
      lines: [
        { itemId: id, title: "تایپ", quantity: 2, unitPrice: 10000 },
        { title: "خدمت دلخواه", quantity: 1, unitPrice: 6000 },
      ],
    }),
  );
  assert.equal(r.status, 200);
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM stock_movements").get().n,
    0,
  );
});
test("insufficient stock and mismatched totals cannot create partial financial records", async () => {
  const f = fixture(),
    id = await product(f, { quantity: 1 });
  assert.equal((await f.request("/entries", sale(id))).status, 409);
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM finance_entries").get().n,
    0,
  );
  assert.equal(
    (
      await f.request(
        "/entries",
        sale(id, {
          amountToman: 1,
          lines: [{ itemId: id, title: "کالا", quantity: 1, unitPrice: 10000 }],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    1,
  );
});
test("SQLite constraints roll back an entire checkout if stock changes before the batch", async () => {
  const f = fixture(),
    id = await product(f, { quantity: 2 }),
    original = f.DB.batch.bind(f.DB);
  let intercept = true;
  f.DB.batch = async (statements) => {
    if (intercept) {
      intercept = false;
      f.sqlite
        .prepare("UPDATE catalog_items SET quantity=0 WHERE id=?")
        .run(id);
    }
    return original(statements);
  };
  assert.equal((await f.request("/entries", sale(id))).status, 409);
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM finance_entries").get().n,
    0,
  );
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM finance_lines").get().n,
    0,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT count(*) AS n FROM stock_movements WHERE kind='sale'")
      .get().n,
    0,
  );
});
test("owner void restores sold quantities exactly once, even if a product was archived", async () => {
  const f = fixture(),
    id = await product(f),
    r = await f.request("/entries", sale(id)),
    tx = (await r.json()).transactionId;
  assert.equal(
    (await f.request("/void", { transactionId: tx }, "staff")).status,
    403,
  );
  await f.request("/catalog", { id, archive: true });
  assert.equal((await f.request("/void", { transactionId: tx })).status, 200);
  assert.equal((await f.request("/void", { transactionId: tx })).status, 200);
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    10,
  );
  assert.equal((await (await f.request()).json()).summary.incomeToman, 1000);
  assert.equal(
    (await f.request("/void", { transactionId: tx }, "other")).status,
    404,
  );
});
test("manual stock movements require a reason, disallow negative stock and replay safely", async () => {
  const f = fixture(),
    id = await product(f);
  const move = {
    requestId: rid(),
    itemId: id,
    kind: "out",
    quantity: 3,
    reason: "مصرف داخلی",
  };
  assert.equal((await f.request("/stock", move)).status, 200);
  assert.equal((await f.request("/stock", move)).status, 200);
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    7,
  );
  assert.equal(
    (await f.request("/stock", { ...move, requestId: rid(), quantity: 8 }))
      .status,
    409,
  );
  assert.equal(
    (await f.request("/stock", { ...move, requestId: rid(), reason: "" }))
      .status,
    400,
  );
});
test("duplicate SKU and stale edits preserve existing catalog and audit records", async () => {
  const f = fixture(),
    id = await product(f, { sku: "A4" });
  const r = await f.request("/catalog", {
    requestId: rid(),
    kind: "product",
    title: "کالای تکراری",
    unit: "عدد",
    sku: "A4",
    priceToman: 2,
  });
  assert.equal(r.status, 409);
  const item = (await (await f.request()).json()).catalog[0];
  assert.equal(
    (await f.request("/catalog", { ...item, priceToman: 500 })).status,
    200,
  );
  assert.equal(
    (await f.request("/catalog", { ...item, priceToman: 600 })).status,
    409,
  );
  assert.equal(
    f.sqlite.prepare("SELECT price_toman FROM catalog_items WHERE id=?").get(id)
      .price_toman,
    500,
  );
});
test("expenses, remote legacy voids and Iran-day totals remain correct", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.request(
        "/entries",
        entry({
          direction: "expense",
          title: "قبض اینترنت",
          category: "قبوض",
          amountToman: 3000,
        }),
      )
    ).status,
    200,
  );
  let d = await (await f.request()).json();
  assert.equal(d.summary.balanceToman, -2000);
  assert.equal(d.summary.expenseToman, 3000);
  assert.equal(
    (await f.request("/void", { transactionId: "legacy-entry" })).status,
    200,
  );
  assert.ok(
    f.calls.some(
      (x) => x.args.path === "accounting:voidTransaction" && x.who === "owner",
    ),
  );
  const now = Date.parse("2026-11-19T21:00:00Z");
  const summary = summarize(
    [
      {
        direction: "income",
        amountToman: 20,
        occurredAt: Date.parse("2026-11-19T20:29:59Z"),
      },
      {
        direction: "expense",
        amountToman: 5,
        occurredAt: Date.parse("2026-11-19T20:30:00Z"),
      },
    ],
    now,
  );
  assert.equal(summary.todayIncomeToman, 0);
  assert.equal(summary.todayExpenseToman, 5);
});
test("invalid amounts, foreign catalog IDs, and feature failures reject writes", async () => {
  const f = fixture(),
    id = await product(f, {}, "other");
  assert.equal((await f.request("/entries", sale(id))).status, 409);
  for (const amount of [0, -1, 1.2, 1e10])
    assert.equal(
      (await f.request("/entries", entry({ amountToman: amount }))).status,
      400,
    );
  const r = await handleAccounting(
    new Request("https://test.site/api/accounting/entries", {
      method: "POST",
      headers: { Authorization: "Bearer owner" },
    }),
    { DB: f.DB },
    entry(),
    async () => Response.json({ status: "error" }),
  );
  assert.equal(r.status, 403);
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM finance_entries").get().n,
    0,
  );
});

test("concurrent retry cannot double-charge or decrease stock twice", async () => {
  const f = fixture(),
    id = await product(f),
    payload = sale(id);
  const responses = await Promise.all([
    f.request("/entries", payload),
    f.request("/entries", payload),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  assert.equal(
    (await responses[0].json()).transactionId,
    (await responses[1].json()).transactionId,
  );
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    8,
  );
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM finance_entries").get().n,
    1,
  );
});
test("competing sales cannot oversell the final units", async () => {
  const f = fixture(),
    id = await product(f, { quantity: 3 });
  const responses = await Promise.all([
    f.request("/entries", sale(id)),
    f.request("/entries", sale(id)),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    1,
  );
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM finance_entries").get().n,
    1,
  );
});
test("concurrent void restores inventory once and leaves the accounting audit intact", async () => {
  const f = fixture(),
    id = await product(f),
    saved = await (await f.request("/entries", sale(id))).json();
  const result = await Promise.all([
    f.request("/void", { transactionId: saved.transactionId }),
    f.request("/void", { transactionId: saved.transactionId }),
  ]);
  assert.deepEqual(
    result.map((r) => r.status),
    [200, 200],
  );
  assert.equal(
    f.sqlite.prepare("SELECT quantity FROM catalog_items WHERE id=?").get(id)
      .quantity,
    10,
  );
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT count(*) AS n FROM inventory_audit WHERE action='finance.void'",
      )
      .get().n,
    1,
  );
});
