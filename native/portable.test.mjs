import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import worker, { totp } from "./server.mjs";
import { openDatabase } from "../linux/database.mjs";
import { bootstrapOwner, startServer } from "../dist/linux/server.mjs";
import { hash, newSession } from "./identity.mjs";
const migrations = fileURLToPath(new URL("../drizzle", import.meta.url));
const origin = "https://app.example.test",
  password = "OwnerTest1234";
async function fixture(t) {
  const store = openDatabase(":memory:", migrations),
    env = { DB: store.DB, AUTH_PASSWORD_ITERATIONS: "100000" };
  t.after(() => store.close());
  await bootstrapOwner(
    store.DB,
    {
      phone: "09939417533",
      username: "owner",
      name: "مالک آزمایشی",
      cafe: "دفتر مالک",
      password,
      confirmPassword: password,
    },
    env,
  );
  const request = async (path, body, cookie, headers = {}) =>
    worker.fetch(
      new Request(origin + "/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(body === undefined
            ? {}
            : { origin, "Content-Type": "application/json" }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  const login = async (identifier = "owner", pass = password) => {
    const r = await request("auth/login", { identifier, password: pass });
    assert.equal(r.status, 200, await r.clone().text());
    return r.headers.get("set-cookie").split(";")[0];
  };
  const owner = await login(),
    setup = await (await request("mfa/setup", {}, owner)).json();
  assert.equal(
    (
      await request(
        "mfa/verify",
        { code: await totp(setup.secret, Math.floor(Date.now() / 30000)) },
        owner,
      )
    ).status,
    200,
  );
  const rpc = async (name, args = {}, cookie = owner, kind = "query") =>
    request("rpc", { name, args, kind }, cookie);
  const customer = async (n = 1) => {
    const input = {
      name: "کاربر " + n,
      phone: "0912000000" + n,
      username: "customer" + n,
      cafe: "دفتر " + n,
      password: "Customer1234",
      confirmPassword: "Customer1234",
      requestId: crypto.randomUUID(),
    };
    const r = await request("site-accounts", input, owner);
    assert.equal(r.status, 200, await r.clone().text());
    return {
      ...input,
      ...(await r.json()),
      cookie: await login(input.username, input.password),
    };
  };
  return { store, env, request, login, owner, rpc, customer };
}
test("independent password login and tenant context work without platform identity or bearer tokens", async (t) => {
  const f = await fixture(t);
  const r = await f.request("auth/login", {
    identifier: "۰۹۹۳۹۴۱۷۵۳۳",
    password,
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /Secure/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/);
  const c = await (await f.request("auth/context", undefined, f.owner)).json();
  assert.equal(c.user.phone, "09939417533");
  assert.equal(c.isPlatformOwner, true);
  assert.ok(c.cafe.id);
  assert.ok(c.permissions.includes("accounting.view"));
  assert.equal(
    (
      await f.request("auth/login", {
        identifier: "owner",
        password: "Wrong12345",
      })
    ).status,
    401,
  );
  assert.equal((await f.request("register", {})).status, 403);
  assert.equal(
    (
      await f.request("auth/context", undefined, null, {
        Authorization: "Bearer forged",
        "oai-authenticated-user-id": "pretend",
      })
    ).status,
    200,
  );
  assert.equal(
    await (
      await f.request("auth/context", undefined, null, {
        Authorization: "Bearer forged",
      })
    ).json(),
    null,
  );
  const credential = f.store.sqlite
    .prepare("SELECT * FROM account_credentials")
    .get();
  assert.notEqual(credential.password_hash, password);
  assert.equal(credential.password_hash.length, 64);
  assert.ok(credential.salt.length >= 32);
});
test("owner-only account provisioning sets a real local password, preserves replay idempotency, and leaks no secret to audit", async (t) => {
  const f = await fixture(t),
    c = await f.customer();
  assert.equal((await f.request("site-accounts", {}, c.cookie)).status, 403);
  assert.equal((await f.request("site-accounts", {}, null)).status, 401);
  const context = await (
    await f.request("auth/context", undefined, c.cookie)
  ).json();
  assert.equal(context.user.phone, c.phone);
  assert.equal(context.isSiteAdmin, false);
  assert.equal(context.cafe.name, c.cafe);
  const { id: responseId, cookie: sessionCookie, recoveryCode, ...input } = c;
  const counts = f.store.sqlite
    .prepare("SELECT count(*) AS n FROM accounts")
    .get().n;
  assert.equal((await f.request("site-accounts", input, f.owner)).status, 200);
  assert.equal(
    f.store.sqlite.prepare("SELECT count(*) AS n FROM accounts").get().n,
    counts,
  );
  const dump = JSON.stringify(
    f.store.sqlite.prepare("SELECT * FROM audit").all(),
  );
  assert.ok(!dump.includes(c.password));
  assert.ok(!dump.includes(c.recoveryCode));
  assert.equal(
    (
      await f.request(
        "site-accounts",
        { ...input, requestId: crypto.randomUUID() },
        f.owner,
      )
    ).status,
    409,
  );
});
test("financial entries and stock remain atomic and isolated after removing the external backend", async (t) => {
  const f = await fixture(t),
    a = await f.customer(1),
    b = await f.customer(2);
  const call = (path, body, cookie = a.cookie) =>
    f.request("accounting" + path, body, cookie);
  const created = await call("/catalog", {
    requestId: crypto.randomUUID(),
    title: "کاغذ",
    kind: "product",
    unit: "بسته",
    priceToman: 10000,
    costToman: 7000,
    quantity: 2,
    lowStock: 1,
  });
  assert.equal(created.status, 200, await created.clone().text());
  const id = (await created.json()).id;
  const stock = {
    itemId: id,
    kind: "in",
    quantity: 3,
    reason: "افزایش موجودی",
    requestId: crypto.randomUUID(),
  };
  assert.equal((await (await call("/stock", stock)).json()).quantity, 5);
  assert.equal((await (await call("/stock", stock)).json()).quantity, 5);
  assert.equal(
    (
      await call(
        "/stock",
        { ...stock, requestId: crypto.randomUUID() },
        b.cookie,
      )
    ).status,
    404,
  );
  const sale = {
    requestId: crypto.randomUUID(),
    direction: "income",
    title: "فروش کاغذ",
    category: "بوفه",
    method: "نقدی",
    amountToman: 20000,
    discountToman: 0,
    lines: [{ itemId: id, title: "کاغذ", quantity: 2, unitPrice: 10000 }],
  };
  const paid = await call("/entries", sale);
  assert.equal(paid.status, 200, await paid.clone().text());
  const entry = (await paid.json()).transactionId;
  assert.equal((await call("/entries", sale)).status, 200);
  let data = await (await call("")).json();
  assert.equal(data.catalog[0].quantity, 3);
  assert.equal(data.items.length, 1);
  assert.equal(data.summary.incomeToman, 20000);
  assert.equal(
    (await call("/void", { transactionId: entry }, b.cookie)).status,
    404,
  );
  assert.equal((await call("/void", { transactionId: entry })).status, 200);
  assert.equal((await call("/void", { transactionId: entry })).status, 200);
  data = await (await call("")).json();
  assert.equal(data.catalog[0].quantity, 5);
  assert.equal(data.summary.incomeToman, 0);
  assert.equal(
    (
      await f.request("accounting", undefined, null, {
        Authorization: "Bearer previous-session",
      })
    ).status,
    401,
  );
});
test("password recovery consumes its code once and revokes existing native sessions", async (t) => {
  const f = await fixture(t),
    c = await f.customer();
  const args = {
    phone: c.phone,
    recoveryCode: c.recoveryCode,
    newPassword: "NewPassword123",
    confirmPassword: "NewPassword123",
  };
  const reset = await f.rpc(
    "authActions:resetPasswordWithRecovery",
    args,
    null,
    "mutation",
  );
  assert.equal(reset.status, 200, await reset.clone().text());
  assert.ok((await reset.json()).recoveryCode);
  assert.equal(
    (
      await f.rpc(
        "authActions:resetPasswordWithRecovery",
        args,
        null,
        "mutation",
      )
    ).status,
    400,
  );
  assert.equal(
    await (await f.request("auth/context", undefined, c.cookie)).json(),
    null,
  );
  assert.equal(
    (
      await f.request("auth/login", {
        identifier: c.username,
        password: c.password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.request("auth/login", {
        identifier: c.username,
        password: args.newPassword,
      })
    ).status,
    200,
  );
});
test("blocking a customer invalidates open sessions and password login", async (t) => {
  const f = await fixture(t),
    c = await f.customer();
  assert.equal(
    (await f.request("site-accounts", { id: c.id, active: false }, f.owner))
      .status,
    200,
  );
  assert.equal(
    await (await f.request("auth/context", undefined, c.cookie)).json(),
    null,
  );
  assert.equal(
    (
      await f.request("auth/login", {
        identifier: c.username,
        password: c.password,
      })
    ).status,
    401,
  );
  assert.equal(
    (await f.request("accounting", undefined, c.cookie)).status,
    401,
  );
});
test("an old password snapshot cannot create a session after a password replacement", async (t) => {
  const f = await fixture(t),
    c = await f.customer();
  const row = f.store.sqlite
    .prepare(
      "SELECT a.*,c.password_hash FROM accounts a JOIN account_credentials c ON c.user_id=a.id WHERE a.phone=?",
    )
    .get(c.phone);
  f.store.sqlite
    .prepare("UPDATE account_credentials SET password_hash=? WHERE user_id=?")
    .run("changed", row.id);
  await assert.rejects(
    () => newSession(f.store.DB, row),
    (e) => e.status === 401,
  );
});
test("favorites, read markers and reports belong to the native account and reach the protected admin queue", async (t) => {
  const f = await fixture(t),
    a = await f.customer(1),
    b = await f.customer(2);
  const list = await (await f.rpc("websites:catalog", {}, a.cookie)).json(),
    id = list.items[0].id;
  assert.equal(
    (
      await f.rpc(
        "websites:toggleFavorite",
        { websiteId: id },
        a.cookie,
        "mutation",
      )
    ).status,
    200,
  );
  assert.equal(
    (await (await f.rpc("websites:catalog", {}, a.cookie)).json()).stats
      .favorites,
    1,
  );
  assert.equal(
    (await (await f.rpc("websites:catalog", {}, b.cookie)).json()).stats
      .favorites,
    0,
  );
  assert.equal(
    (
      await f.rpc(
        "websites:reportBroken",
        { websiteId: id, reason: "not_working", note: "آزمایش" },
        a.cookie,
        "mutation",
      )
    ).status,
    200,
  );
  assert.equal(
    (await (await f.request("library-requests", undefined, f.owner)).json())
      .length,
    1,
  );
  assert.equal(
    (await f.request("library-requests", undefined, a.cookie)).status,
    403,
  );
});
test("rate overrides and price calculations are stored per cafe and do not remove the remaining catalogue", async (t) => {
  const f = await fixture(t),
    a = await f.customer(1),
    b = await f.customer(2);
  let catalog = await (await f.rpc("rates:catalog", {}, a.cookie)).json();
  assert.equal(catalog.items.length, 16);
  assert.equal(catalog.items[0].effective, null);
  const target = catalog.items.find((x) => x.name === "تایپ و ویرایش");
  const save = await f.rpc(
    "rates:setMyPrice",
    {
      serviceId: target.id,
      priceMode: "fixed",
      priceToman: 20000,
      priceType: "custom",
      status: "active",
    },
    a.cookie,
    "mutation",
  );
  assert.equal(save.status, 200, await save.clone().text());
  catalog = await (await f.rpc("rates:catalog", {}, a.cookie)).json();
  assert.equal(catalog.items.length, 16);
  assert.equal(
    catalog.items.find((x) => x.id === target.id).effective.priceToman,
    20000,
  );
  assert.equal(
    (await (await f.rpc("rates:catalog", {}, b.cookie)).json()).items.find(
      (x) => x.id === target.id,
    ).effective,
    null,
  );
  const ask = await f.rpc(
    "agent:ask",
    { message: "هزینه تایپ ۳ صفحه چقدر است؟" },
    a.cookie,
    "mutation",
  );
  assert.equal(ask.status, 200, await ask.clone().text());
  const answer = await ask.json();
  assert.equal(answer.model, "local-knowledge");
  assert.ok(answer.calculation);
  assert.equal(answer.calculation.totalToman, 60000);
  const history = await (
    await f.rpc(
      "agent:conversation",
      { conversationId: answer.conversationId },
      a.cookie,
    )
  ).json();
  assert.equal(history.messages.length, 2);
  assert.equal(history.messages[1].calculation.totalToman, 60000);
  assert.equal(
    (
      await f.rpc(
        "agent:conversation",
        { conversationId: answer.conversationId },
        b.cookie,
      )
    ).status,
    404,
  );
});
test("support tickets, replies and closing work with ownership enforced", async (t) => {
  const f = await fixture(t),
    a = await f.customer(1),
    b = await f.customer(2);
  const created = await f.rpc(
    "support:createTicket",
    {
      subject: "مشکل آزمایشی",
      body: "توضیح کامل مشکل برای تست پشتیبانی",
      category: "technical",
      priority: "normal",
    },
    a.cookie,
    "mutation",
  );
  assert.equal(created.status, 200, await created.clone().text());
  const id = (await created.json()).ticketId;
  assert.equal(
    (await f.rpc("support:myTicket", { ticketId: id }, b.cookie)).status,
    404,
  );
  assert.equal(
    (
      await f.rpc(
        "support:replyMyTicket",
        { ticketId: id, body: "توضیح تکمیلی مشتری" },
        a.cookie,
        "mutation",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(
        "tickets",
        { id, reply: "پاسخ مدیر", closed: false },
        f.owner,
      )
    ).status,
    200,
  );
  const detail = await (
    await f.rpc("support:myTicket", { ticketId: id }, a.cookie)
  ).json();
  assert.equal(detail.messages.length, 3);
  assert.equal(detail.messages[2].isAdmin, true);
  assert.equal(
    (
      await f.rpc(
        "support:closeMyTicket",
        { ticketId: id },
        a.cookie,
        "mutation",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.rpc(
        "support:replyMyTicket",
        { ticketId: id, body: "پس از بسته‌شدن" },
        a.cookie,
        "mutation",
      )
    ).status,
    400,
  );
});
test("ledger import validates the whole batch and is idempotent without contacting an external service", async (t) => {
  const f = await fixture(t);
  const item = {
    id: "old-transaction",
    title: "سند منتقل‌شده",
    amountToman: 10000,
    direction: "income",
    category: "سایر",
    method: "نقدی",
    occurredAt: 1700000000000,
    createdAt: 1700000000000,
    isVoided: false,
  };
  let r = await f.request("import/ledger", { items: [item, item] }, f.owner);
  assert.equal(r.status, 200, await r.clone().text());
  assert.deepEqual(await r.json(), { ok: true, imported: 1, skipped: 1 });
  r = await f.request("import/ledger", { items: [item] }, f.owner);
  assert.equal((await r.json()).imported, 0);
  const before = f.store.sqlite
    .prepare("SELECT count(*) AS n FROM finance_entries")
    .get().n;
  r = await f.request(
    "import/ledger",
    {
      items: [
        { ...item, id: "another" },
        { ...item, id: "bad", amountToman: 1.5 },
      ],
    },
    f.owner,
  );
  assert.equal(r.status, 400);
  assert.equal(
    f.store.sqlite.prepare("SELECT count(*) AS n FROM finance_entries").get().n,
    before,
  );
});
test("complete backup export and restore preserve credentials and finance while excluding browser sessions", async (t) => {
  const f = await fixture(t),
    c = await f.customer();
  assert.equal((await f.request("backup", undefined, c.cookie)).status, 403);
  const result = await f.request("backup", undefined, f.owner);
  assert.equal(result.status, 200, await result.clone().text());
  const dump = await result.json();
  assert.equal(dump.format, "cafenetyar-portable");
  assert.ok(dump.tables.account_credentials.length === 2);
  assert.equal(dump.tables.sessions, undefined);
  const dir = mkdtempSync(resolve(tmpdir(), "kfy-restore-")),
    file = resolve(dir, "backup.json"),
    db = resolve(dir, "restored.sqlite");
  const fs = await import("node:fs");
  fs.writeFileSync(file, JSON.stringify(dump));
  const restore = spawnSync(
    process.execPath,
    ["dist/linux/restore-backup.mjs", file],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, DB_FILE: db, AUTH_PASSWORD_ITERATIONS: "100000" },
      encoding: "utf8",
    },
  );
  assert.equal(restore.status, 0, restore.stderr);
  const restored = openDatabase(db, migrations);
  t.after(() => restored.close());
  assert.equal(
    restored.sqlite
      .prepare("SELECT count(*) AS n FROM account_credentials")
      .get().n,
    2,
  );
  assert.equal(
    restored.sqlite.prepare("SELECT count(*) AS n FROM sessions").get().n,
    0,
  );
  const restoredLogin = await worker.fetch(
    new Request(origin + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "owner", password }),
    }),
    { DB: restored.DB, AUTH_PASSWORD_ITERATIONS: "100000" },
  );
  assert.equal(restoredLogin.status, 200, await restoredLogin.clone().text());
  const again = spawnSync(
    process.execPath,
    ["dist/linux/restore-backup.mjs", file],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, DB_FILE: db },
      encoding: "utf8",
    },
  );
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /خالی نیست/);
});
test("built Linux server serves the original React app, handles HTTP login, rejects forged identity headers and persists SQLite", async (t) => {
  const dir = mkdtempSync(resolve(tmpdir(), "kfy-http-")),
    db = resolve(dir, "app.sqlite"),
    store = openDatabase(db, migrations),
    env = {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "0",
      AUTH_PASSWORD_ITERATIONS: "100000",
    };
  await bootstrapOwner(
    store.DB,
    {
      phone: "09939417533",
      username: "owner",
      cafe: "دفتر لینوکس",
      password,
      confirmPassword: password,
    },
    env,
  );
  const server = startServer(env, store);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const html = await fetch(base).then((x) => x.text());
  assert.match(html, /<div id="root"><\/div>/);
  const forged = await fetch(base + "/api/session", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      "oai-authenticated-user-id": "forged",
      "oai-authenticated-user-email": "owner@accounts.local",
    },
    body: "{}",
  });
  assert.equal(forged.status, 401);
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "owner", password }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const context = await fetch(base + "/api/auth/context", {
    headers: { Cookie: cookie },
  }).then((x) => x.json());
  assert.equal(context.cafe.name, "دفتر لینوکس");
  assert.ok(existsSync(db));
  assert.equal((await fetch(base + "/data/cafenetyar.sqlite")).status, 404);
  assert.equal(
    (
      await fetch(base + "/api/auth/logout", {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: "{}",
      })
    ).status,
    403,
  );
});

test("the owner can attach unassigned previous financial data without changing its IDs or records", async (t) => {
  const f = await fixture(t);
  f.store.sqlite
    .prepare(
      "INSERT INTO catalog_items(id,cafe_id,title,kind,unit,price_toman,quantity,request_id,created_at,updated_at) VALUES('old-item','previous-cafe','کاغذ قبلی','product','بسته',10000,7,'old-item-request',0,0)",
    )
    .run();
  const r = await f.request(
    "auth/owner-credentials",
    {
      username: "owner",
      password: "NewOwner1234",
      confirmPassword: "NewOwner1234",
      cafe: "دفتر قبلی",
      cafeId: "previous-cafe",
    },
    f.owner,
  );
  assert.equal(r.status, 200, await r.clone().text());
  const context = await (
    await f.request("auth/context", undefined, f.owner)
  ).json();
  assert.equal(context.cafe.id, "previous-cafe");
  const accounting = await (
    await f.request("accounting", undefined, f.owner)
  ).json();
  assert.equal(accounting.catalog[0].id, "old-item");
  assert.equal(accounting.catalog[0].quantity, 7);
});
test("public and authenticated active RPC screens return the expected contract without external network calls", async (t) => {
  const f = await fixture(t),
    realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Unexpected external backend call");
  };
  try {
    for (const [name, args] of [
      ["siteCms:publicSite", {}],
      ["siteCms:publicNavigation", { location: "public" }],
      ["platformAdmin:publicProfile", {}],
      ["siteCms:publicPageBySlug", { slug: "contact" }],
    ])
      assert.equal((await f.rpc(name, args, null)).status, 200);
    for (const [name, args] of [
      ["notifications:myNotifications", {}],
      ["billing:mySubscription", {}],
      ["employees:list", {}],
      ["agent:meta", {}],
      ["agent:conversations", {}],
      ["rates:myHistory", {}],
      ["knowledge:search", { search: "ثبت نام" }],
    ]) {
      const r = await f.rpc(name, args);
      assert.equal(r.status, 200, name + " " + (await r.clone().text()));
      if (name === "knowledge:search") {
        const data = await r.json();
        assert.ok(Array.isArray(data.results));
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("first-owner web installation requires a private setup token and permanently closes after setup", async (t) => {
  const store = openDatabase(":memory:", migrations);
  t.after(() => store.close());
  const env = {
    DB: store.DB,
    AUTH_PASSWORD_ITERATIONS: "100000",
    SETUP_TOKEN: "private-setup-" + crypto.randomUUID(),
  };
  const send = (body) =>
    worker.fetch(
      new Request(origin + "/api/setup/owner", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
    );
  const input = {
    setupToken: "wrong",
    phone: "09939417533",
    username: "owner",
    name: "مالک جدید",
    cafe: "دفتر تازه",
    password,
    confirmPassword: password,
  };
  assert.equal((await send(input)).status, 403);
  assert.equal(
    store.sqlite.prepare("SELECT count(*) AS n FROM accounts").get().n,
    0,
  );
  const created = await send({ ...input, setupToken: env.SETUP_TOKEN });
  assert.equal(created.status, 200, await created.clone().text());
  assert.ok((await created.json()).recoveryCode);
  assert.equal(
    (await send({ ...input, setupToken: env.SETUP_TOKEN })).status,
    403,
  );
});
test("Linux upgrades migrated password hashes to the stronger local work factor at login", async (t) => {
  const f = await fixture(t),
    before = f.store.sqlite
      .prepare("SELECT password_hash FROM account_credentials")
      .get().password_hash;
  const response = await worker.fetch(
    new Request(origin + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "owner", password }),
    }),
    { ...f.env, AUTH_PASSWORD_ITERATIONS: "600000" },
  );
  assert.equal(response.status, 200, await response.clone().text());
  const credential = f.store.sqlite
    .prepare("SELECT password_hash,iterations FROM account_credentials")
    .get();
  assert.equal(credential.iterations, 600000);
  assert.notEqual(credential.password_hash, before);
});

test("a fresh Linux instance creates a private installer token that is never served as a public file", async (t) => {
  const dir = mkdtempSync(resolve(tmpdir(), "kfy-install-")),
    store = openDatabase(resolve(dir, "new.sqlite"), migrations),
    server = startServer(
      {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        AUTH_PASSWORD_ITERATIONS: "100000",
      },
      store,
    );
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port,
    token = readFileSync(resolve(dir, "setup-token"), "utf8");
  assert.ok(token.length >= 32);
  const fs = await import("node:fs");
  assert.equal(fs.statSync(resolve(dir, "setup-token")).mode & 0o777, 0o600);
  assert.equal((await fetch(base + "/data/setup-token")).status, 404);
  assert.equal((await fetch(base + "/install")).status, 200);
  const result = await fetch(base + "/api/setup/owner", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      setupToken: token,
      phone: "09939417533",
      username: "owner",
      name: "مالک آزمایشی",
      cafe: "دفتر تازه",
      password,
      confirmPassword: password,
    }),
  });
  assert.equal(result.status, 200, await result.clone().text());
  assert.equal(
    (await fetch(base + "/api/setup/status").then((x) => x.json())).required,
    false,
  );
});

test('management and installation inline scripts parse successfully after packaging',async()=>{
 const {Script}=await import('node:vm');const {html}=await import('./ui.mjs'),{installHtml}=await import('./install.mjs');for(const [name,text] of [['manage',html],['install',installHtml]]){const scripts=[...text.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.ok(scripts.length>0);for(const item of scripts)new Script(item[1],{filename:name+'.js'});}
});
