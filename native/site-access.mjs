// Cafe authentication remains in the original backend. Only the Site owner can
// admit accounts here; passwords and recovery codes are never stored in D1.
export const LEGACY = "https://striped-cobra-115.convex.cloud";
const q = (db, sql, ...args) => db.prepare(sql).bind(...args);
const one = (db, sql, ...args) => q(db, sql, ...args).first();
const fail = (message, status = 403) => {
  throw Object.assign(new Error(message), { status });
};
export const latin = (s) =>
  String(s ?? "").replace(/[۰-۹٠-٩]/g, (c) =>
    String(
      "۰۱۲۳۴۵۶۷۸۹".indexOf(c) >= 0
        ? "۰۱۲۳۴۵۶۷۸۹".indexOf(c)
        : "٠١٢٣٤٥٦٧٨٩".indexOf(c),
    ),
  );
export function phoneNumber(s) {
  let n = latin(s).replace(/[\s\-()]/g, "");
  if (n.startsWith("+98")) n = "0" + n.slice(3);
  if (n.startsWith("0098")) n = "0" + n.slice(4);
  return /^09\d{9}$/.test(n) ? n : null;
}
const nameOf = (s) => String(s ?? "").trim();
export async function ownerPhone(db, env) {
  return phoneNumber(
    (await one(db, "SELECT phone FROM accounts WHERE role='owner'"))?.phone ||
      env.OWNER_PHONE ||
      "09939417533",
  );
}
export async function resolveLogin(db, env, identifier) {
  const raw = latin(identifier).trim().toLowerCase(),
    phone = phoneNumber(raw);
  if (phone && phone === (await ownerPhone(db, env))) return phone;
  const row = await one(
    db,
    "SELECT phone FROM site_logins WHERE (username=? OR phone=?) AND active=1 AND status='ready'",
    raw,
    phone || "",
  );
  if (!row) fail("این حساب توسط مدیر سایت فعال نشده است.", 403);
  return row.phone;
}
export async function assertAdmission(db, env, c) {
  const phone = phoneNumber(c?.user?.phone);
  if (!c?.user?.id || !phone || c.isGuest || c.isBlocked)
    fail("حساب اجازهٔ ورود به سایت را ندارد.");
  if (phone === (await ownerPhone(db, env))) return { phone, owner: true };
  const row = await one(
    db,
    "SELECT * FROM site_logins WHERE phone=? AND active=1 AND status='ready'",
    phone,
  );
  if (!row || (row.legacy_user_id && row.legacy_user_id !== c.user.id))
    fail("حساب شما توسط مدیر سایت فعال نشده یا مسدود شده است.");
  if (!row.legacy_user_id) {
    await q(
      db,
      "UPDATE site_logins SET legacy_user_id=? WHERE id=? AND legacy_user_id IS NULL",
      c.user.id,
      row.id,
    ).run();
    const bound = await one(
      db,
      "SELECT legacy_user_id FROM site_logins WHERE id=?",
      row.id,
    );
    if (bound?.legacy_user_id !== c.user.id) fail("هویت حساب مطابقت ندارد.");
  }
  return row;
}
export async function remoteCall(
  path,
  args = {},
  token,
  kind = "query",
  transport = fetch,
) {
  let response;
  try {
    response = await transport(LEGACY + "/api/" + kind, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify({ path, args, format: "json" }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    fail("ارتباط با سرور حساب‌ها برقرار نشد؛ دوباره تلاش کنید.", 503);
  }
  if (!response.ok)
    fail(
      "ارتباط با حساب کاربری برقرار نشد.",
      response.status === 401 ? 401 : 503,
    );
  const data = await response.json();
  if (data.status !== "success")
    fail(
      data.errorData?.message ||
        "عملیات حساب انجام نشد؛ اطلاعات یا دسترسی حساب را بررسی کنید.",
      400,
    );
  return data.value;
}
export async function bearerAdmission(request, env, transport = fetch) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ") || header.length > 20000)
    fail("ابتدا وارد حساب شوید.", 401);
  const c = await remoteCall(
    "tenancy:myContext",
    {},
    header.slice(7),
    "query",
    transport,
  );
  return assertAdmission(env.DB, env, c);
}
export async function rateLimit(db, subject, limit = 20) {
  const since = Date.now() - 600000;
  const count = await one(
    db,
    "SELECT count(*) AS n FROM access_attempts WHERE subject=? AND created_at>?",
    subject,
    since,
  );
  if (count.n >= limit)
    fail("تعداد تلاش زیاد است؛ ده دقیقه دیگر امتحان کنید.", 429);
  await db.batch([
    q(
      db,
      "DELETE FROM access_attempts WHERE created_at<?",
      Date.now() - 86400000,
    ),
    q(
      db,
      "INSERT INTO access_attempts VALUES(?,?,?)",
      crypto.randomUUID(),
      subject,
      Date.now(),
    ),
  ]);
}
export async function manageSiteLogins(
  request,
  env,
  body,
  actor,
  audit,
  transport = fetch,
) {
  const db = env.DB;
  if (request.method === "GET")
    return Response.json(
      (
        await q(
          db,
          "SELECT id,username,phone,name,cafe,active,status,created_at FROM site_logins ORDER BY created_at DESC",
        ).all()
      ).results,
      { headers: { "Cache-Control": "no-store" } },
    );
  if (request.method !== "POST") fail("روش درخواست مجاز نیست.", 405);
  if (body.id) {
    const before = await one(
      db,
      "SELECT id,username,phone,name,active,status FROM site_logins WHERE id=?",
      body.id,
    );
    if (!before) fail("حساب پیدا نشد.", 404);
    if (typeof body.active !== "boolean") fail("وضعیت معتبر نیست.", 400);
    if (before.status !== "ready") fail("حساب هنوز کامل ساخته نشده است.", 409);
    await db.batch([
      q(
        db,
        "UPDATE site_logins SET active=?,updated_at=? WHERE id=?",
        body.active ? 1 : 0,
        Date.now(),
        body.id,
      ),
      audit(actor, "site_account.status", body.id, {
        username: before.username,
        active: body.active,
      }),
    ]);
    return Response.json({ ok: true });
  }
  const username = latin(body.username).trim().toLowerCase(),
    phone = phoneNumber(body.phone),
    name = nameOf(body.name),
    cafe = nameOf(body.cafe);
  if (
    !/^[a-z][a-z0-9_.-]{2,31}$/.test(username) ||
    !phone ||
    name.length < 3 ||
    name.length > 60 ||
    cafe.length < 2 ||
    cafe.length > 80
  )
    fail(
      "نام کاربری انگلیسی (۳ تا ۳۲ نویسه)، موبایل، نام کامل و نام کافی‌نت را درست وارد کنید.",
      400,
    );
  if (phone === (await ownerPhone(db, env)))
    fail("حساب اصلی مالک قابل جایگزینی نیست.", 409);
  if (
    typeof body.requestId !== "string" ||
    body.requestId.length < 16 ||
    body.requestId.length > 100
  )
    fail("شناسهٔ درخواست معتبر نیست.", 400);
  const prior = await one(
    db,
    "SELECT id,status,updated_at FROM site_logins WHERE request_id=?",
    body.requestId,
  );
  if (prior?.status === "ready")
    return Response.json({ ok: true, id: prior.id });
  if (prior?.status === "pending" && prior.updated_at > Date.now() - 120000)
    fail("درخواست قبلی در حال ساخت است؛ فهرست را تازه کنید.", 409);
  const existing = await one(
    db,
    "SELECT id,status,updated_at FROM site_logins WHERE username=? OR phone=?",
    username,
    phone,
  );
  if (
    existing &&
    existing.status !== "failed" &&
    !(existing.status === "pending" && existing.updated_at <= Date.now() - 120000)
  )
    fail("این نام کاربری یا شماره قبلاً ثبت شده است.", 409);
  const mode = body.existing === true ? "existing" : "new";
  if (mode === "new") {
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      body.password.length > 72 ||
      !/[A-Za-z\u0600-\u06ff]/.test(body.password) ||
      !/[0-9]/.test(body.password)
    )
      fail("رمز باید ۸ تا ۷۲ نویسه و شامل حرف و رقم باشد.", 400);
    if (body.password !== body.confirmPassword)
      fail("رمز عبور و تکرار آن یکسان نیست.", 400);
    if (
      !name.includes(" ") ||
      !nameOf(body.province) ||
      nameOf(body.city).length < 2 ||
      nameOf(body.address).length < 5 ||
      body.acceptedTerms !== true
    )
      fail("نام کامل، استان، شهر، آدرس و پذیرش شرایط ساخت حساب لازم است.", 400);
  }
  const id = existing?.id || crypto.randomUUID(),
    at = Date.now();
  await q(
    db,
    "INSERT INTO site_logins(id,username,phone,name,cafe,status,active,request_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,'pending',0,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,phone=excluded.phone,name=excluded.name,cafe=excluded.cafe,status='pending',active=0,request_id=excluded.request_id,updated_at=excluded.updated_at",
    id,
    username,
    phone,
    name,
    cafe,
    body.requestId,
    actor.id,
    at,
    at,
  ).run();
  let result = {};
  try {
    if (mode === "new")
      result = await remoteCall(
        "authActions:registerOwner",
        {
          fullName: name,
          phone,
          password: body.password,
          confirmPassword: body.confirmPassword,
          cafeName: cafe,
          province: nameOf(body.province),
          city: nameOf(body.city),
          address: nameOf(body.address),
          acceptedTerms: true,
        },
        undefined,
        "action",
        transport,
      );
    await db.batch([
      q(
        db,
        "UPDATE site_logins SET status='ready',active=1,updated_at=? WHERE id=?",
        Date.now(),
        id,
      ),
      audit(actor, "site_account.created", id, {
        username,
        phone,
        name,
        cafe,
        mode,
      }),
    ]);
  } catch (error) {
    await q(
      db,
      "UPDATE site_logins SET status='failed',active=0,updated_at=? WHERE id=?",
      Date.now(),
      id,
    ).run();
    throw error;
  }
  return Response.json(
    { ok: true, id, recoveryCode: result.recoveryCode || null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
