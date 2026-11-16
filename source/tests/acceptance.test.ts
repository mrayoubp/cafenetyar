import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";

// The Vly browser bundle touches `document` at import time in the edge test
// runtime. The deterministic pricing test never calls the AI client, so a
// minimal mock keeps the backend module loadable in this environment.
vi.mock("@vly-ai/integrations", () => ({
  createVlyIntegrations: () => ({
    ai: { completion: async () => ({ success: false }) },
  }),
}));

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
type CafeId = Id<"internet_cafes">;
type UserId = Id<"users">;

async function seedUser(
  t: TestBackend,
  phone: string,
  name: string,
  role?: "admin",
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name,
      phone,
      email: `${phone}@phone.kafinet.local`,
      ...(role ? { role } : {}),
    });
  });
}

async function seedOwner(
  t: TestBackend,
  phone: string,
  name: string,
  cafeName: string,
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name,
      phone,
      email: `${phone}@phone.kafinet.local`,
    });
    const cafeId = await ctx.db.insert("internet_cafes", {
      ownerId: userId,
      name: cafeName,
      province: "تهران",
      city: "تهران",
      address: "نشانی تست پذیرش",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return { userId, cafeId };
  });
}

async function seedPlan(
  t: TestBackend,
  code: "pro" | "trial",
  monthlyPriceToman = 100_000,
) {
  return await t.run(async (ctx) => {
    const trial = code === "trial";
    return await ctx.db.insert("subscription_plans", {
      code,
      name: trial ? "دوره آزمایشی" : "حرفه‌ای",
      description: trial ? "دوره آزمایشی تست" : "پلن حرفه‌ای تست",
      durationDays: trial ? 14 : 30,
      priceToman: monthlyPriceToman,
      monthlyPriceToman: monthlyPriceToman,
      yearlyPriceToman: 1_000_000,
      yearlyDiscountPercent: 10,
      features: [],
      entitlements: trial
        ? {
            maxEmployees: 2,
            aiRequestsPerMonth: 30,
            agent: true,
            rates: true,
            accounting: "limited" as const,
            advancedReports: false,
            advancedManagement: false,
            prioritySupport: false,
          }
        : {
            maxEmployees: 5,
            aiRequestsPerMonth: 300,
            agent: true,
            rates: true,
            accounting: "full" as const,
            advancedReports: true,
            advancedManagement: false,
            prioritySupport: false,
          },
      isTrial: trial,
      isActive: true,
      sortOrder: trial ? 0 : 20,
      updatedAt: Date.now(),
    });
  });
}

async function seedSubscription(
  t: TestBackend,
  cafeId: CafeId,
  planCode: "pro" | "trial",
  endsAt?: number,
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("subscriptions", {
      cafeId,
      planCode,
      status: planCode === "trial" ? "trial" : "active",
      startsAt: now - DAY,
      endsAt: endsAt ?? now + 30 * DAY,
      billingCycle: "monthly",
      createdAt: now,
      updatedAt: now,
    });
  });
}

const verifiedSubjects = new Map<string, string>();
async function enrollOwner(t: TestBackend, userId: UserId) {
  const now=Date.now();
  const id=await t.run(async ctx=>{
    const sessionId=await ctx.db.insert("authSessions",{userId,expirationTime:now+3600000});
    await ctx.db.insert("admin_security",{userId,totpSecret:"JBSWY3DPEHPK3PXP",mfaEnabled:true,createdAt:now,updatedAt:now});
    await ctx.db.insert("admin_mfa_sessions",{userId,sessionId,verifiedAt:now,expiresAt:now+1800000});
    return sessionId;
  });
  verifiedSubjects.set(userId, `${userId}|${id}`);
}

async function seedPlatformAdmin(t: TestBackend, phone = "09129999999") {
  return await seedUser(t, phone, "مدیر کل تست", "admin");
}

async function seedService(
  t: TestBackend,
  ownerId: UserId,
  basePriceToman = 100_000,
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const categoryId = await ctx.db.insert("service_categories", {
      slug: `test-category-${now}-${Math.random()}`,
      name: "خدمات چاپ",
      description: "دسته تست",
      icon: "receipt",
      tone: "navy",
      sortOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const serviceId = await ctx.db.insert("services", {
      name: "پرینت",
      categoryId,
      description: "چاپ برگ",
      unit: "برگ",
      basePriceToman,
      priceType: "official",
      priceStatus: "active",
      isAddon: false,
      isActive: true,
      sortOrder: 1,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: now,
      updatedAt: now,
    });
    return { categoryId, serviceId };
  });
}

async function seedDiscount(
  t: TestBackend,
  createdBy: UserId,
  opts: { code: string; maxUses: number; maxUsesPerCafe: number },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("discount_codes", {
      code: opts.code,
      title: "تخفیف تست",
      discountType: "percent",
      value: 20,
      startsAt: now - DAY,
      endsAt: now + DAY,
      maxUses: opts.maxUses,
      maxUsesPerCafe: opts.maxUsesPerCafe,
      applicablePlans: ["pro"],
      isActive: true,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("acceptance: owner setup and financial ledger", () => {
  test("signup bootstrap creates an active trial and the owner can configure the cafe, record income and see a reconciled ledger", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await seedUser(t, "09121000001", "مالک تست");
    const result = await t.mutation(internal.tenancy.bootstrapOwner, {
      ownerId,
      name: "کافی‌نت پذیرش",
      province: "تهران",
      city: "تهران",
      address: "خیابان تست، پلاک ۱",
      recoveryHash: "hash",
      recoverySalt: "salt",
      phone: "09121000001",
    });
    const cafeId = result.cafeId;

    const context = await t
      .withIdentity({ subject: ownerId })
      .query(api.tenancy.myContext, {});
    expect(context?.isOwner).toBe(true);
    expect(context?.cafe?.name).toBe("کافی‌نت پذیرش");
    expect(context?.subscriptionActive).toBe(true);
    expect(context?.canUseAgent).toBe(true);
    expect(context?.trialUsed).toBe(true);

    await t.withIdentity({ subject: ownerId }).mutation(api.tenancy.updateCafe, {
      name: "کافی‌نت به‌روزشده",
      province: "تهران",
      city: "تهران",
      address: "نشانی جدید تست",
    });
    const updated = await t
      .withIdentity({ subject: ownerId })
      .query(api.tenancy.myContext, {});
    expect(updated?.cafe?.name).toBe("کافی‌نت به‌روزشده");

    const created = await t
      .withIdentity({ subject: ownerId })
      .mutation(api.accounting.create, {
        title: "فروش شارژ",
        direction: "income",
        category: "اینترنت",
        method: "نقدی",
        amountToman: 100_000,
      });
    expect(created.transactionId).toBeDefined();

    const ledger = await t
      .withIdentity({ subject: ownerId })
      .query(api.accounting.list, {});
    expect(ledger.summary.incomeToman).toBe(100_000);
    expect(ledger.summary.expenseToman).toBe(0);
    expect(ledger.summary.balanceToman).toBe(100_000);
    expect(ledger.summary.todayIncomeToman).toBe(100_000);
    expect(ledger.summary.count).toBe(1);

    const rows = await t.run(async (ctx) => {
      return await ctx.db
        .query("accounting_transactions")
        .withIndex("by_cafe_occurred", (q) => q.eq("cafeId", cafeId))
        .collect();
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].cafeId).toBe(cafeId);
  });

  test("owner adds a real employee account and employee permissions are enforced", async () => {
    const t = convexTest(schema, modules);
    const planId = await seedPlan(t, "pro");
    expect(planId).toBeDefined();
    const owner = await seedOwner(t, "09121000011", "مالک دوم", "کافی‌نت دوم");
    await seedSubscription(t, owner.cafeId, "pro");

    await t.run(async ctx=>{await ctx.db.patch(owner.userId,{role:"admin"});});
    await enrollOwner(t, owner.userId);
    const employee = await t
      .withIdentity({ subject: verifiedSubjects.get(owner.userId)! })
      .action(api.authActions.createEmployee, {
        fullName: "کارمند واقعی",
        phone: "09121000012",
        password: "TestPass123",
        confirmPassword: "TestPass123",
        roleTitle: "صندوق‌دار",
        permissions: [
          "dashboard.view",
          "accounting.view",
          "transactions.write",
        ],
      });
    expect(employee.employeeId).toBeDefined();
    expect(employee.recoveryCode.length).toBeGreaterThan(5);

    const employeeRow = await t.run(async (ctx) => {
      return await ctx.db.get(employee.employeeId);
    });
    expect(employeeRow?.userId).toBeDefined();
    const employeeUserId = employeeRow!.userId!;

    const context = await t
      .withIdentity({ subject: employeeUserId })
      .query(api.tenancy.myContext, {});
    expect(context?.membership?.role).toBe("employee");
    expect(context?.permissions).toContain("transactions.write");
    expect(context?.permissions).not.toContain("employees.manage");

    const transaction = await t
      .withIdentity({ subject: employeeUserId })
      .mutation(api.accounting.create, {
        title: "ثبت کارمند",
        direction: "income",
        category: "بوفه",
        method: "نقدی",
        amountToman: 25_000,
      });
    expect(transaction.transactionId).toBeDefined();

    await expect(
      t
        .withIdentity({ subject: employeeUserId })
        .mutation(api.accounting.voidTransaction, {
          transactionId: transaction.transactionId,
        }),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: employeeUserId })
        .query(api.employees.list, {}),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: employeeUserId })
        .mutation(api.tenancy.updateCafe, {
          name: "تلاش غیرمجاز",
          province: "تهران",
          city: "تهران",
          address: "تست",
        }),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: employeeUserId })
        .query(api.billing.mySubscription, {}),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: employeeUserId })
        .query(api.admin.overview, {}),
    ).rejects.toThrow();
  });

  test("two cafes have isolated ledgers and expired cafe rates never fall back to another price", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const first = await seedOwner(t, "09121000021", "مالک اول", "کافی‌نت اول");
    const second = await seedOwner(t, "09121000022", "مالک دوم", "کافی‌نت دوم");
    await seedSubscription(t, first.cafeId, "pro");
    await seedSubscription(t, second.cafeId, "pro");

    const firstTx = await t
      .withIdentity({ subject: first.userId })
      .mutation(api.accounting.create, {
        title: "درآمد اول",
        direction: "income",
        category: "اینترنت",
        method: "نقدی",
        amountToman: 100_000,
      });
    await t
      .withIdentity({ subject: first.userId })
      .mutation(api.accounting.create, {
        title: "هزینه اول",
        direction: "expense",
        category: "اجاره",
        method: "کارت به کارت",
        amountToman: 40_000,
      });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("accounting_transactions", {
        cafeId: first.cafeId,
        title: "درآمد قدیمی",
        direction: "income",
        category: "اینترنت",
        method: "نقدی",
        amountToman: 25_000,
        occurredAt: now - 10 * DAY,
        operatorName: "مالک اول",
        createdBy: first.userId,
        createdAt: now,
        updatedAt: now,
      });
    });
    await t
      .withIdentity({ subject: second.userId })
      .mutation(api.accounting.create, {
        title: "درآمد دوم",
        direction: "income",
        category: "بوفه",
        method: "نقدی",
        amountToman: 30_000,
      });

    const firstLedger = await t
      .withIdentity({ subject: first.userId })
      .query(api.accounting.list, {});
    expect(firstLedger.summary.incomeToman).toBe(125_000);
    expect(firstLedger.summary.expenseToman).toBe(40_000);
    expect(firstLedger.summary.balanceToman).toBe(85_000);
    expect(firstLedger.summary.todayIncomeToman).toBe(100_000);
    expect(firstLedger.summary.todayExpenseToman).toBe(40_000);
    expect(firstLedger.summary.weekIncomeToman).toBe(100_000);

    const secondLedger = await t
      .withIdentity({ subject: second.userId })
      .query(api.accounting.list, {});
    expect(secondLedger.summary.incomeToman).toBe(30_000);
    expect(secondLedger.summary.count).toBe(1);
    expect(secondLedger.items.some((row) => row.title === "درآمد اول")).toBe(
      false,
    );

    await t
      .withIdentity({ subject: first.userId })
      .mutation(api.accounting.voidTransaction, {
        transactionId: firstTx.transactionId,
      });
    const afterVoid = await t
      .withIdentity({ subject: first.userId })
      .query(api.accounting.list, {});
    expect(afterVoid.summary.incomeToman).toBe(25_000);
    expect(afterVoid.summary.voidedCount).toBe(1);
    expect(afterVoid.items.find((row) => row.id === firstTx.transactionId)?.isVoided).toBe(true);

    await expect(
      t
        .withIdentity({ subject: second.userId })
        .mutation(api.accounting.voidTransaction, {
          transactionId: (await t
            .withIdentity({ subject: first.userId })
            .query(api.accounting.list, {})).items.find((row) => row.title === "درآمد قدیمی")!.id,
        }),
    ).rejects.toThrow();

    const service = await seedService(t, first.userId);
    await t
      .withIdentity({ subject: first.userId })
      .mutation(api.rates.setMyPrice, {
        serviceId: service.serviceId,
        priceMode: "fixed",
        priceToman: 80_000,
        priceType: "custom",
        validUntil: Date.now() - 1,
      });
    const firstCatalog = await t
      .withIdentity({ subject: first.userId })
      .query(api.rates.catalog, {});
    const firstItem = firstCatalog.items.find((item) => item.id === service.serviceId);
    expect(firstItem?.effectiveStatus).toBe("expired");
    expect(firstItem?.effective).toBeNull();

    const secondCatalog = await t
      .withIdentity({ subject: second.userId })
      .query(api.rates.catalog, {});
    const secondItem = secondCatalog.items.find((item) => item.id === service.serviceId);
    expect(secondItem?.effective?.priceToman).toBe(100_000);
    expect(secondItem?.effective?.isCafeOverride).toBe(false);
  });
});

describe("acceptance: admin panel and authorization", () => {
  test("the platform admin can read and manage the main admin surfaces", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seedPlatformAdmin(t);
    await enrollOwner(t, adminId);
    await seedPlan(t, "trial");
    const owner = await seedOwner(t, "09121000031", "مالک مدیر", "کافی‌نت مدیر");

    const overview = await t
      .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
      .query(api.admin.overview, {});
    expect(overview.cafes.total).toBe(1);
    const cafes = await t
      .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
      .query(api.admin.listCafes, {});
    expect(cafes.some((cafe) => cafe.id === owner.cafeId)).toBe(true);
    await expect(
      t
        .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
        .query(api.admin.cafeDetails, { cafeId: owner.cafeId }),
    ).resolves.toBeDefined();
    await expect(
      t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).query(api.billingAdmin.overview, {}),
    ).resolves.toBeDefined();
    await expect(
      t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).query(api.billingAdmin.plans, {}),
    ).resolves.toBeDefined();
    await expect(
      t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).query(api.newsAdmin.overview, {}),
    ).resolves.toBeDefined();
    await expect(
      t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).query(api.websitesAdmin.overview, {}),
    ).resolves.toBeDefined();
    await expect(
      t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).query(api.ratesAdmin.overview, {}),
    ).resolves.toBeDefined();
    await expect(
      t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).query(api.support.adminList, {}),
    ).resolves.toBeDefined();

    await t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).mutation(api.billingAdmin.grantTrial, {
      cafeId: owner.cafeId,
    });
    const details = await t
      .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
      .query(api.admin.cafeDetails, { cafeId: owner.cafeId });
    expect(details.subscription?.planCode).toBe("trial");
    expect(details.subscription?.status).toBe("trial");

    await t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).mutation(api.newsAdmin.createCategory, {
      name: "دسته خبر تست",
      description: "دسته تست",
      tone: "navy",
    });
    await t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).mutation(api.websitesAdmin.createCategory, {
      name: "دسته سایت تست",
      description: "دسته تست",
      icon: "landmark",
      tone: "mint",
    });
    await t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).mutation(api.ratesAdmin.createCategory, {
      name: "دسته خدمت تست",
      description: "دسته تست",
      icon: "receipt",
      tone: "peach",
    });
  });

  test("a cafe owner cannot call platform admin APIs directly", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedOwner(t, "09121000041", "مالک غیرمجاز", "کافی‌نت عادی");
    const calls = [
      () => t.withIdentity({ subject: owner.userId }).query(api.admin.overview, {}),
      () =>
        t
          .withIdentity({ subject: owner.userId })
          .query(api.billingAdmin.overview, {}),
      () =>
        t
          .withIdentity({ subject: owner.userId })
          .query(api.newsAdmin.overview, {}),
      () =>
        t
          .withIdentity({ subject: owner.userId })
          .query(api.websitesAdmin.overview, {}),
      () =>
        t
          .withIdentity({ subject: owner.userId })
          .query(api.ratesAdmin.overview, {}),
      () =>
        t
          .withIdentity({ subject: owner.userId })
          .query(api.support.adminList, {}),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toThrow();
    }
  });

  test("email and SMS cannot be activated without a real delivery provider", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seedPlatformAdmin(t, "09129999995");
    await enrollOwner(t, adminId);
    await t
      .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
      .mutation(api.platformAdmin.ensureDefaults, {});
    const current = await t
      .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
      .query(api.platformAdmin.settings, {});
    if (!current) throw new Error("platform settings were not seeded");
    await expect(
      t.withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId }).mutation(api.platformAdmin.updateSettings, {
        platformName: current.platformName,
        tagline: current.tagline,
        logoUrl: current.logoUrl ?? undefined,
        supportEmail: current.supportEmail ?? undefined,
        supportPhone: current.supportPhone ?? undefined,
        supportAddress: current.supportAddress ?? undefined,
        instagramUrl: current.instagramUrl ?? undefined,
        telegramUrl: current.telegramUrl ?? undefined,
        whatsappUrl: current.whatsappUrl ?? undefined,
        websiteUrl: current.websiteUrl ?? undefined,
        timezone: current.timezone,
        locale: current.locale,
        defaultTheme: current.defaultTheme,
        registrationEnabled: current.registrationEnabled,
        notificationsEnabled: current.notificationsEnabled,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
        maintenanceMode: current.maintenanceMode,
        maintenanceMessage: current.maintenanceMessage ?? undefined,
        aiEnabled: current.aiEnabled,
        aiModel: current.aiModel,
        aiCostPerRequestToman: current.aiCostPerRequestToman,
        backupSchedule: current.backupSchedule,
        backupNote: current.backupNote ?? undefined,
      }),
    ).rejects.toThrow(/متصل نشده/);
    const after = await t
      .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
      .query(api.platformAdmin.settings, {});
    expect(after?.emailNotificationsEnabled).toBe(false);
    expect(after?.smsNotificationsEnabled).toBe(false);
  });

  test("bootstrap is limited to the configured owner phone and can happen only once", async () => {
    const t = convexTest(schema, modules);
    const first = await seedUser(t, "09121000051", "مالک سایت");
    const second = await seedUser(t, "09121000052", "کاربر دیگر");
    const original = process.env.SITE_ADMIN_BOOTSTRAP_PHONE;
    delete process.env.SITE_ADMIN_BOOTSTRAP_PHONE;
    try {
      await expect(
        t
          .withIdentity({ subject: first })
          .mutation(api.admin.claimSiteAdmin, {}),
      ).rejects.toThrow();

      await t.run(async ctx=>{await ctx.db.patch(first,{phoneVerificationTime:Date.now()});});
      process.env.SITE_ADMIN_BOOTSTRAP_PHONE = "09121000051";
      await expect(
        t
          .withIdentity({ subject: second })
          .mutation(api.admin.claimSiteAdmin, {}),
      ).rejects.toThrow();

      await expect(
        t
          .withIdentity({ subject: first })
          .mutation(api.admin.claimSiteAdmin, {}),
      ).resolves.toEqual({ ok: true });

      const context = await t
        .withIdentity({ subject: first })
        .query(api.tenancy.myContext, {});
      expect(context?.isSiteAdmin).toBe(true);

      const third = await seedUser(t, "09121000051", "کاربر دوم با همان شماره");
      await expect(
        t
          .withIdentity({ subject: third })
          .mutation(api.admin.claimSiteAdmin, {}),
      ).rejects.toThrow();
    } finally {
      if (original === undefined) {
        delete process.env.SITE_ADMIN_BOOTSTRAP_PHONE;
      } else {
        process.env.SITE_ADMIN_BOOTSTRAP_PHONE = original;
      }
    }
  });
});

describe("acceptance: pricing, subscriptions and payments", () => {
  test("a discount code cannot be redeemed beyond its capacity by two pending settlements", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const first = await seedOwner(t, "09121000061", "مالک اول", "کافی‌نت اول");
    const second = await seedOwner(t, "09121000062", "مالک دوم", "کافی‌نت دوم");
    await seedSubscription(t, first.cafeId, "pro");
    await seedSubscription(t, second.cafeId, "pro");
    const adminId = await seedPlatformAdmin(t, "09129999998");
    await seedDiscount(t, adminId, {
      code: "ACCEPT20",
      maxUses: 1,
      maxUsesPerCafe: 1,
    });

    const firstOrder = await t
      .withIdentity({ subject: first.userId })
      .mutation(api.billing.createOrder, {
        planCode: "pro",
        billingCycle: "monthly",
        discountCode: "ACCEPT20",
      });
    const secondOrder = await t
      .withIdentity({ subject: second.userId })
      .mutation(api.billing.createOrder, {
        planCode: "pro",
        billingCycle: "monthly",
        discountCode: "ACCEPT20",
      });
    expect(firstOrder.order.subtotalToman).toBe(100_000);
    expect(firstOrder.order.discountToman).toBe(20_000);
    expect(firstOrder.order.totalToman).toBe(80_000);
    expect(secondOrder.order.totalToman).toBe(80_000);

    await t.mutation(internal.billing.finalizePayment, {
      orderId: firstOrder.order.id,
      actorId: adminId,
      provider: "manual",
      kind: "manual",
      referenceId: "ACCEPT-REF-1",
      note: "تسویه تست",
    });
    await expect(
      t.mutation(internal.billing.finalizePayment, {
        orderId: secondOrder.order.id,
        actorId: adminId,
        provider: "manual",
        kind: "manual",
        referenceId: "ACCEPT-REF-2",
        note: "تسویه تست دوم",
      }),
    ).rejects.toThrow(/ظرفیت/);

    const state = await t.run(async (ctx) => {
      const firstDbOrder = await ctx.db.get(firstOrder.order.id);
      const secondDbOrder = await ctx.db.get(secondOrder.order.id);
      const invoices = await ctx.db.query("invoices").collect();
      const redemptions = await ctx.db.query("discount_redemptions").collect();
      return { firstDbOrder, secondDbOrder, invoices, redemptions };
    });
    expect(state.firstDbOrder?.status).toBe("paid");
    expect(state.secondDbOrder?.status).toBe("pending");
    expect(state.invoices).toHaveLength(1);
    expect(state.redemptions).toHaveLength(1);
  });

  test("settlement is idempotent and extends an active subscription by the ordered period", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const owner = await seedOwner(t, "09121000071", "مالک تمدید", "کافی‌نت تمدید");
    const oldEndsAt = Date.now() + 10 * DAY;
    await seedSubscription(t, owner.cafeId, "pro", oldEndsAt);
    const order = await t
      .withIdentity({ subject: owner.userId })
      .mutation(api.billing.createOrder, {
        planCode: "pro",
        billingCycle: "monthly",
      });
    const adminId = await seedPlatformAdmin(t, "09129999997");

    const firstInvoice = await t.mutation(internal.billing.finalizePayment, {
      orderId: order.order.id,
      actorId: adminId,
      provider: "manual",
      kind: "manual",
      referenceId: "RENEW-REF-1",
      note: "تمدید تست",
    });
    const secondInvoice = await t.mutation(internal.billing.finalizePayment, {
      orderId: order.order.id,
      actorId: adminId,
      provider: "manual",
      kind: "manual",
      referenceId: "RENEW-REF-1",
      note: "تکرار تمدید",
    });
    expect(secondInvoice).toBe(firstInvoice);

    const state = await t.run(async (ctx) => {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_cafe", (q) => q.eq("cafeId", owner.cafeId))
        .order("desc")
        .first();
      const invoices = await ctx.db.query("invoices").collect();
      const transactions = await ctx.db
        .query("payment_transactions")
        .collect();
      return { subscription, invoices, transactions };
    });
    expect(state.subscription?.endsAt).toBe(oldEndsAt + 30 * DAY);
    expect(state.invoices).toHaveLength(1);
    expect(state.transactions).toHaveLength(1);
  });

  test("an unconfigured payment gateway returns configured=false and never marks the order paid", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const owner = await seedOwner(t, "09121000081", "مالک پرداخت", "کافی‌نت پرداخت");
    await seedSubscription(t, owner.cafeId, "pro");
    const order = await t
      .withIdentity({ subject: owner.userId })
      .mutation(api.billing.createOrder, {
        planCode: "pro",
        billingCycle: "monthly",
      });
    const originalMerchant = process.env.ZARINPAL_MERCHANT_ID;
    const originalSite = process.env.SITE_URL;
    const originalVlySite = process.env.VLY_APP_URL;
    delete process.env.ZARINPAL_MERCHANT_ID;
    delete process.env.SITE_URL;
    delete process.env.VLY_APP_URL;
    try {
      const result = await t
        .withIdentity({ subject: owner.userId })
        .action(api.billing.startPayment, { orderId: order.order.id });
      expect(result.configured).toBe(false);
      expect(result.alreadyPaid).toBe(false);
      expect(result.redirectUrl).toBeNull();
      const dbOrder = await t.run(async (ctx) => ctx.db.get(order.order.id));
      expect(dbOrder?.status).toBe("pending");
    } finally {
      if (originalMerchant === undefined) delete process.env.ZARINPAL_MERCHANT_ID;
      else process.env.ZARINPAL_MERCHANT_ID = originalMerchant;
      if (originalSite === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = originalSite;
      if (originalVlySite === undefined) delete process.env.VLY_APP_URL;
      else process.env.VLY_APP_URL = originalVlySite;
    }
  });

  test("gateway status reflects the real server configuration", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seedPlatformAdmin(t, "09129999996");
    await enrollOwner(t, adminId);
    const originalMerchant = process.env.ZARINPAL_MERCHANT_ID;
    const originalSite = process.env.SITE_URL;
    const originalVlySite = process.env.VLY_APP_URL;
    delete process.env.ZARINPAL_MERCHANT_ID;
    delete process.env.SITE_URL;
    delete process.env.VLY_APP_URL;
    try {
      const disabled = await t
        .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
        .query(api.billingAdmin.settings, {});
      expect(disabled.gatewayConfigured).toBe(false);
      process.env.ZARINPAL_MERCHANT_ID = "test-merchant";
      const merchantOnly = await t
        .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
        .query(api.billingAdmin.settings, {});
      expect(merchantOnly.gatewayConfigured).toBe(false);
      process.env.SITE_URL = "https://example.test";
      const complete = await t
        .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
        .query(api.billingAdmin.settings, {});
      expect(complete.gatewayConfigured).toBe(true);
    } finally {
      if (originalMerchant === undefined) delete process.env.ZARINPAL_MERCHANT_ID;
      else process.env.ZARINPAL_MERCHANT_ID = originalMerchant;
      if (originalSite === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = originalSite;
      if (originalVlySite === undefined) delete process.env.VLY_APP_URL;
      else process.env.VLY_APP_URL = originalVlySite;
    }
  });

  test("a missing AI key produces an honest fallback without consuming the quota", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const owner = await seedOwner(t, "09121000092", "مالک بدون کلید", "کافی‌نت بدون کلید");
    await seedSubscription(t, owner.cafeId, "pro");
    const originalKey = process.env.VLY_INTEGRATION_KEY;
    delete process.env.VLY_INTEGRATION_KEY;
    try {
      const result = await t
        .withIdentity({ subject: owner.userId })
        .action(api.agent.ask, { message: "سلام، یک راهنمایی عمومی می‌خواهم" });
      expect(result.model).toBe("unavailable");
      expect(result.answer).toContain("برقرار نشد");
      const usage = await t.run(async (ctx) => {
        return await ctx.db
          .query("subscription_usage")
          .withIndex("by_cafe_period", (q) => q.eq("cafeId", owner.cafeId))
          .collect();
      });
      expect(usage).toHaveLength(0);
    } finally {
      if (originalKey === undefined) delete process.env.VLY_INTEGRATION_KEY;
      else process.env.VLY_INTEGRATION_KEY = originalKey;
    }
  });

  test("deterministic agent pricing works without AI and does not consume the AI quota", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const owner = await seedOwner(t, "09121000091", "مالک ایجنت", "کافی‌نت ایجنت");
    await seedSubscription(t, owner.cafeId, "pro");
    const service = await seedService(t, owner.userId, 100_000);

    const result = await t
      .withIdentity({ subject: owner.userId })
      .action(api.agent.ask, { message: "هزینه پرینت ۲ برگ چقدر است؟" });
    expect(result.calculation?.serviceId).toBe(service.serviceId);
    expect(result.calculation?.quantity).toBe(2);
    expect(result.calculation?.totalToman).toBe(200_000);
    expect(result.answer).toContain("۲۰۰");

    const usage = await t.run(async (ctx) => {
      return await ctx.db
        .query("subscription_usage")
        .withIndex("by_cafe_period", (q) => q.eq("cafeId", owner.cafeId))
        .collect();
    });
    expect(usage).toHaveLength(0);
  });

  test("site CMS seeds database-backed pages and exposes only published content", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seedPlatformAdmin(t, "09121000087");
    await t
      .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
      .mutation(api.platformAdmin.ensureDefaults, {});

    const publicSite = await t.query(api.siteCms.publicSite, {});
    expect(publicSite.theme.primaryColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(publicSite.home.heroTitle.length).toBeGreaterThan(5);
    expect(publicSite.pages.some((page) => page.slug === "about")).toBe(true);
    expect(publicSite.pages.some((page) => page.slug === "terms")).toBe(false);

    const about = await t.query(api.siteCms.publicPageBySlug, { slug: "about" });
    expect(about?.title).toContain("درباره");
    const hiddenTerms = await t.query(api.siteCms.publicPageBySlug, {
      slug: "terms",
    });
    expect(hiddenTerms).toBeNull();

  });

  test("draft, publish and restore are database-backed and stay off the public site", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await seedPlatformAdmin(t, "09121000084");
    await t
      .withIdentity({ subject: ownerId })
      .mutation(api.platformAdmin.ensureDefaults, {});
    const now = Date.now();
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("authSessions", {
        userId: ownerId,
        expirationTime: now + 60 * 60 * 1000,
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("admin_security", {
        userId: ownerId,
        totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
        mfaEnabled: true,
        enabledAt: now,
        lastMfaAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("admin_mfa_sessions", {
        sessionId,
        userId: ownerId,
        verifiedAt: now,
        expiresAt: now + 60 * 60 * 1000,
      });
    });
    const publicNavigation = await t.query(api.siteCms.publicNavigation, {
      location: "public",
    });
    expect(publicNavigation.length).toBeGreaterThan(0);
    const aboutPage = await t.query(api.siteCms.publicPageBySlug, {
      slug: "about",
    });
    expect(aboutPage?.title).toBeTruthy();

    const admin = t.withIdentity({ subject: `${ownerId}|${sessionId}` });
    const initial = await admin.query(api.siteCms.overview, {});
    expect(initial.settings.published.home.heroTitle).toBe(
      initial.settings.draft.home.heroTitle,
    );

    const firstTheme = {
      ...initial.settings.draft.theme,
      primaryColor: "#112233",
    };
    const firstHome = {
      ...initial.settings.draft.home,
      heroTitle: "عنوان پیش‌نویس اول",
    };
    await admin.mutation(api.siteCms.saveSettingsDraft, {
      settings: { theme: firstTheme, home: firstHome },
    });
    const beforePublish = await t.query(api.siteCms.publicSite, {});
    expect(beforePublish.theme.primaryColor).not.toBe("#112233");
    await admin.mutation(api.siteCms.publishSettings, {});
    const afterFirstPublish = await t.query(api.siteCms.publicSite, {});
    expect(afterFirstPublish.theme.primaryColor).toBe("#112233");
    expect(afterFirstPublish.home.heroTitle).toBe("عنوان پیش‌نویس اول");

    const platformSettings = await admin.query(api.platformAdmin.settings, {});
    if (!platformSettings) throw new Error("platform settings were not seeded");
    await admin.mutation(api.platformAdmin.updateSettings, {
      platformName: platformSettings.platformName,
      tagline: platformSettings.tagline,
      logoUrl: "https://example.test/logo.png",
      supportEmail: platformSettings.supportEmail ?? undefined,
      supportPhone: platformSettings.supportPhone ?? undefined,
      supportAddress: platformSettings.supportAddress ?? undefined,
      instagramUrl: platformSettings.instagramUrl ?? undefined,
      telegramUrl: platformSettings.telegramUrl ?? undefined,
      whatsappUrl: platformSettings.whatsappUrl ?? undefined,
      websiteUrl: platformSettings.websiteUrl ?? undefined,
      timezone: platformSettings.timezone,
      locale: platformSettings.locale,
      defaultTheme: platformSettings.defaultTheme,
      registrationEnabled: platformSettings.registrationEnabled,
      notificationsEnabled: platformSettings.notificationsEnabled,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
      maintenanceMode: platformSettings.maintenanceMode,
      maintenanceMessage: platformSettings.maintenanceMessage ?? undefined,
      aiEnabled: platformSettings.aiEnabled,
      aiModel: platformSettings.aiModel,
      aiCostPerRequestToman: platformSettings.aiCostPerRequestToman,
      backupSchedule: platformSettings.backupSchedule,
      backupNote: platformSettings.backupNote ?? undefined,
    });
    const publicProfile = await t.query(api.platformAdmin.publicProfile, {});
    expect(publicProfile.logoUrl).toBe("https://example.test/logo.png");

    const secondTheme = { ...firstTheme, primaryColor: "#445566" };
    await admin.mutation(api.siteCms.saveSettingsDraft, {
      settings: { theme: secondTheme, home: firstHome },
    });
    await admin.mutation(api.siteCms.publishSettings, {});
    const history = await admin.query(api.siteCms.history, {
      entityType: "site_settings",
    });
    expect(history.length).toBeGreaterThanOrEqual(2);
    const firstPublished = history[history.length - 1];
    await admin.mutation(api.siteCms.restoreSettingsVersion, {
      versionId: firstPublished.id,
    });
    const restored = await admin.query(api.siteCms.overview, {});
    expect(restored.settings.draft.theme.primaryColor).toBe("#112233");

    const about = restored.pages.find((page) => page.slug === "about");
    if (!about) throw new Error("about page was not seeded");
    await admin.mutation(api.siteCms.savePageDraft, {
      pageId: about.id,
      title: "عنوان آزمایشی صفحه",
      summary: "خلاصه آزمایشی",
      body: "متن آزمایشی صفحه که ابتدا پیش‌نویس است.",
      imageUrls: [],
      sortOrder: 10,
      status: "published",
    });
    const pageBeforePublish = await t.query(api.siteCms.publicPageBySlug, {
      slug: "about",
    });
    expect(pageBeforePublish?.title).not.toBe("عنوان آزمایشی صفحه");
    await admin.mutation(api.siteCms.publishPage, { pageId: about.id });
    const pageAfterPublish = await t.query(api.siteCms.publicPageBySlug, {
      slug: "about",
    });
    expect(pageAfterPublish?.title).toBe("عنوان آزمایشی صفحه");
  });

  test("a disabled CMS feature is rejected by the server, not only hidden in the UI", async () => {
    const t = convexTest(schema, modules);
    await seedPlan(t, "pro");
    const adminId = await seedPlatformAdmin(t, "09121000086");
    await t
      .withIdentity({ subject: verifiedSubjects.get(adminId) ?? adminId })
      .mutation(api.platformAdmin.ensureDefaults, {});
    const owner = await seedOwner(
      t,
      "09121000085",
      "مالک قابلیت",
      "کافی‌نت قابلیت",
    );
    await seedSubscription(t, owner.cafeId, "pro");
    await t.run(async (ctx) => {
      const flag = await ctx.db
        .query("feature_flags")
        .withIndex("by_key", (q) => q.eq("key", "rates"))
        .first();
      if (flag) await ctx.db.patch(flag._id, { isEnabled: false });
    });
    await expect(
      t
        .withIdentity({ subject: owner.userId })
        .query(api.rates.catalog, {}),
    ).rejects.toThrow(/غیرفعال/);
  });

  test("the owner console stays locked until second-factor enrollment", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await seedPlatformAdmin(t, "09121000089");
    const identity = t.withIdentity({ subject: ownerId });

    const status = await identity.query(api.superAdmin.securityStatus, {});
    expect(status?.isPlatformOwner).toBe(true);
    expect(status?.mfaEnabled).toBe(false);

    await expect(identity.query(api.superAdmin.sessions, {})).rejects.toThrow(
      /دومرحله/,
    );
    await expect(
      identity.query(api.superAdmin.settingsHistory, {}),
    ).rejects.toThrow(/دومرحله/);

    const setup = await identity.mutation(api.superAdmin.beginMfaSetup, {});
    expect(setup.secret.length).toBeGreaterThan(10);
    expect(setup.uri).toContain("otpauth://");
    const stored = await t.run(async (ctx) =>
      ctx.db
        .query("admin_security")
        .withIndex("by_user", (q) => q.eq("userId", ownerId))
        .first(),
    );
    expect(stored?.mfaEnabled).toBe(false);

    const cafeOwner = await seedOwner(
      t,
      "09121000088",
      "مالک عادی",
      "کافی‌نت عادی",
    );
    await expect(
      t
        .withIdentity({ subject: cafeOwner.userId })
        .query(api.superAdmin.securityStatus, {}),
    ).resolves.toMatchObject({ isPlatformOwner: false });
    await expect(
      t
        .withIdentity({ subject: cafeOwner.userId })
        .query(api.superAdmin.activity, {}),
    ).rejects.toThrow();
  });
});
