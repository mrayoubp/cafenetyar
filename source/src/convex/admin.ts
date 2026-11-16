import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdminPermission, requireSession } from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { normalizePlanCode, monthlyPrice } from "./lib/billing";
import {
  configuredAdminBootstrapPhone,
  ensurePlatformDefaults,
  logAudit,
} from "./lib/platform";
import { normalizePhone } from "./lib/validation";
import { ensureDefaultPlans, ensurePermissionCatalog } from "./tenancy";
import { fail } from "./lib/validation";
import { ROLES, subscriptionStatusValidator } from "./schema";
import { cafeStatusValidator } from "./schema";

const DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(now: number) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcMonth(now: number) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function startOfUtcYear(now: number) {
  return Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
}

function monthKey(value: number) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recentMonthKeys(count: number) {
  const now = new Date();
  const keys: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    keys.push(monthKey(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1)));
  }
  return keys;
}

async function logBilling(
  ctx: MutationCtx,
  actorId: Id<"users">,
  type: string,
  description: string,
  cafeId?: Id<"internet_cafes">,
) {
  await ctx.db.insert("billing_events", {
    cafeId,
    actorId,
    type,
    description,
    createdAt: Date.now(),
  });
}

function effectiveStatus(
  status: "trial" | "active" | "expired" | "canceled" | "pending_payment",
  endsAt: number,
) {
  if (status === "canceled") return "canceled" as const;
  if (status === "pending_payment") return "pending_payment" as const;
  if (endsAt < Date.now()) return "expired" as const;
  return status;
}

/**
 * Bootstrap helper for the admin login screen: whether a site administrator
 * has already been claimed. Only an authenticated user may ask.
 */
export const adminExists = query({
  args: {},
  handler: async (ctx) => {
    await requireSession(ctx);
    const admin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", ROLES.ADMIN))
      .first();
    if (admin) return true;
    const teamMember = await ctx.db.query("admin_user_roles").first();
    return teamMember !== null;
  },
});

/**
 * Claims the site-admin role, but only while no administrator exists.
 * This is the one-time bootstrap path for a fresh deployment.
 */
export const claimSiteAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSession(ctx);
    if (session.isSiteAdmin) return { ok: true };
    if (session.isGuest) {
      fail("forbidden", "حساب مهمان نمی‌تواند مدیر اصلی شود.");
    }
    if (session.employee) {
      fail(
        "forbidden",
        "حساب کارمند نمی‌تواند نقش مدیر اصلی سایت را فعال کند.",
      );
    }
    if (session.cafe && session.cafe.status !== "active") {
      fail(
        "suspended",
        "حساب کافی‌نت غیرفعال نمی‌تواند نقش مدیر اصلی را فعال کند.",
      );
    }
    const bootstrapPhone = configuredAdminBootstrapPhone();
    if (!bootstrapPhone) {
      fail(
        "forbidden",
        "فعال‌سازی مدیر اصلی نیازمند تنظیم شماره مجاز راه‌اندازی در تنظیمات سرور است.",
      );
    }
    if (!session.user.phoneVerificationTime) fail("forbidden", "ابتدا مالکیت شماره موبایل باید تأیید شود.");
    const sessionPhone = normalizePhone(session.user.phone ?? "");
    if (!sessionPhone || sessionPhone !== bootstrapPhone) {
      fail(
        "forbidden",
        "این حساب برای فعال‌سازی نقش مدیر اصلی مجاز نیست.",
      );
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", ROLES.ADMIN))
      .first();
    const existingTeam = await ctx.db.query("admin_user_roles").first();
    if (existing || existingTeam) {
      fail("conflict", "مدیر اصلی سایت قبلاً انتخاب شده است.");
    }
    await ctx.db.patch(session.user._id, { role: ROLES.ADMIN });
    await ensurePlatformDefaults(ctx);
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "admin.bootstrapped",
      entityType: "user",
      entityId: session.user._id,
      summary: "نقش مدیر اصلی برای حساب بنیان‌گذار فعال شد.",
    });
    return { ok: true };
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.DASHBOARD_VIEW);
    const now = Date.now();
    const dayStart = startOfUtcDay(now);
    const monthStart = startOfUtcMonth(now);
    const yearStart = startOfUtcYear(now);
    const soon = now + 7 * DAY;
    const cafes = await ctx.db.query("internet_cafes").collect();
    const employees = await ctx.db.query("employees").collect();
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const users = await ctx.db.query("users").collect();
    const plans = await ctx.db
      .query("subscription_plans")
      .withIndex("by_sort_order")
      .collect();
    const orders = await ctx.db.query("payment_orders").collect();
    const invoices = await ctx.db.query("invoices").collect();
    const usage = await ctx.db.query("subscription_usage").collect();
    const runs = await ctx.db.query("agent_runs").take(2000);
    const news = await ctx.db.query("news").collect();
    const tickets = await ctx.db.query("support_tickets").collect();
    const audits = await ctx.db
      .query("audit_logs")
      .withIndex("by_created")
      .order("desc")
      .take(12);
    const actorIds = [...new Set(audits.map((row) => row.actorId))];
    const actorById = new Map(
      await Promise.all(
        actorIds.map(async (id) => [id, await ctx.db.get(id)] as const),
      ),
    );

    const statusCounts = {
      trial: 0,
      active: 0,
      expired: 0,
      canceled: 0,
      pending_payment: 0,
    };
    let expiringSoon = 0;
    let monthly = 0;
    let yearly = 0;
    for (const subscription of subscriptions) {
      statusCounts[
        effectiveStatus(subscription.status, subscription.endsAt)
      ] += 1;
      if (
        subscription.status !== "canceled" &&
        subscription.endsAt >= now &&
        subscription.endsAt <= soon
      ) {
        expiringSoon += 1;
      }
      if (
        (subscription.status === "active" ||
          subscription.status === "trial") &&
        subscription.endsAt >= now
      ) {
        if (subscription.billingCycle === "yearly") yearly += 1;
        else monthly += 1;
      }
    }

    const paidInvoices = invoices.filter((row) => row.status === "paid");
    const paidOrders = orders.filter((row) => row.status === "paid");
    const failedOrders = orders.filter((row) => row.status === "failed");
    const revenueFor = (from: number) =>
      paidInvoices
        .filter((invoice) => (invoice.paidAt ?? invoice.issuedAt) >= from)
        .reduce((sum, invoice) => sum + invoice.totalToman, 0);
    const aiRequestTotal = usage.reduce((sum, row) => sum + row.aiRequests, 0);
    const months = recentMonthKeys(8);
    const chart = months.map((month) => ({
      month,
      revenueToman: paidInvoices
        .filter((invoice) => monthKey(invoice.paidAt ?? invoice.issuedAt) === month)
        .reduce((sum, invoice) => sum + invoice.totalToman, 0),
      newCafes: cafes.filter((cafe) => monthKey(cafe.createdAt) === month).length,
      newUsers: users.filter((user) => monthKey(user._creationTime) === month)
        .length,
      newSubscriptions: subscriptions.filter(
        (subscription) => monthKey(subscription.createdAt) === month,
      ).length,
    }));

    return {
      cafes: {
        total: cafes.length,
        active: cafes.filter((cafe) => cafe.status === "active").length,
        suspended: cafes.filter((cafe) => cafe.status === "suspended").length,
      },
      employees: {
        total: employees.length,
        active: employees.filter((employee) => employee.active).length,
      },
      users: users.filter((user) => !user.isAnonymous).length,
      usersTotal: users.filter((user) => !user.isAnonymous).length,
      subscriptions: { ...statusCounts, expiringSoon, monthly, yearly },
      revenue: {
        todayToman: revenueFor(dayStart),
        monthToman: revenueFor(monthStart),
        yearToman: revenueFor(yearStart),
        successfulPayments: paidOrders.length,
        failedPayments: failedOrders.length,
        pendingPayments: orders.filter((row) => row.status === "pending").length,
      },
      ai: {
        requests: aiRequestTotal,
        runs: runs.length,
        aiRuns: runs.filter((row) => row.route === "ai").length,
        errors: runs.filter((row) => row.status === "error").length,
      },
      news: {
        published: news.filter((item) => item.status === "published").length,
        pending: news.filter((item) => item.status === "pending").length,
        total: news.length,
      },
      support: {
        open: tickets.filter((row) => row.status === "open").length,
        inProgress: tickets.filter((row) => row.status === "in_progress")
          .length,
        urgent: tickets.filter(
          (row) => row.priority === "urgent" && row.status !== "closed",
        ).length,
      },
      plans: plans
        .filter((plan) => !["monthly", "yearly"].includes(plan.code))
        .map((plan) => ({
          code: plan.code,
          name: plan.name,
          durationDays: plan.durationDays,
          priceToman: monthlyPrice(plan),
          isActive: plan.isActive,
          subscribers: subscriptions.filter(
            (row) =>
              normalizePlanCode(row.planCode) === plan.code &&
              effectiveStatus(row.status, row.endsAt) === "active",
          ).length,
        })),
      chart,
      recentAudit: audits.map((row) => ({
        id: row._id,
        actorName: actorById.get(row.actorId)?.name ?? "مدیر",
        action: row.action,
        summary: row.summary,
        createdAt: row.createdAt,
      })),
      generatedAt: now,
    };
  },
});

export const listCafes = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(cafeStatusValidator),
    subscriptionStatus: v.optional(subscriptionStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.CAFES_VIEW);
    const cafes = await ctx.db.query("internet_cafes").collect();
    const search = args.search?.trim().toLocaleLowerCase("fa") ?? "";

    const rows = [];
    for (const cafe of cafes) {
      if (args.status && cafe.status !== args.status) continue;
      const owner = await ctx.db.get(cafe.ownerId);
      const subscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("by_cafe", (q) => q.eq("cafeId", cafe._id))
        .collect();
      const subscription =
        subscriptions.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
      const subscriptionStatus = subscription
        ? effectiveStatus(subscription.status, subscription.endsAt)
        : null;
      if (args.subscriptionStatus && subscriptionStatus !== args.subscriptionStatus) {
        continue;
      }
      const employees = await ctx.db
        .query("employees")
        .withIndex("by_cafe", (q) => q.eq("cafeId", cafe._id))
        .collect();
      const plan = subscription
        ? await ctx.db
            .query("subscription_plans")
            .withIndex("by_code", (q) =>
              q.eq("code", normalizePlanCode(subscription.planCode)),
            )
            .first()
        : null;

      const row = {
        id: cafe._id,
        name: cafe.name,
        province: cafe.province,
        city: cafe.city,
        address: cafe.address,
        status: cafe.status,
        createdAt: cafe.createdAt,
        ownerName: owner?.name ?? "بدون نام",
        ownerPhone: owner?.phone ?? null,
        employeeCount: employees.length,
        activeEmployeeCount: employees.filter((employee) => employee.active)
          .length,
        lastActivityAt: Math.max(
          cafe.updatedAt,
          subscription?.updatedAt ?? 0,
        ),
        subscription: subscription
          ? {
              planCode: normalizePlanCode(subscription.planCode),
              planName: plan?.name ?? subscription.planCode,
              status: subscriptionStatus,
              endsAt: subscription.endsAt,
              billingCycle: subscription.billingCycle ?? null,
            }
          : null,
      };

      if (!search) {
        rows.push(row);
        continue;
      }
      const haystack = [
        row.id,
        row.name,
        row.city,
        row.province,
        row.status === "active" ? "فعال" : "غیرفعال",
        row.subscription?.status ?? "",
        row.ownerName,
        row.ownerPhone ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("fa");
      if (haystack.includes(search)) rows.push(row);
    }

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const cafeDetails = query({
  args: { cafeId: v.id("internet_cafes") },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.CAFES_VIEW);
    const cafe = await ctx.db.get(args.cafeId);
    if (!cafe) fail("not_found", "کافی‌نت پیدا نشد.");
    const owner = await ctx.db.get(cafe.ownerId);
    const employees = await ctx.db
      .query("employees")
      .withIndex("by_cafe", (q) => q.eq("cafeId", cafe._id))
      .collect();
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_cafe", (q) => q.eq("cafeId", cafe._id))
      .collect();
    const subscription =
      subscriptions.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
    const plan = subscription
      ? await ctx.db
          .query("subscription_plans")
          .withIndex("by_code", (q) =>
            q.eq("code", normalizePlanCode(subscription.planCode)),
          )
          .first()
      : null;
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_cafe_issued", (q) => q.eq("cafeId", cafe._id))
      .order("desc")
      .take(12);
    const orders = await ctx.db
      .query("payment_orders")
      .withIndex("by_cafe_created", (q) => q.eq("cafeId", cafe._id))
      .order("desc")
      .take(12);
    const audits = await ctx.db
      .query("audit_logs")
      .withIndex("by_cafe_created", (q) => q.eq("cafeId", cafe._id))
      .order("desc")
      .take(20);
    const runs = await ctx.db
      .query("agent_runs")
      .withIndex("by_cafe_created", (q) => q.eq("cafeId", cafe._id))
      .order("desc")
      .take(20);
    const auditActors = new Map(
      await Promise.all(
        [...new Set(audits.map((row) => row.actorId))].map(
          async (id) => [id, await ctx.db.get(id)] as const,
        ),
      ),
    );
    return {
      id: cafe._id,
      name: cafe.name,
      province: cafe.province,
      city: cafe.city,
      address: cafe.address,
      status: cafe.status,
      createdAt: cafe.createdAt,
      updatedAt: cafe.updatedAt,
      owner: {
        id: cafe.ownerId,
        name: owner?.name ?? "بدون نام",
        phone: owner?.phone ?? null,
        blocked: owner?.isBlocked === true,
      },
      employees: employees.map((employee) => ({
        id: employee._id,
        name: employee.fullName,
        phone: employee.phone,
        roleTitle: employee.roleTitle ?? null,
        active: employee.active,
        permissions: employee.permissions,
        lastActivityAt: employee.updatedAt,
      })),
      subscription: subscription
        ? {
            planCode: normalizePlanCode(subscription.planCode),
            planName: plan?.name ?? subscription.planCode,
            status: effectiveStatus(subscription.status, subscription.endsAt),
            startsAt: subscription.startsAt,
            endsAt: subscription.endsAt,
            billingCycle: subscription.billingCycle ?? null,
            lastPaymentAt: subscription.lastPaymentAt ?? null,
          }
        : null,
      invoices: invoices.map((invoice) => ({
        id: invoice._id,
        number: invoice.number,
        totalToman: invoice.totalToman,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
      })),
      orders: orders.map((order) => ({
        id: order._id,
        number: order.orderNumber,
        totalToman: order.totalToman,
        status: order.status,
        createdAt: order.createdAt,
      })),
      activity: [
        ...audits.map((row) => ({
          id: row._id,
          type: "audit" as const,
          summary: row.summary,
          actorName: auditActors.get(row.actorId)?.name ?? "مدیر",
          createdAt: row.createdAt,
        })),
        ...runs.map((row) => ({
          id: row._id,
          type: "ai" as const,
          summary: `درخواست ایجنت (${row.status})`,
          actorName: "ایجنت",
          createdAt: row.createdAt,
        })),
      ]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 25),
    };
  },
});

export const recordCafeAccess = mutation({
  args: { cafeId: v.id("internet_cafes") },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.CAFES_VIEW,
    );
    const cafe = await ctx.db.get(args.cafeId);
    if (!cafe) fail("not_found", "کافی‌نت پیدا نشد.");
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "cafe.sensitive_view",
      entityType: "internet_cafe",
      entityId: args.cafeId,
      cafeId: args.cafeId,
      summary: `اطلاعات حساس کافی‌نت ${cafe.name} مشاهده شد.`,
    });
    return { ok: true };
  },
});

export const setCafeStatus = mutation({
  args: { cafeId: v.id("internet_cafes"), status: cafeStatusValidator },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.CAFES_MANAGE,
    );
    const cafe = await ctx.db.get(args.cafeId);
    if (!cafe) fail("not_found", "کافی‌نت مورد نظر پیدا نشد.");
    await ctx.db.patch(args.cafeId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "cafe.status_changed",
      entityType: "internet_cafe",
      entityId: args.cafeId,
      cafeId: args.cafeId,
      summary: `وضعیت کافی‌نت ${cafe.name} به ${args.status === "active" ? "فعال" : "غیرفعال"} تغییر کرد.`,
    });
    await logBilling(
      ctx,
      session.user._id,
      "cafe_status_changed",
      `وضعیت کافی‌نت ${cafe.name} به ${args.status} تغییر کرد.`,
      args.cafeId,
    );
    return { ok: true };
  },
});

export const updateSubscription = mutation({
  args: {
    cafeId: v.id("internet_cafes"),
    planCode: v.string(),
    status: subscriptionStatusValidator,
    endsAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.FINANCE_MANAGE,
    );
    const cafe = await ctx.db.get(args.cafeId);
    if (!cafe) fail("not_found", "کافی‌نت مورد نظر پیدا نشد.");
    const plan = await ctx.db
      .query("subscription_plans")
      .withIndex("by_code", (q) => q.eq("code", args.planCode))
      .first();
    if (!plan) fail("validation", "طرح اشتراک انتخاب‌شده معتبر نیست.");
    if (!Number.isFinite(args.endsAt)) {
      fail("validation", "تاریخ پایان اشتراک معتبر نیست.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_cafe", (q) => q.eq("cafeId", args.cafeId))
      .first();
    if (existing) {
      if (args.endsAt <= existing.startsAt) {
        fail("validation", "تاریخ پایان باید بعد از شروع اشتراک باشد.");
      }
      await ctx.db.patch(existing._id, {
        planCode: plan.code,
        status: args.status,
        endsAt: args.endsAt,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        cafeId: args.cafeId,
        planCode: plan.code,
        status: args.status,
        startsAt: now,
        endsAt: args.endsAt,
        createdAt: now,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    }
    await logBilling(
      ctx,
      session.user._id,
      "subscription_changed",
      `اشتراک ${cafe.name} به ${plan.name} با وضعیت ${args.status} تغییر کرد.`,
      args.cafeId,
    );
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "subscription.changed",
      entityType: "subscription",
      entityId: args.cafeId,
      cafeId: args.cafeId,
      summary: `اشتراک ${cafe.name} به ${plan.name} (${args.status}) تغییر کرد.`,
    });
    return { ok: true };
  },
});

export const extendSubscription = mutation({
  args: { cafeId: v.id("internet_cafes"), days: v.number() },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.FINANCE_MANAGE,
    );
    const cafe = await ctx.db.get(args.cafeId);
    if (!cafe) fail("not_found", "کافی‌نت مورد نظر پیدا نشد.");
    if (!Number.isInteger(args.days) || args.days <= 0 || args.days > 3650) {
      fail("validation", "تعداد روزهای تمدید معتبر نیست.");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_cafe", (q) => q.eq("cafeId", args.cafeId))
      .first();
    if (!existing) {
      await ctx.db.insert("subscriptions", {
        cafeId: args.cafeId,
        planCode: "basic",
        status: "active",
        startsAt: now,
        endsAt: now + args.days * DAY,
        createdAt: now,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    } else {
      await ctx.db.patch(existing._id, {
        status: "active",
        endsAt: Math.max(now, existing.endsAt) + args.days * DAY,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    }
    await logBilling(
      ctx,
      session.user._id,
      "subscription_extended",
      `اشتراک ${cafe.name} به مدت ${args.days} روز تمدید شد.`,
      args.cafeId,
    );
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "subscription.extended",
      entityType: "subscription",
      entityId: args.cafeId,
      cafeId: args.cafeId,
      summary: `اشتراک ${cafe.name} به مدت ${args.days} روز تمدید شد.`,
    });
    return { ok: true };
  },
});

export const ensurePlans = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.FINANCE_MANAGE,
    );
    await ensureDefaultPlans(ctx);
    await ensurePermissionCatalog(ctx);
    await ensurePlatformDefaults(ctx);
    await logBilling(
      ctx,
      session.user._id,
      "plans_seeded",
      "کاتالوگ پلن‌ها و تنظیمات پیش‌فرض مالی بررسی شد.",
    );
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "plans.seeded",
      entityType: "subscription_plan",
      summary: "کاتالوگ پلن‌ها و تنظیمات پیش‌فرض مالی بررسی شد.",
    });
    return { ok: true };
  },
});
