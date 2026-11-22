const enc = new TextEncoder();
export const PERMISSIONS = [
  "dashboard.view",
  "accounting.view",
  "transactions.write",
  "reports.view",
  "news.view",
  "sites.view",
  "agent.use",
  "rates.view",
  "rates.manage",
  "employees.manage",
];
export const query = (db, sql, ...args) => db.prepare(sql).bind(...args);
export const one = (db, sql, ...args) => query(db, sql, ...args).first();
export const all = async (db, sql, ...args) =>
  (await query(db, sql, ...args).all()).results;
export const fail = (message, status = 400) => {
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
export const hash = async (s) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export function passwordInput(value) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > 72 ||
    !/[A-Za-z\u0600-\u06ff]/.test(value) ||
    !/[0-9]/.test(value)
  )
    fail("رمز باید ۸ تا ۷۲ نویسه و شامل حرف و رقم باشد.");
  return value;
}
export function usernameInput(value) {
  const s = latin(value).trim().toLowerCase();
  if (!/^[a-z][a-z0-9_.-]{2,31}$/.test(s))
    fail("نام کاربری باید ۳ تا ۳۲ نویسهٔ انگلیسی باشد و با حرف شروع شود.");
  return s;
}
export async function passwordRecord(
  password,
  iterations = 100000,
  salt = hex(crypto.getRandomValues(new Uint8Array(24))),
) {
  passwordInput(password);
  if (![100000, 600000].includes(iterations))
    fail("تنظیم امنیت رمز معتبر نیست.", 500);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations },
    key,
    256,
  );
  return { hash: hex(new Uint8Array(bits)), salt, iterations };
}
export async function verifyPassword(password, credential) {
  if (typeof password !== "string" || password.length > 72 || !credential)
    return false;
  try {
    const actual = await passwordRecord(
      password,
      credential.iterations,
      credential.salt,
    );
    let d = actual.hash.length ^ credential.password_hash.length;
    for (let i = 0; i < actual.hash.length; i++)
      d |= actual.hash.charCodeAt(i) ^ credential.password_hash.charCodeAt(i);
    return d === 0;
  } catch {
    return false;
  }
}
export async function rateLimit(db, subject, limit = 20) {
  const t = Date.now(),
    count = await one(
      db,
      "SELECT count(*) AS n FROM access_attempts WHERE subject=? AND created_at>?",
      subject,
      t - 600000,
    );
  if (count.n >= limit)
    fail("تعداد تلاش زیاد است؛ ده دقیقه دیگر امتحان کنید.", 429);
  await db.batch([
    query(db, "DELETE FROM access_attempts WHERE created_at<?", t - 86400000),
    query(
      db,
      "INSERT INTO access_attempts VALUES(?,?,?)",
      crypto.randomUUID(),
      subject,
      t,
    ),
  ]);
}
export async function currentUser(request, db) {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)kfy_session=([^;]+)/)?.[1];
  if (!token || token.length > 200) return null;
  const u = await one(
    db,
    "SELECT a.*,s.id AS session_id,s.mfa_at,EXISTS(SELECT 1 FROM account_credentials c WHERE c.user_id=a.id) AS has_credentials FROM sessions s JOIN accounts a ON a.id=s.user_id WHERE s.id=? AND s.expires_at>?",
    await hash(token),
    Date.now(),
  );
  if (!u || !u.active) return null;
  if (
    !u.has_credentials &&
    (!u.identity_id ||
      request.headers.get("oai-authenticated-user-id") !== u.identity_id)
  )
    return null;
  u.permissions = JSON.parse(u.permissions);
  return u;
}
export async function newSession(db, u) {
  const token = hex(crypto.getRandomValues(new Uint8Array(48))),
    id = await hash(token),
    t = Date.now();
  const created = await db.batch([
    query(
      db,
      "INSERT INTO sessions(id,user_id,expires_at,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM accounts a JOIN account_credentials c ON c.user_id=a.id WHERE a.id=? AND a.active=1 AND c.password_hash=?)",
      id,
      u.id,
      t + 86400000,
      t,
      u.id,
      u.password_hash,
    ),
    query(db, "UPDATE accounts SET last_login=? WHERE id=?", t, u.id),
  ]);
  if (!created[0].meta.changes)
    fail("اعتبار حساب تغییر کرده است؛ دوباره وارد شوید.", 401);
  return token;
}
export function sessionCookie(token, request, maxAge = 86400) {
  const secure = new URL(request.url).protocol === "https:";
  return (
    "kfy_session=" +
    token +
    "; HttpOnly; " +
    (secure ? "Secure; " : "") +
    "SameSite=Strict; Path=/; Max-Age=" +
    maxAge
  );
}
export async function appContext(db, u) {
  if (!u) return null;
  const m = await one(
    db,
    "SELECT m.*,c.name,c.province,c.city,c.address,c.status,c.created_at FROM cafe_memberships m JOIN cafes c ON c.id=m.cafe_id WHERE m.user_id=?",
    u.id,
  );
  const isOwner = m?.kind === "owner",
    permissions = isOwner ? PERMISSIONS : JSON.parse(m?.permissions || "[]");
  const ends = u.subscription_end
      ? new Date(u.subscription_end + "T23:59:59+03:30").getTime()
      : 0,
    active =
      !!m &&
      m.active === 1 &&
      m.status === "active" &&
      (u.role === "owner" || ends > Date.now());
  const entitlements = {
    maxEmployees: 20,
    aiRequestsPerMonth: 0,
    agent: true,
    rates: true,
    accounting: "full",
    advancedReports: true,
    advancedManagement: true,
    prioritySupport: false,
  };
  const plan = {
    code: "monthly",
    name: "اشتراک یک‌ماهه",
    description: "فعال‌سازی دستی توسط مالک",
    monthlyPriceToman: 500000,
    yearlyPriceToman: 0,
    yearlyDiscountPercent: 0,
    durationDays: 30,
    isTrial: false,
    features: ["حسابداری و انبار", "نرخ خدمات", "بانک سامانه‌ها"],
    entitlements,
  };
  const subscription = m
    ? {
        id: "subscription:" + u.id,
        planCode: "monthly",
        planName: plan.name,
        status: active ? "active" : "expired",
        startsAt: u.created_at,
        endsAt: ends,
        billingCycle: "monthly",
        lastPaymentAt: null,
        renewalAt: ends,
      }
    : null;
  return {
    user: {
      id: u.id,
      name: u.name,
      phone: u.phone,
      isAnonymous: false,
      requiresPhoneVerification: false,
    },
    isSiteAdmin: u.role !== "customer",
    isSuperAdmin: u.role === "owner",
    isPlatformOwner: u.role === "owner",
    isBlocked: !u.active,
    adminRoles: [],
    adminPermissions: u.permissions,
    isGuest: false,
    needsSetup: !m,
    isOwner,
    membershipActive: !!m && m.active === 1,
    permissions,
    cafe: m
      ? {
          id: m.cafe_id,
          name: m.name,
          province: m.province,
          city: m.city,
          address: m.address,
          status: m.status,
          createdAt: m.created_at,
        }
      : null,
    membership: m
      ? {
          role: m.kind,
          title: m.title || "صاحب کافی‌نت",
          id: u.id,
          active: !!m.active,
        }
      : null,
    subscription,
    plan,
    entitlements,
    usage: {
      periodKey: new Date().toISOString().slice(0, 7),
      aiUsed: 0,
      aiLimit: 0,
      aiRemaining: 0,
    },
    subscriptionActive: active,
    canUseAgent: active,
    canUseRates: active,
    hasAdvancedReports: active,
    hasAdvancedManagement: active,
    daysLeft: Math.max(0, Math.ceil((ends - Date.now()) / 86400000)),
    trialUsed: true,
    platform: {
      name: "کافی‌نت‌یار",
      tagline: "مدیریت کافی‌نت",
      supportEmail: null,
      supportPhone: null,
      maintenanceMode: false,
      maintenanceMessage: null,
      registrationEnabled: false,
      adminBootstrapConfigured: true,
      canBootstrapAdmin: false,
    },
    notifications: [],
    serverNow: Date.now(),
  };
}
export async function unassignedWorkspaces(db) {
  return all(
    db,
    "SELECT x.cafe_id,(SELECT count(*) FROM finance_entries e WHERE e.cafe_id=x.cafe_id) AS entries,(SELECT count(*) FROM catalog_items i WHERE i.cafe_id=x.cafe_id) AS products FROM (SELECT cafe_id FROM finance_entries UNION SELECT cafe_id FROM catalog_items) x WHERE NOT EXISTS(SELECT 1 FROM cafes c WHERE c.id=x.cafe_id)",
  );
}
export async function workspaceStatements(db, userId, input = {}) {
  const existing = await one(
    db,
    "SELECT cafe_id FROM cafe_memberships WHERE user_id=?",
    userId,
  );
  if (existing && (!input.cafeId || input.cafeId === existing.cafe_id))
    return [];
  if (existing) {
    const activity = await one(
      db,
      "SELECT (SELECT count(*) FROM finance_entries WHERE cafe_id=?)+(SELECT count(*) FROM catalog_items WHERE cafe_id=?) AS n",
      existing.cafe_id,
      existing.cafe_id,
    );
    if (activity.n)
      fail(
        "فضای کاری فعلی داده دارد؛ انتقال خودکار آن مجاز نیست. از پشتیبان و واردکردن فایل استفاده کنید.",
        409,
      );
  }

  const name = String(input.cafe || input.name || "کافی‌نت").trim();
  if (name.length < 2 || name.length > 80) fail("نام کافی‌نت معتبر نیست.");
  const id = input.cafeId || crypto.randomUUID();
  if (input.cafeId) {
    const choices = await unassignedWorkspaces(db);
    if (!choices.some((x) => x.cafe_id === id))
      fail("این داده‌ها قبلاً متصل شده‌اند یا وجود ندارند.", 409);
  }
  const t = Date.now();
  return [
    query(
      db,
      "INSERT INTO cafes(id,name,province,city,address,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      id,
      name,
      String(input.province || ""),
      String(input.city || ""),
      String(input.address || ""),
      t,
      t,
    ),
    existing
      ? query(
          db,
          "UPDATE cafe_memberships SET cafe_id=? WHERE user_id=?",
          id,
          userId,
        )
      : query(
          db,
          "INSERT INTO cafe_memberships(user_id,cafe_id,kind) VALUES(?,?,'owner')",
          userId,
          id,
        ),
  ];
}
export async function credentialStatements(db, u, input, env) {
  const username = usernameInput(input.username),
    record = await passwordRecord(
      input.password,
      Number(env.AUTH_PASSWORD_ITERATIONS || 100000),
    );
  if (input.password !== input.confirmPassword)
    fail("رمز عبور و تکرار آن یکسان نیستند.");
  const dupe = await one(
    db,
    "SELECT user_id FROM account_credentials WHERE username=? AND user_id<>?",
    username,
    u.id,
  );
  if (dupe) fail("نام کاربری قبلاً انتخاب شده است.", 409);
  const code = hex(crypto.getRandomValues(new Uint8Array(12)))
      .toUpperCase()
      .match(/.{4}/g)
      .join("-"),
    recovery = await hash(code.replace(/-/g, ""));
  return {
    code,
    statements: [
      query(
        db,
        "INSERT INTO account_credentials(user_id,username,password_hash,salt,iterations,recovery_hash,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,salt=excluded.salt,iterations=excluded.iterations,recovery_hash=excluded.recovery_hash,updated_at=excluded.updated_at",
        u.id,
        username,
        record.hash,
        record.salt,
        record.iterations,
        recovery,
        Date.now(),
      ),
    ],
  };
}
