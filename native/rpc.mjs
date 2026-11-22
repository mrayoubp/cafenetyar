import {
  query,
  one,
  all,
  fail,
  hash,
  phoneNumber,
  verifyPassword,
  currentUser,
  appContext,
  credentialStatements,
  workspaceStatements,
  rateLimit,
} from "./identity.mjs";
import { bridge } from "./bridge.mjs";
import defaults from "./default-rates.json" with { type: "json" };
import {
  resolveServicePrice,
  PRICE_TYPE_LABELS,
  normalizeFa,
  tokenize,
  buildPricingResult,
  hasPricingIntent,
  extractQuantity,
} from "./helpers.generated.mjs";
const str = (v, label, min = 1, max = 200) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    fail(label + " معتبر نیست.");
  return v.trim();
};
const json = (v) =>
  Response.json(v, { headers: { "Cache-Control": "no-store" } });
const now = () => Date.now();
function access(c, permission, owner = false) {
  if (
    !c?.cafe ||
    c.isBlocked ||
    !c.membershipActive ||
    c.cafe.status !== "active" ||
    (owner && !c.isOwner) ||
    !c.permissions.includes(permission)
  )
    fail("مجوز استفاده از این بخش را ندارید.", 403);
}
async function sharedLibrary(request, db, content, name, args, u) {
  const headers = new Headers(request.headers);
  headers.delete("oai-authenticated-user-id");
  if (u) headers.set("oai-authenticated-user-id", u.id);
  return bridge(
    new Request(new URL("/api/bridge", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ name, args }),
    }),
    db,
    content,
  );
}
async function libraryRpc(request, db, content, name, args, u, kind) {
  const headers = new Headers(request.headers);
  headers.delete("oai-authenticated-user-id");
  if (u) headers.set("oai-authenticated-user-id", u.id);
  if (kind === "query") {
    const url = new URL("/api/bridge", request.url);
    url.search = new URLSearchParams({
      name,
      args: JSON.stringify(args),
    }).toString();
    return bridge(new Request(url, { headers }), db, content);
  }
  return sharedLibrary(request, db, content, name, args, u);
}
async function rates(db, c) {
  const rows = await all(
    db,
    "SELECT * FROM rate_services WHERE active=1 ORDER BY category,name",
  );
  const seeded = defaults.SERVICES.map((x, i) => ({
    id: "service-" + i,
    name: x[0],
    category: x[1],
    description: x[2],
    unit: x[3],
    price_toman: null,
    meta: "{}",
  }));
  const services = [
    ...new Map([...seeded, ...rows].map((x) => [x.id, x])).values(),
  ];
  const overrides = await all(
      db,
      "SELECT * FROM rate_overrides WHERE cafe_id=?",
      c.cafe.id,
    ),
    byId = new Map(overrides.map((x) => [x.service_id, JSON.parse(x.value)]));
  const categories = defaults.SERVICE_CATEGORIES.map((x) => ({
    id: x.slug,
    ...x,
    count: services.filter((s) => s.category === x.slug).length,
  }));
  const items = services.map((s) => {
    const override = byId.get(s.id) || null,
      meta = JSON.parse(s.meta || "{}"),
      service = {
        _id: s.id,
        name: s.name,
        unit: s.unit,
        isActive: true,
        basePriceToman: s.price_toman,
        priceType: "custom",
        priceStatus: s.price_toman === null ? "needs_review" : "active",
        ...meta,
      };
    const resolution = resolveServicePrice(
      service,
      override ? { ...override, status: override.status || "active" } : null,
      now(),
    );
    const price = resolution.price;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      unit: s.unit,
      isAddon: false,
      categoryId: s.category,
      categoryName:
        categories.find((x) => x.id === s.category)?.name || s.category,
      categoryTone: "mint",
      base: {
        priceToman: s.price_toman,
        priceType: service.priceType,
        status: service.priceStatus,
        source: null,
        validFrom: meta.validFrom || null,
        validUntil: meta.validUntil || null,
      },
      override: override
        ? {
            ...override,
            priceToman: override.priceToman ?? null,
            markupToman: override.markupToman ?? null,
            markupPercent: override.markupPercent ?? null,
            source: null,
            validFrom: override.validFrom ?? null,
            validUntil: override.validUntil ?? null,
          }
        : null,
      effective: price
        ? {
            ...price,
            source: null,
            priceTypeLabel: PRICE_TYPE_LABELS[price.priceType],
          }
        : null,
      effectiveStatus: resolution.status,
    };
  });
  return {
    items,
    categories,
    sources: [],
    canManage: c.isOwner || c.permissions.includes("rates.manage"),
    isOwner: c.isOwner,
    serverNow: now(),
  };
}
export async function rpc(request, env, body, content, audit) {
  const db = env.DB,
    name = String(body.name || ""),
    args = body.args ?? {},
    kind = body.kind;
  if (
    !["query", "mutation"].includes(kind) ||
    !args ||
    typeof args !== "object" ||
    Array.isArray(args) ||
    JSON.stringify(args).length > 100000
  )
    fail("درخواست معتبر نیست.");
  const writes = new Set([
    "tenancy:updateCafe",
    "tenancy:updateProfileName",
    "tenancy:createMyCafe",
    "managedAccounts:revokeAllSessions",
    "authActions:changePassword",
    "authActions:regenerateRecoveryCode",
    "authActions:resetPasswordWithRecovery",
    "support:createTicket",
    "support:replyMyTicket",
    "support:closeMyTicket",
    "rates:setMyPrice",
    "rates:clearMyPrice",
    "rates:submitRateSuggestion",
    "agent:ask",
    "agent:submitFeedback",
    "agent:deleteConversation",
    "news:toggleSaved",
    "news:markRead",
    "news:setPreferences",
    "websites:toggleFavorite",
    "websites:moveFavorite",
    "websites:recordVisit",
    "websites:submitSuggestion",
    "websites:reportBroken",
    "notifications:markAllRead",
    "employees:update",
    "employees:setActive",
    "employees:remove",
  ]);
  if (writes.has(name) && kind !== "mutation")
    fail("روش این عملیات مجاز نیست.", 405);
  const u = await currentUser(request, db),
    c = await appContext(db, u);
  if (name === "tenancy:myContext") return json(c);
  if (name === "users:currentUser")
    return json(
      u
        ? {
            _id: u.id,
            name: u.name,
            phone: u.phone,
            isAnonymous: false,
            image: null,
          }
        : null,
    );
  if (name === "siteCms:publicSite") return json(null);
  if (name === "siteCms:publicNavigation") return json([]);
  if (name === "siteCms:publicPageBySlug") {
    const page = content.find(
      (x) => x.kind === "page" && x.meta?.slug === args.slug,
    );
    return json(
      page
        ? {
            slug: args.slug,
            title: page.title,
            summary: page.meta?.summary || "",
            body: page.body,
            imageUrls: [],
            sortOrder: 0,
            publishedAt: page.updated_at,
          }
        : null,
    );
  }
  if (name === "platformAdmin:publicProfile") {
    const row = await one(db, "SELECT value FROM settings WHERE id='site'"),
      s = row ? JSON.parse(row.value) : {};
    return json({
      platformName: s.title || "کافی‌نت‌یار",
      tagline: s.tagline || "مدیریت کافی‌نت",
      logoUrl: s.logo || null,
      supportEmail: null,
      supportPhone: null,
      supportAddress: s.contact || null,
      instagramUrl: null,
      telegramUrl: "https://t.me/Cafenetyarr",
      whatsappUrl: null,
      websiteUrl: null,
      registrationEnabled: false,
      maintenanceMode: false,
      maintenanceMessage: null,
    });
  }
  if (name === "billing:publicPlans")
    return json(
      c
        ? [c.plan]
        : [
            {
              code: "monthly",
              name: "اشتراک یک‌ماهه",
              monthlyPriceToman: 500000,
              isActive: true,
              isTrial: false,
              durationDays: 30,
            },
          ],
    );
  if (name === "authActions:resetPasswordWithRecovery") {
    const phone = phoneNumber(args.phone);
    await rateLimit(
      db,
      "recovery:" + (request.headers.get("cf-connecting-ip") || "local"),
      10,
    );
    const row = await one(
      db,
      "SELECT a.id,c.* FROM accounts a JOIN account_credentials c ON c.user_id=a.id WHERE a.phone=? AND a.active=1",
      phone || "",
    );
    const code = String(args.recoveryCode || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    if (!row || row.recovery_hash !== (await hash(code)))
      fail("شماره یا کد بازیابی درست نیست.");
    const record = await credentialStatements(
      db,
      { id: row.user_id },
      {
        username: row.username,
        password: args.newPassword,
        confirmPassword: args.confirmPassword,
      },
      env,
    );
    // Recovery is consumed atomically: concurrent uses cannot both change the password.
    const cas = query(
      db,
      "UPDATE account_credentials SET recovery_hash=NULL WHERE user_id=? AND recovery_hash=?",
      row.user_id,
      row.recovery_hash,
    );
    const won = await cas.run();
    if (!won.meta.changes) fail("کد قبلاً استفاده شده است.", 409);
    try {
      await db.batch([
        ...record.statements,
        query(db, "DELETE FROM sessions WHERE user_id=?", row.user_id),
      ]);
    } catch (e) {
      await query(
        db,
        "UPDATE account_credentials SET recovery_hash=? WHERE user_id=? AND recovery_hash IS NULL",
        row.recovery_hash,
        row.user_id,
      ).run();
      throw e;
    }
    return json({ recoveryCode: record.code });
  }
  if (!u) fail("ابتدا وارد حساب شوید.", 401);
  if (name.startsWith("news:") || name.startsWith("websites:")) {
    access(c, name.startsWith("news:") ? "news.view" : "sites.view");
    return libraryRpc(request, db, content, name, args, u, kind);
  }
  if (name === "notifications:myNotifications")
    return json({ items: [], unread: 0 });
  if (name === "notifications:markAllRead") return json({ ok: true });
  if (
    name === "managedAccounts:recordSession" ||
    name === "adminUsers:recordAdminLogin"
  )
    return json({ ok: true });
  if (name === "managedAccounts:revokeAllSessions") {
    if (args.userId && args.userId !== u.id)
      fail("مجوز خروج این حساب را ندارید.", 403);
    await db.batch([
      query(db, "DELETE FROM sessions WHERE user_id=?", u.id),
      audit(u, "sessions.revoked", u.id, {}),
    ]);
    return json({ count: 1 });
  }
  if (name === "tenancy:updateProfileName") {
    const next = str(args.name, "نام", 3, 60);
    await db.batch([
      query(db, "UPDATE accounts SET name=? WHERE id=?", next, u.id),
      audit(u, "profile.updated", u.id, { name: next }),
    ]);
    return json({ ok: true });
  }
  if (name === "tenancy:createMyCafe")
    fail("فضای کاری را از تنظیم ورود مستقل مالک در پنل مدیریت بسازید.", 403);
  if (name === "tenancy:updateCafe") {
    access(c, "dashboard.view", true);
    const fields = [
      str(args.name, "نام کافی‌نت", 2, 80),
      str(args.province, "استان", 2, 40),
      str(args.city, "شهر", 2, 40),
      str(args.address, "آدرس", 5, 200),
    ];
    await db.batch([
      query(
        db,
        "UPDATE cafes SET name=?,province=?,city=?,address=?,updated_at=? WHERE id=?",
        ...fields,
        now(),
        c.cafe.id,
      ),
      audit(u, "cafe.updated", c.cafe.id, { name: fields[0] }),
    ]);
    return json({ ok: true });
  }
  if (name === "authActions:changePassword") {
    const cred = await one(
      db,
      "SELECT * FROM account_credentials WHERE user_id=?",
      u.id,
    );
    if (!(await verifyPassword(args.currentPassword, cred)))
      fail("رمز فعلی درست نیست.");
    const value = await credentialStatements(
      db,
      u,
      {
        username: cred.username,
        password: args.newPassword,
        confirmPassword: args.confirmPassword,
      },
      env,
    );
    await db.batch([
      ...value.statements,
      query(
        db,
        "UPDATE account_credentials SET recovery_hash=? WHERE user_id=?",
        cred.recovery_hash,
        u.id,
      ),
      query(
        db,
        "DELETE FROM sessions WHERE user_id=? AND id<>?",
        u.id,
        u.session_id,
      ),
      audit(u, "password.changed", u.id, {}),
    ]);
    return json({ ok: true, recoveryCode: value.code });
  }
  if (name === "authActions:regenerateRecoveryCode") {
    const cred = await one(
      db,
      "SELECT username FROM account_credentials WHERE user_id=?",
      u.id,
    );
    if (!cred) fail("ابتدا رمز ورود مستقل را تنظیم کنید.");
    const code = crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 24)
      .toUpperCase()
      .match(/.{4}/g)
      .join("-");
    await query(
      db,
      "UPDATE account_credentials SET recovery_hash=? WHERE user_id=?",
      await hash(code.replace(/-/g, "")),
      u.id,
    ).run();
    return json({ recoveryCode: code });
  }
  if (name === "billing:mySubscription")
    return json({
      subscription: c.subscription,
      plan: c.plan,
      status: c.subscriptionActive ? "active" : "expired",
      isActive: c.subscriptionActive,
      daysLeft: c.daysLeft,
      entitlements: c.entitlements,
      usage: c.usage,
      canUseAgent: c.canUseAgent,
      canUseRates: c.canUseRates,
      hasAdvancedReports: c.hasAdvancedReports,
      hasAdvancedManagement: c.hasAdvancedManagement,
      trialUsed: true,
      invoices: [],
      orders: [],
    });
  if (name === "billing:cancelOrder" || name === "billing:confirmPayment")
    fail("خرید و تمدید فقط از طریق مدیر در تلگرام انجام می‌شود.");
  if (name === "employees:list") {
    access(c, "employees.manage");
    const rows = await all(
      db,
      "SELECT a.id,a.name,a.phone,m.* FROM cafe_memberships m JOIN accounts a ON a.id=m.user_id WHERE m.cafe_id=? AND m.kind='employee'",
      c.cafe.id,
    );
    return json(
      rows.map((x) => ({
        id: x.user_id,
        fullName: x.name,
        phone: x.phone,
        roleTitle: x.title,
        permissions: JSON.parse(x.permissions),
        active: !!x.active,
        userId: x.user_id,
        createdAt: 0,
      })),
    );
  }
  if (name === "authActions:createEmployee")
    fail("ساخت حساب فقط توسط صاحب سایت مجاز است.", 403);
  if (name.startsWith("employees:")) {
    access(c, "employees.manage", true);
    const target = args.employeeId || args.id;
    const m = await one(
      db,
      "SELECT * FROM cafe_memberships WHERE user_id=? AND cafe_id=? AND kind='employee'",
      target,
      c.cafe.id,
    );
    if (!m) fail("کارمند پیدا نشد.", 404);
    if (name === "employees:setActive") {
      if (typeof args.active !== "boolean") fail("وضعیت معتبر نیست.");
      await query(
        db,
        "UPDATE cafe_memberships SET active=? WHERE user_id=?",
        args.active ? 1 : 0,
        target,
      ).run();
    } else if (name === "employees:remove") {
      await query(
        db,
        "UPDATE cafe_memberships SET active=0 WHERE user_id=?",
        target,
      ).run();
    } else if (name === "employees:update") {
      const permissions = Array.isArray(args.permissions)
        ? args.permissions
        : [];
      if (permissions.some((p) => !c.permissions.includes(p)))
        fail("مجوز معتبر نیست.");
      await db.batch([
        query(
          db,
          "UPDATE accounts SET name=? WHERE id=?",
          str(args.fullName, "نام", 3, 60),
          target,
        ),
        query(
          db,
          "UPDATE cafe_memberships SET title=?,permissions=? WHERE user_id=?",
          String(args.roleTitle || ""),
          JSON.stringify(permissions),
          target,
        ),
      ]);
    } else fail("مسیر پیدا نشد.", 404);
    return json({ ok: true });
  }
  if (name.startsWith("support:")) {
    if (!c?.cafe || !c.membershipActive) fail("فضای کاری فعال لازم است.", 403);
    const ticketView = (t) => ({
      id: t.id,
      number: t.number || t.id.slice(0, 8),
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status:
        t.status === "closed" ? "closed" : t.reply ? "in_progress" : "open",
      createdAt: t.updated_at,
      lastMessageAt: t.updated_at,
      closedAt: t.status === "closed" ? t.updated_at : null,
    });
    if (name === "support:myTickets")
      return json(
        await all(
          db,
          "SELECT * FROM tickets WHERE user_id=? ORDER BY updated_at DESC LIMIT 300",
          u.id,
        ).then((rows) => rows.map(ticketView)),
      );
    if (name === "support:createTicket") {
      await rateLimit(db, "ticket:" + u.id, 10);
      const id = crypto.randomUUID(),
        subject = str(args.subject, "موضوع", 4, 160),
        text = str(args.body, "متن", 10, 10000),
        category = [
          "account",
          "billing",
          "technical",
          "content",
          "other",
        ].includes(args.category)
          ? args.category
          : "other",
        priority = ["low", "normal", "high"].includes(args.priority)
          ? args.priority
          : "normal",
        number = "T-" + now().toString(36).toUpperCase();
      await db.batch([
        query(
          db,
          "INSERT INTO tickets(id,user_id,cafe_id,subject,body,category,priority,number,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
          id,
          u.id,
          c.cafe.id,
          subject,
          text,
          category,
          priority,
          number,
          now(),
        ),
        query(
          db,
          "INSERT INTO ticket_messages VALUES(?,?,?,?,?,?)",
          crypto.randomUUID(),
          id,
          u.id,
          u.name,
          text,
          now(),
        ),
      ]);
      return json({ ticketId: id, number });
    }
    const ticket = await one(
      db,
      "SELECT * FROM tickets WHERE id=? AND user_id=?",
      args.ticketId,
      u.id,
    );
    if (!ticket) fail("تیکت پیدا نشد.", 404);
    if (name === "support:myTicket") {
      let messages = await all(
        db,
        "SELECT * FROM ticket_messages WHERE ticket_id=? ORDER BY created_at",
        ticket.id,
      );
      if (!messages.length)
        messages = [
          { id: ticket.id, body: ticket.body, created_at: ticket.updated_at },
        ];
      const result = messages.map((x) => ({
        id: x.id,
        body: x.body,
        isInternal: false,
        isAdmin: false,
        createdAt: x.created_at,
      }));
      if (ticket.reply)
        result.push({
          id: "reply:" + ticket.id,
          body: ticket.reply,
          isInternal: false,
          isAdmin: true,
          createdAt: ticket.updated_at,
        });
      return json({ ...ticketView(ticket), messages: result });
    }
    if (name === "support:closeMyTicket") {
      await query(
        db,
        "UPDATE tickets SET status='closed',updated_at=? WHERE id=?",
        now(),
        ticket.id,
      ).run();
      return json({ ok: true });
    }
    if (name === "support:replyMyTicket") {
      if (ticket.status === "closed") fail("تیکت بسته شده است.");
      const text = str(args.body, "متن پیام", 2, 10000);
      await db.batch([
        query(
          db,
          "INSERT INTO ticket_messages VALUES(?,?,?,?,?,?)",
          crypto.randomUUID(),
          ticket.id,
          u.id,
          u.name,
          text,
          now(),
        ),
        query(
          db,
          "UPDATE tickets SET body=body||?,status='open',updated_at=? WHERE id=?",
          "\n\nپیام جدید مشتری:\n" + text,
          now(),
          ticket.id,
        ),
      ]);
      return json({ ok: true });
    }
  }
  if (name.startsWith("rates:")) {
    access(c, "rates.view");
    if (!c.canUseRates) fail("اشتراک این بخش فعال نیست.", 403);
    const catalog = await rates(db, c);
    if (name === "rates:catalog")
      return json({
        ...catalog,
        items: catalog.items.filter(
          (x) =>
            (!args.search ||
              normalizeFa(x.name + " " + x.description).includes(
                normalizeFa(args.search),
              )) &&
            (!args.categoryId || x.categoryId === args.categoryId),
        ),
      });
    if (name === "rates:myHistory") {
      const history = await all(
        db,
        "SELECT h.*,a.name AS actor_name FROM rate_history h JOIN accounts a ON a.id=h.actor_id WHERE h.cafe_id=? ORDER BY h.created_at DESC LIMIT 300",
        c.cafe.id,
      );
      return json(
        history
          .filter((x) => !args.serviceId || args.serviceId === x.service_id)
          .map((x) => {
            const d = JSON.parse(x.value);
            return {
              id: x.id,
              scope: "cafe",
              serviceName:
                catalog.items.find((s) => s.id === x.service_id)?.name || "",
              oldPriceToman: d.before?.priceToman ?? null,
              newPriceToman: d.after?.priceToman ?? null,
              oldPriceType: d.before?.priceType ?? null,
              newPriceType: d.after?.priceType ?? null,
              oldPriceMode: d.before?.priceMode ?? null,
              newPriceMode: d.after?.priceMode ?? null,
              oldMarkupPercent: d.before?.markupPercent ?? null,
              newMarkupPercent: d.after?.markupPercent ?? null,
              oldMarkupToman: d.before?.markupToman ?? null,
              newMarkupToman: d.after?.markupToman ?? null,
              oldStatus: d.before?.status ?? null,
              newStatus: d.after?.status ?? null,
              sourceName: null,
              note: d.note || null,
              changedByName: x.actor_name,
              changedAt: x.created_at,
            };
          }),
      );
    }
    if (name === "rates:mySuggestions")
      return json(
        await all(
          db,
          "SELECT * FROM rate_suggestions WHERE cafe_id=? AND user_id=?",
          c.cafe.id,
          u.id,
        ),
      );
    const service = catalog.items.find((s) => s.id === args.serviceId);
    if (!service) fail("خدمت پیدا نشد.", 404);
    const seed = defaults.SERVICES.find(
      (_, i) => "service-" + i === service.id,
    );
    if (seed)
      await query(
        db,
        "INSERT INTO rate_services(id,name,category,description,unit) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
        service.id,
        seed[0],
        seed[1],
        seed[2],
        seed[3],
      ).run();
    if (name === "rates:submitRateSuggestion") {
      const amount = args.suggestedPriceToman ?? args.priceToman;
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000)
        fail("مبلغ پیشنهادی معتبر نیست.");
      await query(
        db,
        "INSERT INTO rate_suggestions VALUES(?,?,?,?,?,?,?)",
        crypto.randomUUID(),
        c.cafe.id,
        u.id,
        service.id,
        JSON.stringify({ ...args, priceToman: amount }),
        "pending",
        now(),
      ).run();
      return json({ ok: true });
    }
    access(c, "rates.manage");
    const before = service.override;
    if (name === "rates:clearMyPrice") {
      await db.batch([
        query(
          db,
          "DELETE FROM rate_overrides WHERE cafe_id=? AND service_id=?",
          c.cafe.id,
          service.id,
        ),
        query(
          db,
          "INSERT INTO rate_history VALUES(?,?,?,?,?,?)",
          crypto.randomUUID(),
          c.cafe.id,
          service.id,
          u.id,
          JSON.stringify({ before, after: null }),
          now(),
        ),
      ]);
      return json({ ok: true });
    }
    if (name === "rates:setMyPrice") {
      const mode = args.priceMode;
      if (
        !["fixed", "markup_percent", "markup_toman"].includes(mode) ||
        !["active", "needs_review", "inactive"].includes(args.status)
      )
        fail("نوع یا وضعیت قیمت معتبر نیست.");
      for (const key of ["priceToman", "markupToman", "markupPercent"])
        if (
          args[key] !== undefined &&
          (!Number.isFinite(args[key]) ||
            args[key] < 0 ||
            args[key] > 1000000000)
        )
          fail("مبلغ یا درصد معتبر نیست.");
      if (
        (mode === "fixed" &&
          (!Number.isSafeInteger(args.priceToman) || args.priceToman <= 0)) ||
        (mode === "markup_percent" &&
          (!(args.markupPercent > 0) || args.markupPercent > 1000)) ||
        (mode === "markup_toman" &&
          (!Number.isSafeInteger(args.markupToman) || args.markupToman <= 0))
      )
        fail("مبلغ یا درصد کامل نیست.");
      const value = {
        priceMode: mode,
        priceToman: args.priceToman,
        markupPercent: args.markupPercent,
        markupToman: args.markupToman,
        priceType: ["official", "suggested", "custom"].includes(args.priceType)
          ? args.priceType
          : "custom",
        status: args.status,
        validFrom: args.validFrom,
        validUntil: args.validUntil,
      };
      if (
        value.validUntil &&
        value.validFrom &&
        value.validUntil <= value.validFrom
      )
        fail("بازهٔ اعتبار درست نیست.");
      await db.batch([
        query(
          db,
          "INSERT INTO rate_overrides VALUES(?,?,?,?) ON CONFLICT(cafe_id,service_id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
          c.cafe.id,
          service.id,
          JSON.stringify(value),
          now(),
        ),
        query(
          db,
          "INSERT INTO rate_history VALUES(?,?,?,?,?,?)",
          crypto.randomUUID(),
          c.cafe.id,
          service.id,
          u.id,
          JSON.stringify({
            before,
            after: value,
            note: String(args.note || "").slice(0, 500),
          }),
          now(),
        ),
      ]);
      return json({ ok: true });
    }
  }
  if (name === "knowledge:search") {
    access(c, "agent.use");
    const words = tokenize(String(args.search || "")),
      matches = content.filter(
        (x) =>
          ["article", "news"].includes(x.kind) &&
          (!words.length ||
            words.some((w) => normalizeFa(x.title + " " + x.body).includes(w))),
      );
    return json({
      results: matches
        .slice(0, 20)
        .map((x) => ({
          id: x.id,
          title: x.title,
          summary: x.meta?.summary || x.body.slice(0, 180),
          snippet: x.body.slice(0, 500),
          categoryName: x.meta?.category || "عمومی",
          sourceName: x.meta?.sourceTitle || "کافی‌نت‌یار",
          sourceUrl: x.url || null,
          fileUrl: null,
          reviewedAt: x.updated_at,
          updatedAt: x.updated_at,
        })),
      total: matches.length,
    });
  }
  if (name.startsWith("agent:")) {
    access(c, "agent.use");
    if (!c.canUseAgent) fail("اشتراک دستیار فعال نیست.", 403);
    if (name === "agent:meta") {
      const catalog = await rates(db, c);
      return json({
        knowledgeDocs: content.filter((x) => ["article", "news"].includes(x.kind)).length,
        totalServices: catalog.items.length,
        overriddenServices: catalog.items.filter((x) => x.override).length,
        usage: c.usage,
        canUseAgent: true,
        canViewRates: c.permissions.includes("rates.view"),
        canManageRates: c.permissions.includes("rates.manage"),
        model: "local-knowledge",
        aiEnabled: true,
        aiConfigured: false,
        serverNow: now(),
      });
    }
    if (name === "agent:conversations")
      return json(
        await all(
          db,
          "SELECT c.*,(SELECT count(*) FROM agent_messages m WHERE m.conversation_id=c.id) AS n FROM agent_conversations c WHERE cafe_id=? AND user_id=? ORDER BY updated_at DESC LIMIT 50",
          c.cafe.id,
          u.id,
        ).then((rows) =>
          rows.map((x) => ({
            id: x.id,
            title: x.title,
            messageCount: x.n,
            lastMessageAt: x.updated_at,
            createdAt: x.created_at,
          })),
        ),
      );
    let conversation = args.conversationId
      ? await one(
          db,
          "SELECT * FROM agent_conversations WHERE id=? AND cafe_id=? AND user_id=?",
          args.conversationId,
          c.cafe.id,
          u.id,
        )
      : null;
    if (args.conversationId && !conversation) fail("گفت‌وگو پیدا نشد.", 404);
    if (name === "agent:conversation") {
      if (!conversation) fail("گفت‌وگو پیدا نشد.", 404);
      const messages = await all(
        db,
        "SELECT * FROM agent_messages WHERE conversation_id=? ORDER BY created_at,id",
        conversation.id,
      );
      return json({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        messages: messages.map((x) => ({
          id: x.id,
          role: x.role,
          content: x.content,
          sources: JSON.parse(x.sources),
          calculation: x.calculation ? JSON.parse(x.calculation) : null,
          model: x.model,
          createdAt: x.created_at,
          feedback: x.feedback,
        })),
      });
    }
    if (name === "agent:deleteConversation") {
      if (!conversation) fail("گفت‌وگو پیدا نشد.", 404);
      await db.batch([
        query(
          db,
          "DELETE FROM agent_messages WHERE conversation_id=?",
          conversation.id,
        ),
        query(
          db,
          "DELETE FROM agent_conversations WHERE id=?",
          conversation.id,
        ),
      ]);
      return json({ ok: true });
    }
    if (name === "agent:submitFeedback") {
      if (!["helpful", "not_helpful"].includes(args.rating))
        fail("بازخورد معتبر نیست.");
      const msg = await one(
        db,
        "SELECT id FROM agent_messages WHERE id=? AND conversation_id=? AND role=?",
        args.messageId,
        conversation?.id || "",
        "assistant",
      );
      if (!msg) fail("پیام پیدا نشد.", 404);
      await query(
        db,
        "UPDATE agent_messages SET feedback=? WHERE id=?",
        args.rating,
        msg.id,
      ).run();
      return json({ ok: true });
    }
    if (name === "agent:ask") {
      await rateLimit(db, "assistant:" + u.id, 20);
      const message = str(args.message, "متن پرسش", 2, 4000),
        words = tokenize(message),
        ranked = content
          .filter((x) => ["article", "news"].includes(x.kind))
          .map((x) => ({
            x,
            score: words.reduce(
              (n, w) =>
                n + (normalizeFa(x.title + " " + x.body).includes(w) ? 1 : 0),
              0,
            ),
          }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
      const sources = ranked.map(({ x }) => ({
        title: x.title,
        documentId: x.id,
        kind: "knowledge",
        url: x.url || undefined,
        updatedAt: x.updated_at,
      }));
      let calculation = null,
        answer =
          "در منابع ذخیره‌شده پاسخ مشخصی پیدا نشد. نام خدمت یا سامانه را دقیق‌تر بنویس؛ برای اطلاعات تازه، سامانهٔ رسمی را بررسی کن.";
      if (ranked.length)
        answer = ranked
          .map(({ x }) => x.title + "\n" + x.body.slice(0, 900))
          .join("\n\n");
      if (hasPricingIntent(message)) {
        const catalog = await rates(db, c),
          match = catalog.items.find(
            (x) =>
              words.some((w) => normalizeFa(x.name).includes(w)) && x.effective,
          );
        if (match) {
          const result = buildPricingResult(
            { _id: match.id, name: match.name, unit: match.unit },
            { status: "available", price: match.effective },
            extractQuantity(message),
          );
          calculation = result.calculation || null;
          answer =
            result.content ||
            "قیمت ثبت‌شدهٔ " +
              match.name +
              ": " +
              new Intl.NumberFormat("fa-IR").format(
                match.effective.priceToman,
              ) +
              " تومان";
          sources.unshift({
            title: match.name,
            serviceId: match.id,
            kind: "price",
          });
        } else
          answer =
            "برای این خدمت نرخ معتبر ثبت نشده است. ابتدا قیمت را در نرخ‌نامهٔ کافی‌نت تعیین کن.";
      }
      const id = conversation?.id || crypto.randomUUID(),
        t = now(),
        statements = [];
      if (!conversation)
        statements.push(
          query(
            db,
            "INSERT INTO agent_conversations VALUES(?,?,?,?,?,?)",
            id,
            c.cafe.id,
            u.id,
            message.slice(0, 70),
            t,
            t,
          ),
        );
      statements.push(
        query(
          db,
          "INSERT INTO agent_messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)",
          crypto.randomUUID(),
          id,
          "user",
          message,
          t,
        ),
        query(
          db,
          "INSERT INTO agent_messages(id,conversation_id,role,content,sources,calculation,model,created_at) VALUES(?,?,?,?,?,?,?,?)",
          crypto.randomUUID(),
          id,
          "assistant",
          answer,
          JSON.stringify(sources),
          calculation ? JSON.stringify(calculation) : null,
          "local-knowledge",
          t + 1,
        ),
        query(
          db,
          "UPDATE agent_conversations SET updated_at=? WHERE id=?",
          t + 1,
          id,
        ),
      );
      await db.batch(statements);
      return json({
        conversationId: id,
        answer,
        sources,
        calculation,
        model: "local-knowledge",
      });
    }
  }
  fail("این عملیات در بک‌اند مستقل پشتیبانی نمی‌شود.", 404);
}
