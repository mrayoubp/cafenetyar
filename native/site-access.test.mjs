import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  manageSiteLogins,
  assertAdmission,
  resolveLogin,
  bearerAdmission,
  rateLimit,
} from "./site-access.mjs";
import {
  authorizeMessage,
  authorizeRpc,
  convexProxy,
} from "./convex-proxy.mjs";
function fixture() {
  const sql = new DatabaseSync(":memory:");
  for (const name of ["0000_native", "0004_site_access"])
    sql.exec(
      readFileSync(
        new URL("../drizzle/" + name + ".sql", import.meta.url),
        "utf8",
      ),
    );
  sql.exec(
    "INSERT INTO accounts(id,email,phone,name,role,created_at) VALUES('owner','owner@test.local','09939417533','مالک','owner',0)",
  );
  const DB = {
    prepare(query) {
      return {
        bind(...args) {
          const s = sql.prepare(query);
          return {
            async first() {
              return s.get(...args) || null;
            },
            async all() {
              return { results: s.all(...args) };
            },
            async run() {
              const r = s.run(...args);
              return { meta: { changes: Number(r.changes) } };
            },
          };
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const rows = [];
        for (const s of statements) rows.push(await s.run());
        sql.exec("COMMIT");
        return rows;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const env = { DB },
    actor = { id: "owner" },
    calls = [];
  const audit = (actor, action, id, detail) =>
    DB.prepare("INSERT INTO audit VALUES(?,?,?,?,?,?,?)").bind(
      crypto.randomUUID(),
      actor.id,
      "مالک",
      action,
      id,
      JSON.stringify(detail),
      Date.now(),
    );
  const input = {
    username: "office_one",
    phone: "09120000001",
    name: "کاربر آزمایشی",
    cafe: "دفتر آزمایش",
    password: "Secret12345",
    confirmPassword: "Secret12345",
    province: "تهران",
    city: "تهران",
    address: "خیابان آزمایش ۱",
    acceptedTerms: true,
    requestId: crypto.randomUUID(),
  };
  const transport = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return Response.json({
      status: "success",
      value: { recoveryCode: "ABCD-EFGH-JKLM" },
    });
  };
  const request = new Request("https://example.test/api/site-accounts", {
    method: "POST",
  });
  const create = (body = input, fetcher = transport) =>
    manageSiteLogins(request, env, body, actor, audit, fetcher);
  const context = {
    user: { id: "legacy-one", phone: input.phone },
    cafe: { id: "c1" },
    isGuest: false,
    isBlocked: false,
  };
  return {
    sql,
    env,
    actor,
    audit,
    input,
    calls,
    transport,
    request,
    create,
    context,
  };
}
test("owner provisioning creates an admitted username, never stores password or recovery code, and is idempotent", async () => {
  const f = fixture();
  const data = await (await f.create()).json();
  assert.equal(data.recoveryCode, "ABCD-EFGH-JKLM");
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].body.path, "authActions:registerOwner");
  assert.equal(f.calls[0].body.args.password, f.input.password);
  assert.equal(
    await resolveLogin(f.env.DB, f.env, "OFFICE_ONE"),
    f.input.phone,
  );
  assert.equal(
    await resolveLogin(f.env.DB, f.env, "۰۹۱۲۰۰۰۰۰۰۱"),
    f.input.phone,
  );
  await f.create();
  assert.equal(f.calls.length, 1);
  const stored = JSON.stringify({
    accounts: f.sql.prepare("SELECT * FROM site_logins").all(),
    audit: f.sql.prepare("SELECT * FROM audit").all(),
  });
  assert.ok(!stored.includes(f.input.password));
  assert.ok(!stored.includes(data.recoveryCode));
});
test("duplicate names and numbers cannot silently replace an account, and the owner is protected", async () => {
  const f = fixture();
  await f.create();
  await assert.rejects(
    () => f.create({ ...f.input, requestId: crypto.randomUUID() }),
    (e) => e.status === 409,
  );
  await assert.rejects(
    () =>
      f.create({
        ...f.input,
        phone: "09939417533",
        requestId: crypto.randomUUID(),
      }),
    (e) => e.status === 409,
  );
  await assert.rejects(
    () =>
      f.create({
        ...f.input,
        username: "<script>",
        requestId: crypto.randomUUID(),
      }),
    (e) => e.status === 400,
  );
  assert.equal(f.calls.length, 1);
});
test("failed upstream creation cannot grant access; owner may explicitly admit a previously created account", async () => {
  const f = fixture();
  await assert.rejects(() =>
    f.create(f.input, async () =>
      Response.json({
        status: "error",
        errorData: { message: "این شماره قبلاً ثبت شده است." },
      }),
    ),
  );
  assert.equal(
    f.sql.prepare("SELECT active,status FROM site_logins").get().active,
    0,
  );
  await assert.rejects(() => resolveLogin(f.env.DB, f.env, f.input.username));
  await f.create({
    ...f.input,
    existing: true,
    requestId: crypto.randomUUID(),
  });
  assert.equal(f.calls.length, 0);
  assert.equal(
    await resolveLogin(f.env.DB, f.env, f.input.username),
    f.input.phone,
  );
});
test("a verified legacy identity binds once; forged, blocked and replacement identities are rejected", async () => {
  const f = fixture();
  await f.create();
  await assertAdmission(f.env.DB, f.env, f.context);
  assert.equal(
    f.sql.prepare("SELECT legacy_user_id FROM site_logins").get()
      .legacy_user_id,
    "legacy-one",
  );
  await assert.rejects(() =>
    assertAdmission(f.env.DB, f.env, {
      ...f.context,
      user: { ...f.context.user, id: "replacement" },
    }),
  );
  await assert.rejects(() =>
    assertAdmission(f.env.DB, f.env, { ...f.context, isBlocked: true }),
  );
  await assert.rejects(() =>
    assertAdmission(f.env.DB, f.env, {
      user: { id: "stranger", phone: "09121111111" },
    }),
  );
  const bearer = new Request("https://example.test/api/site-access", {
    headers: { authorization: "Bearer signed-token" },
  });
  await bearerAdmission(bearer, f.env, async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer signed-token");
    return Response.json({ status: "success", value: f.context });
  });
  await assert.rejects(() =>
    bearerAdmission(
      new Request(bearer.url, {
        headers: { "oai-authenticated-user-id": "owner" },
      }),
      f.env,
    ),
  );
});
test("blocking is enforced on existing websocket traffic and new login; reopening preserves the bound user", async () => {
  const f = fixture();
  await f.create();
  const row = f.sql.prepare("SELECT * FROM site_logins").get();
  await assertAdmission(f.env.DB, f.env, f.context);
  await f.create({ id: row.id, active: false });
  await assert.rejects(() => resolveLogin(f.env.DB, f.env, f.input.phone));
  await assert.rejects(() =>
    authorizeMessage(
      { type: "ModifyQuerySet", modifications: [] },
      { context: f.context },
      f.env,
      "ip",
    ),
  );
  await f.create({ id: row.id, active: true });
  await authorizeMessage(
    { type: "ModifyQuerySet", modifications: [] },
    { context: f.context },
    f.env,
    "ip",
  );
  assert.equal(
    f.sql.prepare("SELECT legacy_user_id FROM site_logins").get()
      .legacy_user_id,
    "legacy-one",
  );
});
test("HTTP and websocket RPC both deny signup, employee creation and admin impersonation", async () => {
  const f = fixture();
  await f.create();
  const state = { context: f.context };
  for (const path of [
    "authActions:registerOwner",
    "authActions:createEmployee",
    "managedAccounts:finish",
    "tenancy:completeOwnerSetup",
  ])
    await assert.rejects(() =>
      authorizeRpc(path, {}, "action", state, f.env, "ip"),
    );
  await assert.rejects(() =>
    authorizeMessage(
      {
        type: "Authenticate",
        tokenType: "Admin",
        value: "bad",
        baseVersion: 0,
      },
      { context: null },
      f.env,
      "ip",
    ),
  );
  await assert.rejects(() =>
    authorizeMessage(
      {
        type: "Action",
        udfPath: "auth:signIn",
        args: [
          {
            provider: "password",
            params: {
              flow: "signUp",
              email: f.input.phone + "@phone.kafinet.local",
            },
          },
        ],
      },
      { context: null },
      f.env,
      "ip",
    ),
  );
  await authorizeRpc(
    "auth:signIn",
    {
      provider: "password",
      params: { flow: "signIn", email: f.input.phone + "@phone.kafinet.local" },
    },
    "action",
    { context: null },
    f.env,
    "ip",
  );
  await assert.rejects(() =>
    authorizeMessage(
      {
        type: "ModifyQuerySet",
        modifications: [
          { type: "Add", udfPath: "users:currentUser", componentPath: "admin" },
        ],
      },
      { context: null },
      f.env,
      "ip",
    ),
  );
});
test("proxy verifies bearer identity and origin before forwarding; normal public queries retain their protocol", async () => {
  const f = fixture();
  let sent = 0;
  const transport = async () => {
    sent++;
    return Response.json({ status: "success", value: null });
  };
  const rpc = (headers, path = "users:currentUser") =>
    new Request("https://example.test/api/query", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ path, args: {}, format: "json" }),
    });
  assert.equal(
    (
      await convexProxy(
        rpc({ origin: "https://evil.test" }),
        f.env,
        {},
        transport,
      )
    ).status,
    403,
  );
  assert.equal(sent, 0);
  const response = await convexProxy(
    rpc({ origin: "https://example.test" }),
    f.env,
    {},
    transport,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "success", value: null });
  const signup = new Request("https://example.test/api/action", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ path: "authActions:registerOwner", args: {} }),
  });
  assert.equal((await convexProxy(signup, f.env, {}, transport)).status, 403);
  assert.equal(sent, 1);
});
test("rate limits persist and do not depend on browser state", async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) await rateLimit(f.env.DB, "one-address", 3);
  await assert.rejects(
    () => rateLimit(f.env.DB, "one-address", 3),
    (e) => e.status === 429,
  );
  await rateLimit(f.env.DB, "different-address", 3);
});

test("real Convex HTTP client encoded arguments are accepted for an approved password sign-in", async () => {
  const { ConvexHttpClient } =
    await import("../source/node_modules/convex/dist/esm/browser/index.js");
  const { makeFunctionReference } =
    await import("../source/node_modules/convex/dist/esm/server/index.js");
  const f = fixture();
  await f.create();
  let forwarded = 0;
  const upstream = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.args[0].params.flow, "signIn");
    forwarded++;
    return Response.json({ status: "success", value: { tokens: null } });
  };
  const client = new ConvexHttpClient("https://example.test", {
    fetch: (url, options) =>
      convexProxy(
        new Request(url, {
          ...options,
          headers: { ...options.headers, Origin: "https://example.test" },
        }),
        f.env,
        {},
        upstream,
      ),
  });
  await client.action(makeFunctionReference("auth:signIn"), {
    provider: "password",
    params: {
      flow: "signIn",
      email: f.input.phone + "@phone.kafinet.local",
      password: "Secret12345",
    },
  });
  assert.equal(forwarded, 1);
  await assert.rejects(() =>
    client.action(makeFunctionReference("auth:signIn"), {
      provider: "password",
      params: {
        flow: "signUp",
        email: f.input.phone + "@phone.kafinet.local",
        password: "Secret12345",
      },
    }),
  );
  assert.equal(forwarded, 1);
});

test("websocket proxy relays public subscriptions and rejects signup actions without forwarding them", async () => {
  const f = fixture(),
    RealResponse = globalThis.Response,
    RealPair = globalThis.WebSocketPair;
  class Socket {
    listeners = {};
    sent = [];
    closed = false;
    accept() {}
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    }
    send(data) {
      this.sent.push(data);
    }
    close() {
      this.closed = true;
    }
    emit(type, data) {
      this.listeners[type]?.({ data });
    }
  }
  const remote = new Socket();
  let server;
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = new Socket();
      this[1] = server = new Socket();
    }
  };
  globalThis.Response = class extends RealResponse {
    constructor(body, options) {
      if (options?.status === 101)
        return { status: 101, webSocket: options.webSocket };
      super(body, options);
    }
  };
  try {
    const response = await convexProxy(
      new Request("https://example.test/api/1.27.3/sync", {
        headers: { Origin: "https://example.test", Upgrade: "websocket" },
      }),
      f.env,
      {},
      async () => ({ webSocket: remote }),
    );
    assert.equal(response.status, 101);
    const connect = {
      type: "Connect",
      sessionId: crypto.randomUUID(),
      connectionCount: 0,
      lastCloseReason: null,
      clientTs: Date.now(),
    };
    const query = {
      type: "ModifyQuerySet",
      baseVersion: 0,
      newVersion: 1,
      modifications: [
        {
          type: "Add",
          queryId: 0,
          udfPath: "siteCms:publicHome",
          args: [{}],
          journal: null,
        },
      ],
    };
    server.emit("message", JSON.stringify(connect));
    server.emit("message", JSON.stringify(query));
    await new Promise(setImmediate);
    assert.deepEqual(remote.sent.map(JSON.parse), [connect, query]);
    remote.emit("message", JSON.stringify({ type: "Ping" }));
    await new Promise(setImmediate);
    assert.deepEqual(server.sent.map(JSON.parse), [{ type: "Ping" }]);
    server.emit(
      "message",
      JSON.stringify({
        type: "Action",
        requestId: 7,
        udfPath: "authActions:registerOwner",
        args: [{}],
      }),
    );
    await new Promise(setImmediate);
    assert.equal(remote.sent.length, 2);
    assert.equal(JSON.parse(server.sent.at(-1)).success, false);
    assert.equal(JSON.parse(server.sent.at(-1)).requestId, 7);
  } finally {
    globalThis.Response = RealResponse;
    globalThis.WebSocketPair = RealPair;
  }
});

test('an interrupted old provisioning request can be recovered by the owner with a fresh request id',async()=>{
 const f=fixture();await f.create();f.sql.prepare("UPDATE site_logins SET status='pending',active=0,updated_at=?").run(Date.now()-180000);
 await f.create({...f.input,existing:true,requestId:crypto.randomUUID()});assert.equal(await resolveLogin(f.env.DB,f.env,f.input.username),f.input.phone);assert.equal(f.calls.length,1);
});
