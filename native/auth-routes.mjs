import {
  query,
  one,
  all,
  fail,
  hash,
  latin,
  phoneNumber,
  usernameInput,
  passwordRecord,
  verifyPassword,
  rateLimit,
  currentUser,
  newSession,
  sessionCookie,
  appContext,
  credentialStatements,
  workspaceStatements,
  unassignedWorkspaces,
} from "./identity.mjs";
const json = (value, status = 200, headers = {}) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
export async function authRoute(request, env, body) {
  const db = env.DB,
    path = new URL(request.url).pathname,
    ip = request.headers.get("cf-connecting-ip") || "local";
  if(path==="/api/health"&&request.method==="GET"){
    await one(db,"SELECT 1 AS ready FROM account_credentials LIMIT 1");
    await one(db,"SELECT 1 AS ready FROM cafes LIMIT 1");
    return json({ok:true,version:"4.0.0",backend:"internal"});
  }
  if (path === "/api/setup/status" && request.method === "GET")
    return json({
      required: !(await one(db, "SELECT id FROM accounts WHERE role='owner'")),
      enabled:
        typeof env.SETUP_TOKEN === "string" && env.SETUP_TOKEN.length >= 32,
    });
  if (path === "/api/setup/owner" && request.method === "POST") {
    if (await one(db, "SELECT id FROM accounts WHERE role='owner'"))
      fail("مالک قبلاً ساخته شده است؛ راه‌اندازی بسته است.", 403);
    if (typeof env.SETUP_TOKEN !== "string" || env.SETUP_TOKEN.length < 32)
      fail("کد راه‌اندازی روی سرور تنظیم نشده است.", 503);
    await rateLimit(db, "setup:" + ip, 5);
    const actual = await hash(String(body.setupToken || "")),
      expected = await hash(env.SETUP_TOKEN);
    let diff = 0;
    for (let i = 0; i < actual.length; i++)
      diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff) fail("کد راه‌اندازی درست نیست.", 403);
    const phone = phoneNumber(body.phone),
      name = String(body.name || "").trim();
    if (!phone || name.length < 3 || name.length > 60)
      fail("نام و شمارهٔ مالک معتبر لازم است.");
    const u = { id: crypto.randomUUID(), phone, name },
      creds = await credentialStatements(db, u, body, env),
      work = await workspaceStatements(db, u.id, body),
      t = Date.now();
    try {
      await db.batch([
        query(
          db,
          "INSERT INTO accounts(id,email,phone,name,role,created_at) VALUES(?,?,?,?,'owner',?)",
          u.id,
          "owner@accounts.local",
          phone,
          name,
          t,
        ),
        ...work,
        ...creds.statements,
      ]);
    } catch (error) {
      if (/UNIQUE/i.test(error.message))
        fail("مالک یا این شماره قبلاً ثبت شده است.", 409);
      throw error;
    }
    return json({ ok: true, recoveryCode: creds.code });
  }
  if (path === "/api/auth/context" && request.method === "GET")
    return json(await appContext(db, await currentUser(request, db)));
  if (path === "/api/auth/login" && request.method === "POST") {
    await rateLimit(db, "login:" + ip, 20);
    const identifier = latin(body.identifier).trim().toLowerCase(),
      phone = phoneNumber(identifier);
    if (
      identifier.length > 80 ||
      typeof body.password !== "string" ||
      body.password.length > 72
    )
      fail("نام کاربری یا رمز درست نیست.", 401);
    const u = await one(
      db,
      "SELECT a.*,c.username,c.password_hash,c.salt,c.iterations FROM accounts a JOIN account_credentials c ON c.user_id=a.id WHERE c.username=? OR a.phone=?",
      identifier,
      phone || "",
    );
    const valid = u
      ? await verifyPassword(body.password, u)
      : await passwordRecord(
          "UnknownAccount123",
          Number(env.AUTH_PASSWORD_ITERATIONS || 100000),
        ).then(() => false);
    if (!u || !valid || !u.active)
      fail("نام کاربری یا رمز عبور درست نیست، یا حساب غیرفعال شده است.", 401);
    if (Number(env.AUTH_PASSWORD_ITERATIONS || 100000) > u.iterations) {
      const record = await passwordRecord(
        body.password,
        Number(env.AUTH_PASSWORD_ITERATIONS),
      );
      const updated = await query(
        db,
        "UPDATE account_credentials SET password_hash=?,salt=?,iterations=? WHERE user_id=? AND password_hash=?",
        record.hash,
        record.salt,
        record.iterations,
        u.id,
        u.password_hash,
      ).run();
      if (!updated.meta.changes)
        fail("اعتبار حساب تغییر کرده است؛ دوباره وارد شوید.", 401);
      u.password_hash = record.hash;
    }
    const token = await newSession(db, u);
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie(token, request),
    });
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    const u = await currentUser(request, db);
    if (u)
      await query(db, "DELETE FROM sessions WHERE id=?", u.session_id).run();
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie("", request, 0),
    });
  }
  if (path === "/api/site-access" && request.method === "GET") {
    const u = await currentUser(request, db);
    if (!u) fail("ابتدا وارد شوید.", 401);
    return json({ ok: true });
  }
  if (path === "/api/login-name" && request.method === "POST") {
    await rateLimit(db, "identifier:" + ip);
    const row = await one(
      db,
      "SELECT a.phone FROM accounts a JOIN account_credentials c ON c.user_id=a.id WHERE a.active=1 AND (c.username=? OR a.phone=?)",
      latin(body.identifier).trim().toLowerCase(),
      phoneNumber(body.identifier) || "",
    );
    if (!row) fail("حساب ورود مستقل هنوز توسط مالک فعال نشده است.", 403);
    return json({ phone: row.phone });
  }
  return null;
}
export async function provisionAccount(request, env, body, actor, audit) {
  const db = env.DB;
  if (request.method === "GET")
    return json(
      await all(
        db,
        "SELECT s.*,EXISTS(SELECT 1 FROM accounts a JOIN account_credentials c ON c.user_id=a.id WHERE a.phone=s.phone) AS password_ready FROM site_logins s ORDER BY s.created_at DESC",
      ),
    );
  if (request.method !== "POST") fail("روش درخواست مجاز نیست.", 405);
  if (body.id) {
    const s = await one(db, "SELECT * FROM site_logins WHERE id=?", body.id);
    if (!s) fail("حساب پیدا نشد.", 404);
    if (typeof body.active !== "boolean") fail("وضعیت حساب معتبر نیست.");
    const u = await one(
      db,
      "SELECT id,role FROM accounts WHERE phone=?",
      s.phone,
    );
    if (u?.role === "owner") fail("حساب مالک قابل مسدودکردن نیست.", 403);
    const statements = [
      query(
        db,
        "UPDATE site_logins SET active=?,updated_at=? WHERE id=?",
        body.active ? 1 : 0,
        Date.now(),
        s.id,
      ),
      audit(actor, "account.status", s.id, { active: body.active }),
    ];
    if (u) {
      statements.push(
        query(
          db,
          "UPDATE accounts SET active=? WHERE id=?",
          body.active ? 1 : 0,
          u.id,
        ),
      );
      if (!body.active)
        statements.push(
          query(db, "DELETE FROM sessions WHERE user_id=?", u.id),
        );
    }
    await db.batch(statements);
    return json({ ok: true });
  }
  const username = usernameInput(body.username),
    phone = phoneNumber(body.phone),
    name = String(body.name || "").trim(),
    cafe = String(body.cafe || "").trim();
  if (
    !phone ||
    name.length < 3 ||
    name.length > 60 ||
    cafe.length < 2 ||
    cafe.length > 80 ||
    typeof body.requestId !== "string" ||
    body.requestId.length < 16 ||
    body.requestId.length > 100
  )
    fail("نام، موبایل، نام کافی‌نت و شناسهٔ درخواست معتبر لازم است.");
  const replay = await one(
    db,
    "SELECT s.id,c.user_id FROM site_logins s JOIN accounts a ON a.phone=s.phone JOIN account_credentials c ON c.user_id=a.id WHERE s.request_id=?",
    body.requestId,
  );
  if (replay) return json({ ok: true, id: replay.id });
  const prior = await one(
    db,
    "SELECT * FROM site_logins WHERE phone=? OR username=?",
    phone,
    username,
  );
  if (prior && prior.phone !== phone)
    fail("نام کاربری قبلاً انتخاب شده است.", 409);
  let u = await one(db, "SELECT * FROM accounts WHERE phone=?", phone);
  if (u && u.role !== "customer")
    fail(
      "این شماره مربوط به مالک یا ادمین است؛ از بخش تنظیم ورود مالک/ادمین استفاده کنید.",
      409,
    );
  if (
    u &&
    (await one(
      db,
      "SELECT user_id FROM account_credentials WHERE user_id=?",
      u.id,
    )) &&
    body.replace !== true
  )
    fail(
      "حساب از قبل رمز مستقل دارد. برای تعیین رمز جدید گزینهٔ بازنشانی رمز را فعال کنید.",
      409,
    );
  const fresh = !u;
  u = u || { id: prior?.legacy_user_id || crypto.randomUUID(), phone, name };
  const credential = await credentialStatements(db, u, body, env),
    statements = [];
  if (fresh)
    statements.push(
      query(
        db,
        "INSERT INTO accounts(id,email,phone,name,role,active,cafe,subscription_end,created_at) VALUES(?,?,?,?,'customer',1,?,?,?)",
        u.id,
        phone + "@accounts.local",
        phone,
        name,
        cafe,
        body.subscription_end ||
          new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        Date.now(),
      ),
    );
  else
    statements.push(
      query(
        db,
        "UPDATE accounts SET name=?,cafe=?,active=1 WHERE id=?",
        name,
        cafe,
        u.id,
      ),
      query(db, "DELETE FROM sessions WHERE user_id=?", u.id),
    );
  let cafeId = body.cafeId;
  if (!cafeId && prior?.legacy_user_id) {
    const matches = await all(
      db,
      "SELECT DISTINCT cafe_id FROM inventory_audit WHERE actor_id=? UNION SELECT DISTINCT cafe_id FROM finance_entries WHERE created_by=?",
      prior.legacy_user_id,
      prior.legacy_user_id,
    );
    if (
      matches.length === 1 &&
      (await unassignedWorkspaces(db)).some(
        (x) => x.cafe_id === matches[0].cafe_id,
      )
    )
      cafeId = matches[0].cafe_id;
  }
  statements.push(
    ...(await workspaceStatements(db, u.id, { ...body, cafe, cafeId })),
    ...credential.statements,
  );
  const id = prior?.id || crypto.randomUUID(),
    t = Date.now();
  statements.push(
    query(
      db,
      "INSERT INTO site_logins(id,username,phone,name,cafe,active,status,legacy_user_id,request_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,1,'ready',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,name=excluded.name,cafe=excluded.cafe,active=1,status='ready',request_id=excluded.request_id,updated_at=excluded.updated_at",
      id,
      username,
      phone,
      name,
      cafe,
      u.id,
      body.requestId,
      actor.id,
      t,
      t,
    ),
    audit(actor, "account.provisioned", u.id, {
      username,
      phone,
      name,
      cafe,
      independent: true,
    }),
  );
  try {
    await db.batch(statements);
  } catch (e) {
    if (/UNIQUE/i.test(e.message))
      fail("شماره، نام کاربری یا داده‌های انتخابی قبلاً استفاده شده است.", 409);
    throw e;
  }
  return json({ ok: true, id, recoveryCode: credential.code });
}
export async function ownerCredentials(request, env, body, u, audit) {
  const creds = await credentialStatements(env.DB, u, body, env),
    work = await workspaceStatements(env.DB, u.id, body);
  await env.DB.batch([
    ...work,
    ...creds.statements,
    query(
      env.DB,
      "DELETE FROM sessions WHERE user_id=? AND id<>?",
      u.id,
      u.session_id,
    ),
    audit(u, "owner.credentials", u.id, { username: body.username }),
  ]);
  return json({ ok: true, recoveryCode: creds.code });
}
