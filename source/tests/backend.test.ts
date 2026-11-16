import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob("../src/convex/**/*.ts") as Record<
      string,
      () => Promise<unknown>
    >,
  ).map(([path, loader]) => [path.replace("../src/convex/", ""), loader]),
);

const DAY = 24 * 60 * 60 * 1000;

type TestBackend = ReturnType<typeof convexTest>;

async function seedOwner(
  t: TestBackend,
  opts: { name: string; phone: string; cafeName: string },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: opts.name,
      phone: opts.phone,
      email: `${opts.phone}@phone.kafinet.local`,
    });
    const cafeId = await ctx.db.insert("internet_cafes", {
      ownerId: userId,
      name: opts.cafeName,
      province: "تهران",
      city: "تهران",
      address: "نشانی آزمایشی",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return { userId, cafeId };
  });
}

async function seedPlan(
  t: TestBackend,
  code: "basic" | "pro",
) {
  return await t.run(async (ctx) => {
    const entitlements =
      code === "pro"
        ? {
            maxEmployees: 5,
            aiRequestsPerMonth: 300,
            agent: true,
            rates: true,
            accounting: "full" as const,
            advancedReports: true,
            advancedManagement: false,
            prioritySupport: false,
          }
        : {
            maxEmployees: 2,
            aiRequestsPerMonth: 0,
            agent: false,
            rates: false,
            accounting: "limited" as const,
            advancedReports: false,
            advancedManagement: false,
            prioritySupport: false,
          };
    return await ctx.db.insert("subscription_plans", {
      code,
      name: code === "pro" ? "حرفه‌ای" : "پایه",
      durationDays: 30,
      priceToman: 100_000,
      monthlyPriceToman: 100_000,
      yearlyPriceToman: 1_000_000,
      yearlyDiscountPercent: 10,
      features: [],
      entitlements,
      isTrial: false,
      isActive: true,
      sortOrder: code === "pro" ? 20 : 10,
      updatedAt: Date.now(),
    });
  });
}

async function seedSubscription(
  t: TestBackend,
  cafeId: Awaited<ReturnType<typeof seedOwner>>["cafeId"],
  planCode: "basic" | "pro",
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("subscriptions", {
      cafeId,
      planCode,
      status: "active",
      startsAt: now,
      endsAt: now + 30 * DAY,
      billingCycle: "monthly",
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("tenant isolation", () => {
  test("an owner cannot update an employee of another cafe", async () => {
    const t = convexTest(schema, modules);
    const first = await seedOwner(t, {
      name: "مالک اول",
      phone: "09120000001",
      cafeName: "کافی‌نت اول",
    });
    const second = await seedOwner(t, {
      name: "مالک دوم",
      phone: "09120000002",
      cafeName: "کافی‌نت دوم",
    });
    const employeeOfSecond = await t.run(async (ctx) => {
      const now = Date.now();
      const staffUser = await ctx.db.insert("users", {
        name: "کارمند دوم",
        phone: "09120000003",
      });
      return await ctx.db.insert("employees", {
        cafeId: second.cafeId,
        userId: staffUser,
        fullName: "کارمند دوم",
        phone: "09120000003",
        permissions: [],
        active: true,
        createdBy: second.userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const asFirst = t.withIdentity({ subject: first.userId });
    await expect(
      asFirst.mutation(api.employees.update, {
        employeeId: employeeOfSecond,
        fullName: "تلاش برای تغییر",
        permissions: [],
        active: false,
      }),
    ).rejects.toThrow();
  });

  test("an owner cannot read another cafe's support ticket", async () => {
    const t = convexTest(schema, modules);
    const first = await seedOwner(t, {
      name: "مالک اول",
      phone: "09120000011",
      cafeName: "کافی‌نت اول",
    });
    const second = await seedOwner(t, {
      name: "مالک دوم",
      phone: "09120000012",
      cafeName: "کافی‌نت دوم",
    });
    const ticket = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("support_tickets", {
        number: "SUP-PRIVATE",
        userId: second.userId,
        cafeId: second.cafeId,
        subject: "تیکت محرمانه کافی‌نت دوم",
        category: "account",
        priority: "normal",
        status: "open",
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const asFirst = t.withIdentity({ subject: first.userId });
    await expect(
      asFirst.query(api.support.myTicket, { ticketId: ticket }),
    ).rejects.toThrow();
  });

  test("an owner cannot read another cafe's agent conversation", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const first = await seedOwner(t, {
      name: "مالک اول",
      phone: "09120000021",
      cafeName: "کافی‌نت اول",
    });
    const second = await seedOwner(t, {
      name: "مالک دوم",
      phone: "09120000022",
      cafeName: "کافی‌نت دوم",
    });
    await seedSubscription(t, first.cafeId, "pro");
    await seedSubscription(t, second.cafeId, "pro");
    const conversation = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("agent_conversations", {
        cafeId: second.cafeId,
        userId: second.userId,
        title: "گفت‌وگوی محرمانه",
        messageCount: 0,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const asFirst = t.withIdentity({ subject: first.userId });
    await expect(
      asFirst.query(api.agent.conversation, { conversationId: conversation }),
    ).rejects.toThrow();
  });
});

describe("accounting ledger", () => {
  test("transactions are persistent and isolated between cafes", async () => {
    const t = convexTest(schema, modules);
    const first = await seedOwner(t, {
      name: "مالک دفتر اول",
      phone: "09120000061",
      cafeName: "کافی‌نت دفتر اول",
    });
    const second = await seedOwner(t, {
      name: "مالک دفتر دوم",
      phone: "09120000062",
      cafeName: "کافی‌نت دفتر دوم",
    });

    const asFirst = t.withIdentity({ subject: first.userId });
    await asFirst.mutation(api.accounting.create, {
      title: "شارژ حساب کاربر",
      direction: "income",
      category: "شارژ و خدمات",
      method: "نقدی",
      amountToman: 120_000,
    });

    const firstLedger = await asFirst.query(api.accounting.list, {});
    expect(firstLedger.items).toHaveLength(1);
    expect(firstLedger.items[0]?.title).toBe("شارژ حساب کاربر");
    expect(firstLedger.summary.incomeToman).toBe(120_000);

    const secondLedger = await t
      .withIdentity({ subject: second.userId })
      .query(api.accounting.list, {});
    expect(secondLedger.items).toHaveLength(0);
    expect(secondLedger.summary.incomeToman).toBe(0);
  });

  test("an employee with write access cannot void a transaction", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedOwner(t, {
      name: "مالک دفتر",
      phone: "09120000063",
      cafeName: "کافی‌نت دفتر",
    });
    const staff = await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        name: "کارمند دفتر",
        phone: "09120000064",
      });
      await ctx.db.insert("employees", {
        cafeId: owner.cafeId,
        userId,
        fullName: "کارمند دفتر",
        phone: "09120000064",
        permissions: ["accounting.view", "transactions.write"],
        active: true,
        createdBy: owner.userId,
        createdAt: now,
        updatedAt: now,
      });
      return userId;
    });

    const transactionId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("accounting_transactions", {
        cafeId: owner.cafeId,
        title: "هزینه اینترنت",
        direction: "expense",
        category: "اینترنت",
        method: "کارت به کارت",
        amountToman: 80_000,
        occurredAt: now,
        operatorName: "مالک دفتر",
        createdBy: owner.userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      t
        .withIdentity({ subject: staff })
        .mutation(api.accounting.voidTransaction, { transactionId }),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: owner.userId })
        .mutation(api.accounting.voidTransaction, { transactionId }),
    ).resolves.toEqual({ ok: true });
  });
});

describe("admin action authorization", () => {
  test("news ingestion accepts content managers but rejects unrelated admin roles", async () => {
    const t = convexTest(schema, modules);
    const admin = await seedOwner(t, {
      name: "مدیر محتوا",
      phone: "09120000051",
      cafeName: "کافی‌نت مدیر",
    });
    const sourceId = await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.patch(admin.userId, { role: undefined });
      const categoryId = await ctx.db.insert("news_categories", {
        slug: "ingest-test",
        name: "دسته ورودی",
        tone: "navy",
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.insert("news_sources", {
        name: "منبع آزمایشی",
        kind: "rss",
        url: "https://example.com/feed.xml",
        defaultCategoryId: categoryId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    const roleId = await t.run(async (ctx) => {
      const now = Date.now();
      const role = await ctx.db.insert("admin_roles", {
        key: "support_only_test",
        name: "پشتیبانی تست",
        description: "نقش بدون دسترسی محتوا",
        isSystem: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("admin_role_permissions", {
        roleId: role,
        permissionKey: "support.view",
        createdAt: now,
      });
      await ctx.db.insert("admin_user_roles", {
        userId: admin.userId,
        roleId: role,
        assignedBy: admin.userId,
        assignedAt: now,
      });
      return role;
    });

    await expect(
      t.mutation(internal.newsAdmin.importItems, {
        sourceId,
        actorId: admin.userId,
        items: [],
      }),
    ).rejects.toThrow();

    await t.run(async (ctx) => {
      await ctx.db.insert("admin_role_permissions", {
        roleId,
        permissionKey: "content.manage",
        createdAt: Date.now(),
      });
    });
    await expect(
      t.mutation(internal.newsAdmin.importItems, {
        sourceId,
        actorId: admin.userId,
        items: [],
      }),
    ).resolves.toEqual({ imported: 0, skipped: 0 });
  });

  test("a custom admin role cannot open the dashboard without dashboard.view", async () => {
    const t = convexTest(schema, modules);
    const admin = await seedOwner(t, {
      name: "مدیر پشتیبانی",
      phone: "09120000052",
      cafeName: "کافی‌نت پشتیبانی",
    });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.patch(admin.userId, { role: undefined });
      const roleId = await ctx.db.insert("admin_roles", {
        key: "support_only_dashboard_test",
        name: "پشتیبانی محدود",
        description: "فقط صف پشتیبانی",
        isSystem: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("admin_role_permissions", {
        roleId,
        permissionKey: "support.view",
        createdAt: now,
      });
      await ctx.db.insert("admin_user_roles", {
        userId: admin.userId,
        roleId,
        assignedBy: admin.userId,
        assignedAt: now,
      });
    });

    await expect(
      t
        .withIdentity({ subject: admin.userId })
        .query(api.admin.overview, {}),
    ).rejects.toThrow();
  });
});

describe("subscription entitlements are enforced on the server", () => {
  test("basic plan cannot read or write the rates module directly", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "basic");
    const owner = await seedOwner(t, {
      name: "مالک پایه",
      phone: "09120000031",
      cafeName: "کافی‌نت پایه",
    });
    await seedSubscription(t, owner.cafeId, "basic");
    const serviceId = await t.run(async (ctx) => {
      const now = Date.now();
      const categoryId = await ctx.db.insert("service_categories", {
        slug: `test-${now}`,
        name: "دسته آزمایشی",
        icon: "receipt",
        tone: "navy",
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.insert("services", {
        name: "خدمت آزمایشی",
        categoryId,
        description: "خدمت برای تست دسترسی پلن",
        unit: "مورد",
        priceType: "official",
        priceStatus: "needs_review",
        isAddon: false,
        isActive: true,
        sortOrder: 1,
        createdBy: owner.userId,
        updatedBy: owner.userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const asOwner = t.withIdentity({ subject: owner.userId });
    await expect(
      asOwner.mutation(api.rates.setMyPrice, {
        serviceId,
        priceMode: "fixed",
        priceToman: 50_000,
        priceType: "custom",
      }),
    ).rejects.toThrow();
    await expect(asOwner.query(api.agent.meta, {})).rejects.toThrow();
  });

  test("pro plan can persist a cafe-specific price", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const owner = await seedOwner(t, {
      name: "مالک حرفه‌ای",
      phone: "09120000032",
      cafeName: "کافی‌نت حرفه‌ای",
    });
    await seedSubscription(t, owner.cafeId, "pro");
    const serviceId = await t.run(async (ctx) => {
      const now = Date.now();
      const categoryId = await ctx.db.insert("service_categories", {
        slug: `pro-${now}`,
        name: "دسته حرفه‌ای",
        icon: "receipt",
        tone: "mint",
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.insert("services", {
        name: "خدمت حرفه‌ای",
        categoryId,
        description: "خدمت برای تست موفق پلن",
        unit: "مورد",
        priceType: "official",
        priceStatus: "needs_review",
        isAddon: false,
        isActive: true,
        sortOrder: 1,
        createdBy: owner.userId,
        updatedBy: owner.userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const asOwner = t.withIdentity({ subject: owner.userId });
    await expect(
      asOwner.mutation(api.rates.setMyPrice, {
        serviceId,
        priceMode: "fixed",
        priceToman: 50_000,
        priceType: "custom",
      }),
    ).resolves.toEqual({ ok: true });
    const saved = await t.run(async (ctx) =>
      ctx.db
        .query("cafe_service_prices")
        .withIndex("by_cafe_service", (q) =>
          q.eq("cafeId", owner.cafeId).eq("serviceId", serviceId),
        )
        .first(),
    );
    expect(saved?.priceToman).toBe(50_000);
  });
});

describe("targeted notifications", () => {
  test("renewal reminders are created once and scoped to the cafe owner", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedOwner(t, {
      name: "مالک تمدید",
      phone: "09120000051",
      cafeName: "کافی‌نت تمدید",
    });
    const other = await seedOwner(t, {
      name: "مالک دیگر",
      phone: "09120000052",
      cafeName: "کافی‌نت دیگر",
    });
    await seedPlan(t, "basic");
    const subscriptionId = await seedSubscription(t, owner.cafeId, "basic");
    await t.run(async (ctx) => {
      await ctx.db.patch(subscriptionId, { endsAt: Date.now() + 3 * DAY });
    });

    await t.mutation(internal.notifications.generateRenewalReminders, {});
    await t.mutation(internal.notifications.generateRenewalReminders, {});

    const ownerFeed = await t
      .withIdentity({ subject: owner.userId })
      .query(api.notifications.myNotifications, {});
    const otherFeed = await t
      .withIdentity({ subject: other.userId })
      .query(api.notifications.myNotifications, {});
    expect(ownerFeed.items).toHaveLength(1);
    expect(ownerFeed.items[0].kind).toBe("billing");
    expect(ownerFeed.items[0].href).toBe("/dashboard/subscription");
    expect(ownerFeed.unread).toBe(1);
    expect(otherFeed.items).toHaveLength(0);

    await t
      .withIdentity({ subject: owner.userId })
      .mutation(api.notifications.markAllRead, {});
    const readFeed = await t
      .withIdentity({ subject: owner.userId })
      .query(api.notifications.myNotifications, {});
    expect(readFeed.unread).toBe(0);
  });

  test("a user cannot mark another user's notification as read", async () => {
    const t = convexTest(schema, modules);
    const first = await seedOwner(t, {
      name: "اول",
      phone: "09120000053",
      cafeName: "کافی‌نت اول اعلان",
    });
    const second = await seedOwner(t, {
      name: "دوم",
      phone: "09120000054",
      cafeName: "کافی‌نت دوم اعلان",
    });
    const notificationId = await t.run(async (ctx) =>
      ctx.db.insert("user_notifications", {
        userId: first.userId,
        cafeId: first.cafeId,
        kind: "support",
        title: "اعلان خصوصی",
        body: "این اعلان فقط باید برای مالک اول خوانده شود.",
        isRead: false,
        createdAt: Date.now(),
      }),
    );

    await expect(
      t
        .withIdentity({ subject: second.userId })
        .mutation(api.notifications.markRead, { notificationId }),
    ).rejects.toThrow();
  });
});

describe("news visibility", () => {
  test("future scheduled news never appears in the feed or urgent rail", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedOwner(t, {
      name: "خواننده خبر",
      phone: "09120000041",
      cafeName: "کافی‌نت خبر",
    });
    const now = Date.now();
    await t.run(async (ctx) => {
      const categoryId = await ctx.db.insert("news_categories", {
        slug: "test-news",
        name: "دسته خبری",
        tone: "navy",
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("news", {
        title: "خبر منتشرشده",
        summary: "خلاصه خبر منتشرشده برای تست",
        body: "متن کامل خبر منتشرشده برای تست دسترسی.",
        categoryId,
        sourceName: "منبع آزمایشی",
        sourceUrl: "https://example.com/published",
        publishedAt: now - 60_000,
        isUrgent: false,
        isPinned: false,
        status: "published",
        isDemo: false,
        createdBy: owner.userId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("news", {
        title: "خبر زمان‌بندی‌شده محرمانه",
        summary: "خلاصه خبر آینده برای تست",
        body: "این خبر نباید پیش از زمان انتشار دیده شود.",
        categoryId,
        sourceName: "منبع آزمایشی",
        sourceUrl: "https://example.com/future",
        publishedAt: now + DAY,
        isUrgent: true,
        isPinned: false,
        status: "published",
        isDemo: false,
        createdBy: owner.userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const feed = await t
      .withIdentity({ subject: owner.userId })
      .query(api.news.feed, {});
    expect(feed.items.map((item) => item.title)).toEqual(["خبر منتشرشده"]);
    expect(feed.urgent).toHaveLength(0);
    expect(feed.totalCount).toBe(1);
  });

  test("suspended cafes are rejected by news queries", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedOwner(t, {
      name: "مالک معلق",
      phone: "09120000042",
      cafeName: "کافی‌نت معلق",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(owner.cafeId, { status: "suspended" });
    });
    await expect(
      t.withIdentity({ subject: owner.userId }).query(api.news.feed, {}),
    ).rejects.toThrow();
  });
});
