import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { requireAdminPermission } from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import {
  DAY,
  LEGACY_PLAN_CODES,
  effectiveSubscriptionStatus,
  getPlan,
  isPaymentGatewayConfigured,
  monthlyPrice,
  normalizePlanCode,
  yearlyPrice,
} from "./lib/billing";
import { logAudit } from "./lib/platform";
import { fail, requireText } from "./lib/validation";
import {
  billingCycleValidator,
  discountTypeValidator,
  planEntitlementsValidator,
  subscriptionStatusValidator,
} from "./schema";

type AdminCtx = MutationCtx;

/** All billing admin surfaces require the finance permission. */
function requireSiteAdmin(ctx: Parameters<typeof requireAdminPermission>[0]) {
  return requireAdminPermission(ctx, ADMIN_PERMISSIONS.FINANCE_MANAGE);
}

function optionalText(value: string | undefined, label: string, max: number) {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  if (text.length > max) {
    fail("validation", `${label} نباید بیشتر از ${max} نویسه باشد.`);
  }
  return text;
}

async function log(
  ctx: AdminCtx,
  actorId: Id<"users">,
  type: string,
  description: string,
  cafeId?: Id<"internet_cafes">,
  metadata?: string,
) {
  await ctx.db.insert("billing_events", {
    cafeId,
    actorId,
    type,
    description,
    metadata,
    createdAt: Date.now(),
  });
  await logAudit(ctx, {
    actorId,
    action: `finance.${type}`,
    entityType: "billing",
    cafeId,
    summary: description,
    metadata,
  });
}

function normalizedCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function planView(plan: Doc<"subscription_plans">) {
  return {
    id: plan._id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? null,
    durationDays: plan.durationDays,
    monthlyPriceToman: monthlyPrice(plan),
    yearlyPriceToman: yearlyPrice(plan),
    yearlyDiscountPercent: plan.yearlyDiscountPercent ?? 0,
    features: plan.features,
    entitlements:
      plan.entitlements ??
      ({
        maxEmployees: 0,
        aiRequestsPerMonth: 0,
        agent: false,
        rates: false,
        accounting: "limited",
        advancedReports: false,
        advancedManagement: false,
        prioritySupport: false,
      } as const),
    isTrial: plan.isTrial === true,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
  };
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const cafes = await ctx.db.query("internet_cafes").collect();
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const plans = await ctx.db.query("subscription_plans").collect();
    const orders = await ctx.db.query("payment_orders").collect();
    const invoices = await ctx.db.query("invoices").collect();
    const discounts = await ctx.db.query("discount_codes").collect();
    const settings = await ctx.db
      .query("billing_settings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();
    const now = Date.now();
    const active = subscriptions.filter((row) => {
      const status = effectiveSubscriptionStatus(row, now);
      return status === "active" || status === "trial";
    });
    const statusCounts = {
      active: 0,
      trial: 0,
      expired: 0,
      canceled: 0,
      pending_payment: 0,
    };
    for (const row of subscriptions) {
      statusCounts[effectiveSubscriptionStatus(row, now)] += 1;
    }
    const planCounts = new Map<string, number>();
    for (const row of active) {
      const code = normalizePlanCode(row.planCode);
      planCounts.set(code, (planCounts.get(code) ?? 0) + 1);
    }
    const paid = invoices.filter((row) => row.status === "paid");
    const monthStart = new Date(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      1,
    ).getTime();
    return {
      cafes: cafes.length,
      subscribers: active.length,
      expiringSoon: active.filter(
        (row) => row.endsAt > now && row.endsAt <= now + 7 * DAY,
      ).length,
      statusCounts,
      plans: plans
        .filter(
          (plan) =>
            !(LEGACY_PLAN_CODES as readonly string[]).includes(plan.code),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((plan) => ({
          ...planView(plan),
          subscribers: planCounts.get(plan.code) ?? 0,
        })),
      revenue: {
        totalToman: paid.reduce((sum, row) => sum + row.totalToman, 0),
        thisMonthToman: paid
          .filter((row) => (row.paidAt ?? row.issuedAt) >= monthStart)
          .reduce((sum, row) => sum + row.totalToman, 0),
        paidInvoices: paid.length,
        pendingOrders: orders.filter((row) => row.status === "pending").length,
      },
      discounts: {
        total: discounts.length,
        active: discounts.filter((row) => row.isActive).length,
      },
      settings: settings
        ? {
            allowTrialReuse: settings.allowTrialReuse,
            gatewayProvider: settings.gatewayProvider,
          }
        : { allowTrialReuse: false, gatewayProvider: "zarinpal" },
      serverNow: now,
    };
  },
});

export const plans = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const rows = await ctx.db
      .query("subscription_plans")
      .withIndex("by_sort_order")
      .collect();
    return rows
      .filter(
        (plan) =>
          !(LEGACY_PLAN_CODES as readonly string[]).includes(plan.code),
      )
      .map(planView);
  },
});

export const subscribers = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const now = Date.now();
    const search = args.search?.trim().toLocaleLowerCase("fa") ?? "";
    const cafes = await ctx.db.query("internet_cafes").collect();
    const plans = await ctx.db.query("subscription_plans").collect();
    const planByCode = new Map(plans.map((plan) => [plan.code, plan]));
    const rows = [];
    for (const cafe of cafes) {
      const owner = await ctx.db.get(cafe.ownerId);
      const subscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("by_cafe", (q) => q.eq("cafeId", cafe._id))
        .collect();
      const subscription =
        subscriptions.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
      const plan = subscription
        ? planByCode.get(normalizePlanCode(subscription.planCode)) ?? null
        : null;
      const employees = await ctx.db
        .query("employees")
        .withIndex("by_cafe", (q) => q.eq("cafeId", cafe._id))
        .collect();
      const usage = subscription
        ? await ctx.db
            .query("subscription_usage")
            .withIndex("by_cafe_period", (q) =>
              q
                .eq("cafeId", cafe._id)
                .eq(
                  "periodKey",
                  `${new Date(now).getUTCFullYear()}-${String(
                    new Date(now).getUTCMonth() + 1,
                  ).padStart(2, "0")}`,
                ),
            )
            .first()
        : null;
      const status = effectiveSubscriptionStatus(subscription, now);
      const haystack = [
        cafe.name,
        cafe.city,
        cafe.province,
        owner?.name ?? "",
        owner?.phone ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("fa");
      if (search && !haystack.includes(search)) continue;
      rows.push({
        cafeId: cafe._id,
        cafeName: cafe.name,
        city: cafe.city,
        province: cafe.province,
        cafeStatus: cafe.status,
        ownerName: owner?.name ?? "بدون نام",
        ownerPhone: owner?.phone ?? null,
        employeeCount: employees.length,
        planCode: subscription
          ? normalizePlanCode(subscription.planCode)
          : null,
        planName: plan?.name ?? subscription?.planCode ?? null,
        status,
        startsAt: subscription?.startsAt ?? null,
        endsAt: subscription?.endsAt ?? null,
        billingCycle: subscription?.billingCycle ?? null,
        lastPaymentAt: subscription?.lastPaymentAt ?? null,
        renewalAt: subscription?.renewalAt ?? subscription?.endsAt ?? null,
        daysLeft: subscription
          ? Math.max(0, Math.ceil((subscription.endsAt - now) / DAY))
          : 0,
        trialUsed: cafe.trialUsedAt !== undefined,
        aiUsed: usage?.aiRequests ?? 0,
        aiLimit: plan?.entitlements?.aiRequestsPerMonth ?? null,
      });
    }
    return rows.sort((a, b) => b.daysLeft - a.daysLeft);
  },
});

export const payments = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const orders = await ctx.db
      .query("payment_orders")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);
    const allOrders = await ctx.db.query("payment_orders").collect();
    const merged = [...new Map(
      [...orders, ...allOrders.sort((a, b) => b.createdAt - a.createdAt).slice(0, 300)].map(
        (row) => [row._id, row],
      ),
    ).values()].sort((a, b) => b.createdAt - a.createdAt);
    const cafes = await ctx.db.query("internet_cafes").collect();
    const cafeById = new Map(cafes.map((cafe) => [cafe._id, cafe]));
    const invoices = await ctx.db.query("invoices").collect();
    const invoiceByOrder = new Map(
      invoices.map((invoice) => [invoice.orderId, invoice]),
    );
    const transactions = await ctx.db.query("payment_transactions").collect();
    const search = args.search?.trim().toLocaleLowerCase("fa") ?? "";
    return merged
      .map((order) => {
        const cafe = cafeById.get(order.cafeId);
        const invoice = invoiceByOrder.get(order._id);
        const tx = transactions
          .filter((row) => row.orderId === order._id)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          cafeName: cafe?.name ?? "کافی‌نت حذف‌شده",
          planCode: order.planCode,
          billingCycle: order.billingCycle,
          subtotalToman: order.subtotalToman,
          discountToman: order.discountToman,
          totalToman: order.totalToman,
          discountCode: order.discountCode ?? null,
          status: order.status,
          gateway: order.gateway ?? null,
          authority: order.authority ?? null,
          referenceId: order.referenceId ?? null,
          failureReason: order.failureReason ?? null,
          invoiceNumber: invoice?.number ?? null,
          invoiceStatus: invoice?.status ?? null,
          transactionStatus: tx?.status ?? null,
          transactionKind: tx?.kind ?? null,
          paidAt: order.paidAt ?? null,
          createdAt: order.createdAt,
          cafeId: order.cafeId,
        };
      })
      .filter((row) => {
        if (!search) return true;
        return `${row.cafeName} ${row.orderNumber} ${row.planCode} ${row.referenceId ?? ""}`
          .toLocaleLowerCase("fa")
          .includes(search);
      });
  },
});

export const discounts = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const codes = await ctx.db
      .query("discount_codes")
      .withIndex("by_created")
      .order("desc")
      .collect();
    const redemptions = await ctx.db.query("discount_redemptions").collect();
    return codes.map((code) => {
      const rows = redemptions.filter((row) => row.codeId === code._id);
      return {
        id: code._id,
        code: code.code,
        title: code.title,
        discountType: code.discountType,
        value: code.value,
        startsAt: code.startsAt,
        endsAt: code.endsAt,
        maxUses: code.maxUses,
        maxUsesPerCafe: code.maxUsesPerCafe,
        applicablePlans: code.applicablePlans,
        isActive: code.isActive,
        usedCount: rows.length,
        discountTotalToman: rows.reduce(
          (sum, row) => sum + row.discountToman,
          0,
        ),
        createdAt: code.createdAt,
      };
    });
  },
});

export const events = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const rows = await ctx.db
      .query("billing_events")
      .withIndex("by_created")
      .order("desc")
      .take(150);
    const actors = await ctx.db.query("users").collect();
    const cafes = await ctx.db.query("internet_cafes").collect();
    const actorById = new Map(actors.map((actor) => [actor._id, actor]));
    const cafeById = new Map(cafes.map((cafe) => [cafe._id, cafe]));
    return rows.map((row) => ({
      id: row._id,
      type: row.type,
      description: row.description,
      cafeName: row.cafeId ? cafeById.get(row.cafeId)?.name ?? null : null,
      actorName: actorById.get(row.actorId)?.name ?? "مدیر",
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
    }));
  },
});

export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const row = await ctx.db
      .query("billing_settings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();
    const trial = await getPlan(ctx, "trial");
    return {
      allowTrialReuse: row?.allowTrialReuse ?? false,
      gatewayProvider: row?.gatewayProvider ?? "zarinpal",
      trial: trial ? planView(trial) : null,
      gatewayConfigured: isPaymentGatewayConfigured(),
    };
  },
});

export const reports = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const invoices = (await ctx.db.query("invoices").collect()).filter(
      (row) => row.status === "paid",
    );
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const plans = await ctx.db.query("subscription_plans").collect();
    const now = Date.now();
    const monthly = new Map<string, { revenue: number; invoices: number }>();
    const yearly = new Map<string, { revenue: number; invoices: number }>();
    for (const invoice of invoices) {
      const at = new Date(invoice.paidAt ?? invoice.issuedAt);
      const monthKey = `${at.getUTCFullYear()}-${String(
        at.getUTCMonth() + 1,
      ).padStart(2, "0")}`;
      const yearKey = String(at.getUTCFullYear());
      const m = monthly.get(monthKey) ?? { revenue: 0, invoices: 0 };
      m.revenue += invoice.totalToman;
      m.invoices += 1;
      monthly.set(monthKey, m);
      const y = yearly.get(yearKey) ?? { revenue: 0, invoices: 0 };
      y.revenue += invoice.totalToman;
      y.invoices += 1;
      yearly.set(yearKey, y);
    }
    const active = subscriptions.filter((row) => {
      const status = effectiveSubscriptionStatus(row, now);
      return status === "active" || status === "trial";
    });
    const planCounts = new Map<string, number>();
    for (const row of active) {
      const code = normalizePlanCode(row.planCode);
      planCounts.set(code, (planCounts.get(code) ?? 0) + 1);
    }
    return {
      totalRevenueToman: invoices.reduce(
        (sum, row) => sum + row.totalToman,
        0,
      ),
      totalInvoices: invoices.length,
      monthly: [...monthly.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 18)
        .map(([key, value]) => ({ key, ...value })),
      yearly: [...yearly.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 6)
        .map(([key, value]) => ({ key, ...value })),
      subscribersByPlan: plans
        .filter(
          (plan) =>
            !(LEGACY_PLAN_CODES as readonly string[]).includes(plan.code),
        )
        .map((plan) => ({
          code: plan.code,
          name: plan.name,
          count: planCounts.get(plan.code) ?? 0,
        })),
    };
  },
});

export const updatePlan = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    monthlyPriceToman: v.number(),
    yearlyPriceToman: v.number(),
    yearlyDiscountPercent: v.number(),
    durationDays: v.optional(v.number()),
    features: v.array(v.string()),
    entitlements: planEntitlementsValidator,
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const code = normalizedCode(args.code).toLowerCase();
    const plan = await getPlan(ctx, code);
    if (!plan) fail("not_found", "پلن مورد نظر پیدا نشد.");
    if (
      !Number.isFinite(args.monthlyPriceToman) ||
      !Number.isFinite(args.yearlyPriceToman) ||
      args.monthlyPriceToman < 0 ||
      args.yearlyPriceToman < 0 ||
      args.monthlyPriceToman > 1_000_000_000_000 ||
      args.yearlyPriceToman > 1_000_000_000_000
    ) {
      fail("validation", "مبلغ پلن معتبر نیست.");
    }
    if (
      !Number.isFinite(args.yearlyDiscountPercent) ||
      args.yearlyDiscountPercent < 0 ||
      args.yearlyDiscountPercent > 100
    ) {
      fail("validation", "درصد تخفیف سالانه باید بین ۰ تا ۱۰۰ باشد.");
    }
    const durationDays =
      args.durationDays === undefined ? plan.durationDays : args.durationDays;
    if (
      !Number.isInteger(durationDays) ||
      durationDays < 1 ||
      durationDays > 3650
    ) {
      fail("validation", "مدت پلن باید بین ۱ تا ۳۶۵۰ روز باشد.");
    }
    const entitlements = args.entitlements;
    if (
      !Number.isInteger(entitlements.maxEmployees) ||
      entitlements.maxEmployees < -1 ||
      entitlements.maxEmployees > 10_000 ||
      !Number.isInteger(entitlements.aiRequestsPerMonth) ||
      entitlements.aiRequestsPerMonth < 0 ||
      entitlements.aiRequestsPerMonth > 1_000_000
    ) {
      fail("validation", "محدودیت کارمند یا سهمیه هوش مصنوعی معتبر نیست.");
    }
    const features = args.features
      .map((feature) => feature.trim())
      .filter(Boolean)
      .slice(0, 20);
    for (const feature of features) {
      if (feature.length > 140) {
        fail("validation", "هر ویژگی پلن نباید بیشتر از ۱۴۰ نویسه باشد.");
      }
    }
    await ctx.db.patch(plan._id, {
      name: requireText(args.name, "نام پلن", 2, 60),
      description: optionalText(args.description, "توضیح پلن", 500),
      monthlyPriceToman: Math.round(args.monthlyPriceToman),
      yearlyPriceToman: Math.round(args.yearlyPriceToman),
      yearlyDiscountPercent: Math.round(args.yearlyDiscountPercent * 100) / 100,
      priceToman: Math.round(args.monthlyPriceToman),
      durationDays,
      features,
      entitlements,
      isActive: args.isActive,
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    await log(
      ctx,
      session.user._id,
      "plan_updated",
      `پلن ${plan.name} به‌روزرسانی شد.`,
      undefined,
      JSON.stringify({
        code: plan.code,
        monthlyPriceToman: args.monthlyPriceToman,
        yearlyPriceToman: args.yearlyPriceToman,
      }),
    );
    return { ok: true };
  },
});

export const updateSettings = mutation({
  args: {
    allowTrialReuse: v.boolean(),
    gatewayProvider: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const provider = args.gatewayProvider.trim().toLowerCase();
    if (provider !== "zarinpal") {
      fail("validation", "درگاه انتخاب‌شده پشتیبانی نمی‌شود.");
    }
    const existing = await ctx.db
      .query("billing_settings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        allowTrialReuse: args.allowTrialReuse,
        gatewayProvider: provider,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    } else {
      await ctx.db.insert("billing_settings", {
        key: "default",
        allowTrialReuse: args.allowTrialReuse,
        gatewayProvider: provider,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    }
    await log(
      ctx,
      session.user._id,
      "settings_updated",
      "تنظیمات مالی و دوره آزمایشی تغییر کرد.",
    );
    return { ok: true };
  },
});

export const grantTrial = mutation({
  args: {
    cafeId: v.id("internet_cafes"),
    days: v.optional(v.number()),
    allowReuse: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const cafe = await ctx.db.get(args.cafeId);
    if (!cafe) fail("not_found", "کافی‌نت پیدا نشد.");
    const trial = await getPlan(ctx, "trial");
    if (!trial || !trial.isActive) {
      fail("validation", "پلن دوره آزمایشی فعال نیست.");
    }
    const settings = await ctx.db
      .query("billing_settings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();
    if (
      cafe.trialUsedAt !== undefined &&
      !(settings?.allowTrialReuse ?? false) &&
      !args.allowReuse
    ) {
      fail(
        "conflict",
        "این کافی‌نت قبلاً دوره آزمایشی را استفاده کرده است. برای استفاده مجدد، گزینه اجازه استفاده مجدد را فعال کنید.",
      );
    }
    const days = args.days ?? trial.durationDays;
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      fail("validation", "مدت دوره آزمایشی باید بین ۱ تا ۳۶۵ روز باشد.");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_cafe", (q) => q.eq("cafeId", args.cafeId))
      .collect();
    const current = existing.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
    const endsAt = now + days * DAY;
    if (current) {
      await ctx.db.patch(current._id, {
        planCode: trial.code,
        status: "trial",
        startsAt: now,
        endsAt,
        billingCycle: "monthly",
        lastPaymentAt: current.lastPaymentAt,
        renewalAt: endsAt,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        cafeId: args.cafeId,
        planCode: trial.code,
        status: "trial",
        startsAt: now,
        endsAt,
        billingCycle: "monthly",
        renewalAt: endsAt,
        createdAt: now,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    }
    if (cafe.trialUsedAt === undefined) {
      await ctx.db.patch(cafe._id, { trialUsedAt: now, updatedAt: now });
    }
    await log(
      ctx,
      session.user._id,
      "trial_granted",
      `دوره آزمایشی ${days} روزه برای ${cafe.name} فعال شد.`,
      cafe._id,
      JSON.stringify({ days, endsAt }),
    );
    return { ok: true };
  },
});

export const cancelOrder = mutation({
  args: { orderId: v.id("payment_orders") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) fail("not_found", "سفارش پیدا نشد.");
    if (order.status === "paid") {
      fail("conflict", "سفارش پرداخت‌شده قابل لغو نیست.");
    }
    if (order.status === "canceled") return { ok: true };
    const now = Date.now();
    await ctx.db.patch(order._id, {
      status: "canceled",
      canceledAt: now,
      updatedAt: now,
    });
    const transactions = await ctx.db
      .query("payment_transactions")
      .withIndex("by_order_created", (q) => q.eq("orderId", order._id))
      .collect();
    for (const transaction of transactions) {
      if (transaction.status === "pending") {
        await ctx.db.patch(transaction._id, {
          status: "canceled",
          message: "سفارش توسط مدیر لغو شد.",
          updatedAt: now,
        });
      }
    }
    await log(
      ctx,
      session.user._id,
      "order_canceled_admin",
      `سفارش ${order.orderNumber} توسط مدیر لغو شد.`,
      order.cafeId,
    );
    return { ok: true };
  },
});

export const changeSubscription = mutation({
  args: {
    cafeId: v.id("internet_cafes"),
    planCode: v.string(),
    status: subscriptionStatusValidator,
    billingCycle: v.optional(billingCycleValidator),
    endsAt: v.optional(v.number()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const cafe = await ctx.db.get(args.cafeId);
    if (!cafe) fail("not_found", "کافی‌نت پیدا نشد.");
    const plan = await getPlan(ctx, args.planCode);
    if (
      !plan ||
      (LEGACY_PLAN_CODES as readonly string[]).includes(plan.code)
    ) {
      fail("validation", "پلن انتخابی معتبر نیست.");
    }
    const now = Date.now();
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_cafe", (q) => q.eq("cafeId", args.cafeId))
      .collect();
    const current =
      subscriptions.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
    if (args.endsAt !== undefined && !Number.isFinite(args.endsAt)) {
      fail("validation", "تاریخ پایان معتبر نیست.");
    }
    if (args.days !== undefined) {
      if (!Number.isInteger(args.days) || args.days < 1 || args.days > 3650) {
        fail("validation", "تعداد روزهای تمدید معتبر نیست.");
      }
    }
    const base = args.endsAt ?? now + (args.days ?? 30) * DAY;
    if (base <= now && args.status !== "canceled") {
      fail("validation", "تاریخ پایان باید بعد از زمان فعلی باشد.");
    }
    const startsAt = current && current.endsAt > now ? current.startsAt : now;
    if (current) {
      await ctx.db.patch(current._id, {
        planCode: plan.code,
        status: args.status,
        startsAt,
        endsAt: args.status === "canceled" ? now : base,
        billingCycle: args.billingCycle ?? current.billingCycle ?? "monthly",
        renewalAt: args.status === "canceled" ? undefined : base,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        cafeId: args.cafeId,
        planCode: plan.code,
        status: args.status,
        startsAt: now,
        endsAt: args.status === "canceled" ? now : base,
        billingCycle: args.billingCycle ?? "monthly",
        renewalAt: args.status === "canceled" ? undefined : base,
        createdAt: now,
        updatedAt: now,
        updatedBy: session.user._id,
      });
    }
    await log(
      ctx,
      session.user._id,
      "subscription_changed",
      `اشتراک ${cafe.name} به ${plan.name} با وضعیت ${args.status} تغییر کرد.`,
      cafe._id,
      JSON.stringify({ planCode: plan.code, status: args.status }),
    );
    return { ok: true };
  },
});

export const cancelSubscription = mutation({
  args: { cafeId: v.id("internet_cafes") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const cafe = await ctx.db.get(args.cafeId);
    if (!cafe) fail("not_found", "کافی‌نت پیدا نشد.");
    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_cafe", (q) => q.eq("cafeId", args.cafeId))
      .collect();
    const current = rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!current) fail("not_found", "اشتراکی برای این کافی‌نت ثبت نشده است.");
    await ctx.db.patch(current._id, {
      status: "canceled",
      endsAt: Date.now(),
      renewalAt: undefined,
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    await log(
      ctx,
      session.user._id,
      "subscription_canceled",
      `اشتراک ${cafe.name} توسط مدیر لغو شد.`,
      cafe._id,
    );
    return { ok: true };
  },
});

export const upsertDiscount = mutation({
  args: {
    discountId: v.optional(v.id("discount_codes")),
    code: v.string(),
    title: v.string(),
    discountType: discountTypeValidator,
    value: v.number(),
    startsAt: v.number(),
    endsAt: v.number(),
    maxUses: v.number(),
    maxUsesPerCafe: v.number(),
    applicablePlans: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const code = normalizedCode(args.code);
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
      fail(
        "validation",
        "کد تخفیف باید ۳ تا ۲۴ نویسه انگلیسی، عدد یا خط تیره باشد.",
      );
    }
    const title = requireText(args.title, "عنوان کد تخفیف", 2, 100);
    if (!Number.isFinite(args.startsAt) || !Number.isFinite(args.endsAt)) {
      fail("validation", "بازه اعتبار کد تخفیف معتبر نیست.");
    }
    if (args.endsAt <= args.startsAt) {
      fail("validation", "پایان اعتبار کد باید بعد از شروع آن باشد.");
    }
    if (
      !Number.isFinite(args.value) ||
      args.value <= 0 ||
      (args.discountType === "percent" && args.value > 100) ||
      args.value > 1_000_000_000_000
    ) {
      fail("validation", "مقدار تخفیف معتبر نیست.");
    }
    if (
      !Number.isInteger(args.maxUses) ||
      args.maxUses < 0 ||
      !Number.isInteger(args.maxUsesPerCafe) ||
      args.maxUsesPerCafe < 0
    ) {
      fail("validation", "تعداد دفعات استفاده معتبر نیست.");
    }
    const plans = await ctx.db.query("subscription_plans").collect();
    const validCodes = new Set(
      plans
        .filter((plan) => plan.isTrial !== true)
        .map((plan) => plan.code),
    );
    for (const planCode of args.applicablePlans) {
      if (!validCodes.has(planCode)) {
        fail("validation", "یکی از پلن‌های انتخابی کد تخفیف معتبر نیست.");
      }
    }
    const duplicate = await ctx.db
      .query("discount_codes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (duplicate && duplicate._id !== args.discountId) {
      fail("conflict", "این کد تخفیف قبلاً ثبت شده است.");
    }
    const now = Date.now();
    const fields = {
      code,
      title,
      discountType: args.discountType,
      value: Math.round(args.value * 100) / 100,
      startsAt: Math.trunc(args.startsAt),
      endsAt: Math.trunc(args.endsAt),
      maxUses: args.maxUses,
      maxUsesPerCafe: args.maxUsesPerCafe,
      applicablePlans: [...new Set(args.applicablePlans)],
      isActive: args.isActive,
      updatedAt: now,
    };
    if (args.discountId) {
      const existing = await ctx.db.get(args.discountId);
      if (!existing) fail("not_found", "کد تخفیف پیدا نشد.");
      await ctx.db.patch(args.discountId, fields);
      await log(
        ctx,
        session.user._id,
        "discount_updated",
        `کد تخفیف ${code} به‌روزرسانی شد.`,
        undefined,
        JSON.stringify({ discountId: args.discountId }),
      );
      return { discountId: args.discountId };
    }
    const discountId = await ctx.db.insert("discount_codes", {
      ...fields,
      createdBy: session.user._id,
      createdAt: now,
    });
    await log(
      ctx,
      session.user._id,
      "discount_created",
      `کد تخفیف ${code} ایجاد شد.`,
      undefined,
      JSON.stringify({ discountId }),
    );
    return { discountId };
  },
});

export const setDiscountActive = mutation({
  args: { discountId: v.id("discount_codes"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const discount = await ctx.db.get(args.discountId);
    if (!discount) fail("not_found", "کد تخفیف پیدا نشد.");
    await ctx.db.patch(args.discountId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    await log(
      ctx,
      session.user._id,
      "discount_toggled",
      `کد تخفیف ${discount.code} ${args.isActive ? "فعال" : "غیرفعال"} شد.`,
    );
    return { ok: true };
  },
});

export const recordManualPayment = action({
  args: {
    orderId: v.id("payment_orders"),
    referenceId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ invoiceNumber: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("unauthenticated", "برای این عملیات باید وارد شوید.");
    await ctx.runQuery(internal.billingAuthz.assertAdmin, { userId });
    if (args.referenceId.trim().length < 3) {
      fail("validation", "شماره پیگیری دستی معتبر نیست.");
    }
    const invoiceNumber = (await ctx.runMutation(
      internal.billing.finalizePayment,
      {
        orderId: args.orderId,
        actorId: userId,
        provider: "manual",
        kind: "manual",
        referenceId: args.referenceId.trim(),
        note: args.note,
      },
    )) as string;
    return { invoiceNumber };
  },
});
