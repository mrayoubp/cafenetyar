import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  assertCafeActive,
  getSessionForUser,
  requireOwner,
} from "./lib/access";
import { logAudit } from "./lib/platform";
import { assertCmsFeature } from "./lib/siteFeatures";
import {
  DAY,
  LEGACY_PLAN_CODES,
  assertAgentPlan,
  getBillingSnapshot,
  getPlan,
  monthlyPrice,
  yearlyPrice,
} from "./lib/billing";
import { fail } from "./lib/validation";
import { createUserNotification } from "./notifications";
import {
  billingCycleValidator,
  type PaymentOrderStatus,
} from "./schema";

const GATEWAY = "zarinpal";

function normalizedCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function invoiceNumberFor(orderNumber: string) {
  return orderNumber.replace(/^ORD-/, "INV-");
}

async function billingLog(
  ctx: MutationCtx,
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
}

async function latestSubscription(
  ctx: MutationCtx,
  cafeId: Id<"internet_cafes">,
) {
  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_cafe", (q) => q.eq("cafeId", cafeId))
    .collect();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

async function assertDiscountCapacity(
  ctx: MutationCtx,
  discount: Doc<"discount_codes">,
  cafeId: Id<"internet_cafes">,
) {
  if (discount.maxUses > 0) {
    const allRedemptions = await ctx.db
      .query("discount_redemptions")
      .withIndex("by_code_created", (q) => q.eq("codeId", discount._id))
      .take(discount.maxUses);
    if (allRedemptions.length >= discount.maxUses) {
      fail("validation", "ظرفیت استفاده از این کد تخفیف تکمیل شده است.");
    }
  }
  if (discount.maxUsesPerCafe > 0) {
    const cafeRedemptions = await ctx.db
      .query("discount_redemptions")
      .withIndex("by_code_cafe", (q) =>
        q.eq("codeId", discount._id).eq("cafeId", cafeId),
      )
      .take(discount.maxUsesPerCafe);
    if (cafeRedemptions.length >= discount.maxUsesPerCafe) {
      fail(
        "validation",
        "این کد تخفیف قبلاً برای این کافی‌نت استفاده شده است.",
      );
    }
  }
}

async function discountQuote(
  ctx: MutationCtx,
  rawCode: string | undefined,
  planCode: string,
  cafeId: Id<"internet_cafes">,
  subtotalToman: number,
  now: number,
) {
  const code = rawCode ? normalizedCode(rawCode) : "";
  if (!code) {
    return { id: undefined, code: undefined, discountToman: 0 };
  }
  const discount = await ctx.db
    .query("discount_codes")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
  if (!discount || !discount.isActive) {
    fail("validation", "کد تخفیف معتبر یا فعال نیست.");
  }
  if (now < discount.startsAt) {
    fail("validation", "زمان استفاده از این کد تخفیف شروع نشده است.");
  }
  if (now > discount.endsAt) {
    fail("validation", "این کد تخفیف منقضی شده است.");
  }
  if (
    discount.applicablePlans.length > 0 &&
    !discount.applicablePlans.includes(planCode)
  ) {
    fail("validation", "این کد تخفیف برای پلن انتخاب‌شده معتبر نیست.");
  }
  await assertDiscountCapacity(ctx, discount, cafeId);
  const discountToman =
    discount.discountType === "percent"
      ? Math.round((subtotalToman * discount.value) / 100)
      : discount.value;
  return {
    id: discount._id,
    code: discount.code,
    discountToman: Math.min(subtotalToman, Math.max(0, discountToman)),
  };
}

type PaymentOrderView = ReturnType<typeof orderSnapshot>;

type PaymentContext = {
  order: PaymentOrderView;
  planName: string;
  invoiceNumber: string | null;
};

type StartPaymentResult = {
  configured: boolean;
  alreadyPaid: boolean;
  redirectUrl: string | null;
  order: PaymentOrderView;
  message?: string;
};

type ConfirmPaymentResult = {
  status: "paid" | "failed" | "not_configured" | "verify_error";
  configured: boolean;
  order: PaymentOrderView;
  invoiceNumber?: string | null;
  message?: string;
};

function orderSnapshot(order: Doc<"payment_orders">) {
  return {
    id: order._id,
    orderNumber: order.orderNumber,
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
    paidAt: order.paidAt ?? null,
    createdAt: order.createdAt,
  };
}

/** Everything the owner needs on the subscription page. */
export const mySubscription = query({
  args: {},
  handler: async (ctx) => {
    const session = await requireOwner(ctx);
    const snapshot = await getBillingSnapshot(ctx, session.cafe._id);
    assertCafeActive(session.cafe);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_cafe_issued", (q) => q.eq("cafeId", session.cafe._id))
      .order("desc")
      .take(24);
    const orders = await ctx.db
      .query("payment_orders")
      .withIndex("by_cafe_created", (q) => q.eq("cafeId", session.cafe._id))
      .order("desc")
      .take(30);
    return {
      ...snapshot,
      invoices: invoices.map((invoice) => ({
        id: invoice._id,
        number: invoice.number,
        planCode: invoice.planCode,
        planName: invoice.planName,
        billingCycle: invoice.billingCycle,
        subtotalToman: invoice.subtotalToman,
        discountToman: invoice.discountToman,
        totalToman: invoice.totalToman,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        paidAt: invoice.paidAt ?? null,
      })),
      orders: orders.map(orderSnapshot),
    };
  },
});

/** Rejects plans whose price has not been configured by the site admin. */
export const createOrder = mutation({
  args: {
    planCode: v.string(),
    billingCycle: billingCycleValidator,
    discountCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireOwner(ctx);
    assertCafeActive(session.cafe);
    const plan = await getPlan(ctx, args.planCode);
    if (
      !plan ||
      !plan.isActive ||
      plan.isTrial === true ||
      (LEGACY_PLAN_CODES as readonly string[]).includes(plan.code)
    ) {
      fail("validation", "پلن انتخاب‌شده فعال یا قابل خرید نیست.");
    }
    const subtotalToman =
      args.billingCycle === "yearly" ? yearlyPrice(plan) : monthlyPrice(plan);
    if (subtotalToman <= 0) {
      fail(
        "validation",
        "قیمت این پلن و دوره هنوز توسط مدیر اصلی تعیین نشده است. لطفاً بعداً تلاش کنید.",
      );
    }
    const now = Date.now();
    const quote = await discountQuote(
      ctx,
      args.discountCode,
      plan.code,
      session.cafe._id,
      subtotalToman,
      now,
    );
    const totalToman = Math.max(0, subtotalToman - quote.discountToman);
    if (totalToman <= 0) {
      fail(
        "validation",
        "مبلغ نهایی این سفارش صفر شده است؛ کد تخفیف را تغییر دهید یا با پشتیبانی تماس بگیرید.",
      );
    }

    const recentOrders = await ctx.db
      .query("payment_orders")
      .withIndex("by_cafe_created", (q) => q.eq("cafeId", session.cafe._id))
      .order("desc")
      .take(20);
    const reusable = recentOrders.find(
      (order) =>
        order.status === "pending" &&
        order.planCode === plan.code &&
        order.billingCycle === args.billingCycle &&
        order.totalToman === totalToman &&
        order.createdAt > now - 20 * 60 * 1000,
    );
    if (reusable) {
      return {
        order: orderSnapshot(reusable),
        reused: true,
      };
    }

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const orderId = await ctx.db.insert("payment_orders", {
      cafeId: session.cafe._id,
      orderNumber,
      planCode: plan.code,
      billingCycle: args.billingCycle,
      subtotalToman,
      discountToman: quote.discountToman,
      totalToman,
      discountCodeId: quote.id,
      discountCode: quote.code,
      status: "pending",
      createdBy: session.user._id,
      createdAt: now,
      updatedAt: now,
    });
    const currentSubscription = await latestSubscription(
      ctx,
      session.cafe._id,
    );
    if (
      !currentSubscription ||
      currentSubscription.status === "expired" ||
      currentSubscription.status === "canceled" ||
      currentSubscription.endsAt <= now
    ) {
      if (currentSubscription) {
        await ctx.db.patch(currentSubscription._id, {
          planCode: plan.code,
          status: "pending_payment",
          billingCycle: args.billingCycle,
          renewalAt: undefined,
          updatedAt: now,
          updatedBy: session.user._id,
        });
      } else {
        await ctx.db.insert("subscriptions", {
          cafeId: session.cafe._id,
          planCode: plan.code,
          status: "pending_payment",
          startsAt: now,
          endsAt: now,
          billingCycle: args.billingCycle,
          createdAt: now,
          updatedAt: now,
          updatedBy: session.user._id,
        });
      }
    }
    await billingLog(
      ctx,
      session.user._id,
      "order_created",
      `سفارش ${orderNumber} برای پلن ${plan.name} ایجاد شد.`,
      session.cafe._id,
      JSON.stringify({ orderId, totalToman }),
    );
    const order = await ctx.db.get(orderId);
    if (!order) fail("not_found", "سفارش ایجاد نشد.");
    return { order: orderSnapshot(order), reused: false };
  },
});

export const agentAccess = internalQuery({
  args: {
    cafeId: v.id("internet_cafes"),
    requireQuota: v.boolean(),
    role: v.optional(
      v.union(v.literal("owner"), v.literal("employee"), v.literal("site_admin")),
    ),
  },
  handler: async (ctx, args) => {
    const snapshot = await getBillingSnapshot(ctx, args.cafeId);
    const usage = assertAgentPlan(snapshot);
    const decision = await assertCmsFeature(ctx, args.cafeId, "agent", args.role);
    if (
      args.requireQuota &&
      decision.monthlyLimit > 0 &&
      usage.aiUsed >= decision.monthlyLimit
    ) {
      fail(
        "limit_reached",
        `سقف ماهانه این قابلیت (${decision.monthlyLimit.toLocaleString("fa-IR")}) تکمیل شده است.`,
      );
    }
    if (args.requireQuota && decision.dailyLimit > 0) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const runs = await ctx.db
        .query("agent_runs")
        .withIndex("by_cafe_created", (q) =>
          q.eq("cafeId", args.cafeId).gte("createdAt", dayStart.getTime()),
        )
        .take(decision.dailyLimit);
      if (runs.length >= decision.dailyLimit) {
        fail(
          "limit_reached",
          `سقف روزانه این قابلیت (${decision.dailyLimit.toLocaleString("fa-IR")}) تکمیل شده است.`,
        );
      }
    }
    if (
      args.requireQuota &&
      usage.aiLimit > 0 &&
      usage.aiUsed >= usage.aiLimit
    ) {
      fail(
        "limit_reached",
        `سهمیه ماهانه ایجنت (${usage.aiLimit.toLocaleString("fa-IR")} درخواست) تمام شده است. برای ادامه، پلن خود را ارتقا دهید.`,
      );
    }
    return { aiUsed: usage.aiUsed, aiLimit: usage.aiLimit };
  },
});

export const consumeAiRequest = internalMutation({
  args: { cafeId: v.id("internet_cafes") },
  handler: async (ctx, args) => {
    const snapshot = await getBillingSnapshot(ctx, args.cafeId);
    const { aiLimit, aiUsed, periodKey } = assertAgentPlan(snapshot);
    if (aiLimit > 0 && aiUsed >= aiLimit) {
      fail(
        "limit_reached",
        `سهمیه ماهانه ایجنت (${aiLimit.toLocaleString("fa-IR")} درخواست) تمام شده است. برای ادامه، پلن خود را ارتقا دهید.`,
      );
    }
    const usage = await ctx.db
      .query("subscription_usage")
      .withIndex("by_cafe_period", (q) =>
        q.eq("cafeId", args.cafeId).eq("periodKey", periodKey),
      )
      .first();
    const nextUsed = (usage?.aiRequests ?? 0) + 1;
    if (usage) {
      await ctx.db.patch(usage._id, {
        aiRequests: nextUsed,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("subscription_usage", {
        cafeId: args.cafeId,
        periodKey,
        aiRequests: nextUsed,
        updatedAt: Date.now(),
      });
    }
    return {
      aiUsed: nextUsed,
      aiLimit,
      aiRemaining: aiLimit > 0 ? Math.max(0, aiLimit - nextUsed) : 0,
    };
  },
});

export const cancelOrder = mutation({
  args: { orderId: v.id("payment_orders") },
  handler: async (ctx, args) => {
    const session = await requireOwner(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.cafeId !== session.cafe._id) {
      fail("not_found", "سفارش پیدا نشد.");
    }
    if (order.status === "paid") {
      fail("conflict", "این سفارش پرداخت شده و قابل لغو نیست.");
    }
    if (order.status !== "pending") return { ok: true };
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
          message: "سفارش توسط صاحب کافی‌نت لغو شد.",
          updatedAt: now,
        });
      }
    }
    await billingLog(
      ctx,
      session.user._id,
      "order_canceled",
      `سفارش ${order.orderNumber} لغو شد.`,
      order.cafeId,
    );
    return { ok: true };
  },
});

/**
 * Creates a gateway payment for an order. When credentials are absent this
 * returns `configured: false`; no payment is considered successful in that case.
 */
export const startPayment = action({
  args: { orderId: v.id("payment_orders") },
  handler: async (ctx, args): Promise<StartPaymentResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("unauthenticated", "برای پرداخت باید وارد حساب شوید.");
    const payment = (await ctx.runQuery(
      internal.billing.paymentOrderForAction,
      {
        userId,
        orderId: args.orderId,
      },
    )) as PaymentContext;
    if (payment.order.status === "paid") {
      return {
        configured: true,
        alreadyPaid: true,
        redirectUrl: null,
        order: payment.order,
      };
    }
    if (payment.order.status !== "pending") {
      fail("conflict", "این سفارش قابل پرداخت نیست.");
    }
    const merchantId = process.env.ZARINPAL_MERCHANT_ID?.trim();
    const siteUrl = (
      process.env.SITE_URL ??
      process.env.VLY_APP_URL ??
      ""
    ).replace(/\/$/, "");
    if (!merchantId || !siteUrl) {
      return {
        configured: false,
        alreadyPaid: false,
        redirectUrl: null,
        order: payment.order,
        message:
          "درگاه پرداخت هنوز توسط مدیر پلتفرم تنظیم نشده است. سفارش شما ثبت شد اما هیچ مبلغی دریافت نشده است.",
      };
    }
    const callbackUrl = `${siteUrl}/dashboard/subscription?payment=callback&order=${args.orderId}`;
    if (payment.order.authority) {
      return {
        configured: true,
        alreadyPaid: false,
        redirectUrl: `https://www.zarinpal.com/pg/StartPay/${payment.order.authority}`,
        order: payment.order,
      };
    }
    try {
      const response = await fetch(
        "https://api.zarinpal.com/pg/v4/payment/request.json",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant_id: merchantId,
            amount: payment.order.totalToman * 10,
            callback_url: callbackUrl,
            description: `خرید اشتراک ${payment.planName} - ${payment.order.orderNumber}`,
            metadata: { order_id: payment.order.orderNumber },
          }),
        },
      );
      const body = (await response.json()) as {
        data?: { code?: number; authority?: string; message?: string };
        errors?: { message?: string } | unknown[];
      };
      const authority = body.data?.authority;
      if (!response.ok || body.data?.code !== 100 || !authority) {
        const message =
          body.data?.message ??
          (Array.isArray(body.errors)
            ? "درخواست درگاه رد شد."
            : body.errors?.message) ??
          "درگاه پرداخت درخواست را نپذیرفت.";
        await ctx.runMutation(internal.billing.markOrderFailed, {
          orderId: args.orderId,
          actorId: userId,
          reason: message,
        });
        fail("gateway_error", `ایجاد پرداخت ممکن نشد: ${message}`);
      }
      await ctx.runMutation(internal.billing.attachAuthority, {
        orderId: args.orderId,
        actorId: userId,
        authority,
      });
      return {
        configured: true,
        alreadyPaid: false,
        redirectUrl: `https://www.zarinpal.com/pg/StartPay/${authority}`,
        order: { ...payment.order, authority },
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("ایجاد پرداخت")) {
        throw error;
      }
      await ctx.runMutation(internal.billing.markOrderFailed, {
        orderId: args.orderId,
        actorId: userId,
        reason: "خطای ارتباط با درگاه پرداخت.",
      });
      fail(
        "gateway_error",
        "ارتباط با درگاه پرداخت برقرار نشد. مبلغی از حساب شما کسر نشده است.",
      );
    }
  },
});

/**
 * Verifies the gateway result server-side. A successful browser return alone is
 * never enough; activation only happens inside `finalizePayment`.
 */
export const confirmPayment = action({
  args: {
    orderId: v.id("payment_orders"),
    authority: v.optional(v.string()),
    gatewayStatus: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ConfirmPaymentResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("unauthenticated", "برای بررسی پرداخت باید وارد حساب شوید.");
    const payment = (await ctx.runQuery(
      internal.billing.paymentOrderForAction,
      {
        userId,
        orderId: args.orderId,
      },
    )) as PaymentContext;
    if (payment.order.status === "paid") {
      return {
        status: "paid" as const,
        configured: true,
        order: payment.order,
        invoiceNumber: payment.invoiceNumber,
      };
    }
    if (payment.order.status === "canceled" || payment.order.status === "failed") {
      return {
        status: "failed" as const,
        configured: true,
        order: payment.order,
        message: payment.order.failureReason ?? "این سفارش قابل تأیید نیست.",
      };
    }
    const authority = args.authority ?? payment.order.authority ?? undefined;
    if (!authority) {
      fail("validation", "شناسه پرداخت درگاه موجود نیست.");
    }
    if (
      payment.order.authority &&
      payment.order.authority !== authority
    ) {
      fail("validation", "شناسه پرداخت با سفارش مطابقت ندارد.");
    }
    if (args.gatewayStatus && args.gatewayStatus !== "OK") {
      await ctx.runMutation(internal.billing.markOrderFailed, {
        orderId: args.orderId,
        actorId: userId,
        reason: "پرداخت در درگاه لغو شد یا ناموفق بود.",
      });
      return {
        status: "failed" as const,
        configured: true,
        order: payment.order,
        message: "پرداخت در درگاه لغو شد یا ناموفق بود.",
      };
    }
    const merchantId = process.env.ZARINPAL_MERCHANT_ID?.trim();
    if (!merchantId) {
      return {
        status: "not_configured" as const,
        configured: false,
        order: payment.order,
        message:
          "درگاه پرداخت هنوز تنظیم نشده است. تا اتصال درگاه، پرداخت تأیید نمی‌شود.",
      };
    }
    try {
      const response = await fetch(
        "https://api.zarinpal.com/pg/v4/payment/verify.json",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant_id: merchantId,
            amount: payment.order.totalToman * 10,
            authority,
          }),
        },
      );
      const body = (await response.json()) as {
        data?: {
          code?: number;
          ref_id?: number | string;
          message?: string;
        };
        errors?: { message?: string } | unknown[];
      };
      const code = body.data?.code;
      if (response.ok && (code === 100 || code === 101)) {
        const referenceId = String(body.data?.ref_id ?? authority);
        const invoiceNumber = (await ctx.runMutation(
          internal.billing.finalizePayment,
          {
            orderId: args.orderId,
            actorId: userId,
            provider: GATEWAY,
            kind: "gateway",
            referenceId,
            authority,
          },
        )) as string;
        return {
          status: "paid" as const,
          configured: true,
          order: { ...payment.order, status: "paid" as PaymentOrderStatus },
          invoiceNumber,
        };
      }
      const message =
        body.data?.message ??
        (Array.isArray(body.errors)
          ? "تأیید پرداخت ناموفق بود."
          : body.errors?.message) ??
        "تأیید پرداخت ناموفق بود.";
      await ctx.runMutation(internal.billing.markOrderFailed, {
        orderId: args.orderId,
        actorId: userId,
        reason: message,
      });
      return {
        status: "failed" as const,
        configured: true,
        order: payment.order,
        message,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("پرداخت")) throw error;
      return {
        status: "verify_error" as const,
        configured: true,
        order: payment.order,
        message:
          "ارتباط با درگاه برای تأیید پرداخت برقرار نشد. اگر مبلغی کسر شده، تا بررسی مدیر آن را دوباره پرداخت نکنید.",
      };
    }
  },
});

/** Internal authorization boundary for actions that cannot read the DB directly. */
export const paymentOrderForAction = internalQuery({
  args: { userId: v.id("users"), orderId: v.id("payment_orders") },
  handler: async (ctx, args) => {
    const session = await getSessionForUser(ctx, args.userId);
    if (!session || !session.isOwner || !session.cafe) {
      fail("forbidden", "این سفارش فقط برای صاحب کافی‌نت قابل پرداخت است.");
    }
    const order = await ctx.db.get(args.orderId);
    if (!order || order.cafeId !== session.cafe._id) {
      fail("not_found", "سفارش پیدا نشد.");
    }
    const plan = await getPlan(ctx, order.planCode);
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .first();
    return {
      order: orderSnapshot(order),
      planName: plan?.name ?? order.planCode,
      invoiceNumber: invoice?.number ?? null,
    };
  },
});

export const attachAuthority = internalMutation({
  args: {
    orderId: v.id("payment_orders"),
    actorId: v.id("users"),
    authority: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) fail("not_found", "سفارش پیدا نشد.");
    if (order.status !== "pending") return { ok: false };
    const now = Date.now();
    await ctx.db.patch(order._id, {
      authority: args.authority,
      gateway: GATEWAY,
      updatedAt: now,
    });
    const existing = await ctx.db
      .query("payment_transactions")
      .withIndex("by_authority", (q) => q.eq("authority", args.authority))
      .first();
    if (!existing) {
      await ctx.db.insert("payment_transactions", {
        orderId: order._id,
        cafeId: order.cafeId,
        provider: GATEWAY,
        kind: "gateway",
        status: "pending",
        amountToman: order.totalToman,
        authority: args.authority,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("billing_events", {
      cafeId: order.cafeId,
      actorId: args.actorId,
      type: "gateway_redirect",
      description: `انتقال به درگاه برای سفارش ${order.orderNumber}`,
      metadata: JSON.stringify({ authority: args.authority }),
      createdAt: now,
    });
    return { ok: true };
  },
});

export const markOrderFailed = internalMutation({
  args: {
    orderId: v.id("payment_orders"),
    actorId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "pending") return { ok: false };
    const now = Date.now();
    await ctx.db.patch(order._id, {
      status: "failed",
      failureReason: args.reason.slice(0, 500),
      updatedAt: now,
    });
    const transactions = await ctx.db
      .query("payment_transactions")
      .withIndex("by_order_created", (q) => q.eq("orderId", order._id))
      .collect();
    for (const transaction of transactions) {
      if (transaction.status === "pending") {
        await ctx.db.patch(transaction._id, {
          status: "failed",
          message: args.reason.slice(0, 500),
          updatedAt: now,
        });
      }
    }
    if (transactions.length === 0) {
      await ctx.db.insert("payment_transactions", {
        orderId: order._id,
        cafeId: order.cafeId,
        provider: order.gateway ?? GATEWAY,
        kind: "gateway",
        status: "failed",
        amountToman: order.totalToman,
        message: args.reason.slice(0, 500),
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("billing_events", {
      cafeId: order.cafeId,
      actorId: args.actorId,
      type: "payment_failed",
      description: `پرداخت سفارش ${order.orderNumber} ناموفق بود.`,
      metadata: JSON.stringify({ reason: args.reason.slice(0, 300) }),
      createdAt: now,
    });
    return { ok: true };
  },
});

/**
 * The single idempotent point where money becomes a subscription. It is called
 * after verified gateway payment or by an explicit admin manual settlement.
 */
export const finalizePayment = internalMutation({
  args: {
    orderId: v.id("payment_orders"),
    actorId: v.id("users"),
    provider: v.string(),
    kind: v.union(v.literal("gateway"), v.literal("manual")),
    referenceId: v.string(),
    authority: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) fail("not_found", "سفارش پیدا نشد.");
    const existingInvoice = await ctx.db
      .query("invoices")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .first();
    if (order.status === "paid") {
      if (existingInvoice) return existingInvoice.number;
      fail("conflict", "این سفارش قبلاً پرداخت شده است.");
    }
    if (order.status !== "pending") {
      fail("conflict", "فقط سفارش در انتظار پرداخت قابل تأیید است.");
    }
    const referenceId = args.referenceId.trim();
    if (referenceId.length < 3) {
      fail("validation", "شماره پیگیری پرداخت معتبر نیست.");
    }
    const duplicate = await ctx.db
      .query("payment_transactions")
      .withIndex("by_reference", (q) => q.eq("referenceId", referenceId))
      .first();
    if (duplicate && duplicate.orderId !== order._id) {
      fail("conflict", "این شماره پیگیری قبلاً برای سفارش دیگری ثبت شده است.");
    }
    if (duplicate && duplicate.status === "succeeded") {
      fail("conflict", "این تراکنش قبلاً تأیید شده است.");
    }
    // Two pending orders can carry the same code. Re-check the capacity in the
    // same transaction that records the redemption so a code cannot be used
    // beyond its limit through concurrent settlements.
    if (order.discountCodeId) {
      const discount = await ctx.db.get(order.discountCodeId);
      if (!discount) {
        fail("conflict", "کد تخفیف این سفارش دیگر در دسترس نیست.");
      }
      await assertDiscountCapacity(ctx, discount, order.cafeId);
    }
    const plan = await getPlan(ctx, order.planCode);
    if (!plan) fail("validation", "پلن سفارش پیدا نشد.");
    const now = Date.now();
    const current = await latestSubscription(ctx, order.cafeId);
    const samePlan =
      current !== null &&
      current.planCode === order.planCode &&
      (current.status === "active" || current.status === "trial") &&
      current.endsAt > now;
    const periodDays = order.billingCycle === "yearly" ? 365 : 30;
    const startsAt = samePlan ? current.startsAt : now;
    const endsAt = (samePlan ? Math.max(now, current.endsAt) : now) +
      periodDays * DAY;

    let subscriptionId: Id<"subscriptions">;
    if (current) {
      await ctx.db.patch(current._id, {
        planCode: plan.code,
        status: "active",
        startsAt,
        endsAt,
        billingCycle: order.billingCycle,
        lastPaymentAt: now,
        renewalAt: endsAt,
        updatedAt: now,
        updatedBy: args.actorId,
      });
      subscriptionId = current._id;
    } else {
      subscriptionId = await ctx.db.insert("subscriptions", {
        cafeId: order.cafeId,
        planCode: plan.code,
        status: "active",
        startsAt,
        endsAt,
        billingCycle: order.billingCycle,
        lastPaymentAt: now,
        renewalAt: endsAt,
        createdAt: now,
        updatedAt: now,
        updatedBy: args.actorId,
      });
    }

    await ctx.db.patch(order._id, {
      status: "paid",
      gateway: args.provider,
      referenceId,
      authority: args.authority ?? order.authority,
      paidAt: now,
      updatedAt: now,
    });
    const transaction = args.authority
      ? await ctx.db
          .query("payment_transactions")
          .withIndex("by_authority", (q) => q.eq("authority", args.authority))
          .first()
      : null;
    if (transaction) {
      await ctx.db.patch(transaction._id, {
        status: "succeeded",
        referenceId,
        message:
          args.kind === "manual"
            ? args.note?.slice(0, 500) || "تأیید دستی مدیر"
            : "تأیید درگاه",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("payment_transactions", {
        orderId: order._id,
        cafeId: order.cafeId,
        provider: args.provider,
        kind: args.kind,
        status: "succeeded",
        amountToman: order.totalToman,
        authority: args.authority,
        referenceId,
        message:
          args.kind === "manual"
            ? args.note?.slice(0, 500) || "تأیید دستی مدیر"
            : "تأیید درگاه",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (order.discountCodeId) {
      const existingRedemption = await ctx.db
        .query("discount_redemptions")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .first();
      if (!existingRedemption) {
        await ctx.db.insert("discount_redemptions", {
          codeId: order.discountCodeId,
          cafeId: order.cafeId,
          orderId: order._id,
          discountToman: order.discountToman,
          createdAt: now,
        });
      }
    }

    const invoiceNumber = invoiceNumberFor(order.orderNumber);
    const previousInvoice = await ctx.db
      .query("invoices")
      .withIndex("by_number", (q) => q.eq("number", invoiceNumber))
      .first();
    if (!previousInvoice) {
      await ctx.db.insert("invoices", {
        cafeId: order.cafeId,
        orderId: order._id,
        number: invoiceNumber,
        planCode: plan.code,
        planName: plan.name,
        billingCycle: order.billingCycle,
        subtotalToman: order.subtotalToman,
        discountToman: order.discountToman,
        totalToman: order.totalToman,
        status: "paid",
        issuedAt: now,
        paidAt: now,
      });
    }
    await ctx.db.insert("billing_events", {
      cafeId: order.cafeId,
      actorId: args.actorId,
      type: args.kind === "manual" ? "manual_payment" : "payment_succeeded",
      description: `پرداخت سفارش ${order.orderNumber} تأیید و اشتراک فعال شد.`,
      metadata: JSON.stringify({
        orderId: order._id,
        subscriptionId,
        referenceId,
        amountToman: order.totalToman,
      }),
      createdAt: now,
    });
    const cafe = await ctx.db.get(order.cafeId);
    if (cafe) {
      await createUserNotification(ctx, {
        userId: cafe.ownerId,
        cafeId: cafe._id,
        kind: "billing",
        title: "اشتراک شما فعال شد",
        body: `پرداخت سفارش ${order.orderNumber} تأیید شد و دوره جدید اشتراک فعال است.`,
        href: "/dashboard/subscription",
        createdAt: now,
      });
    }
    if (args.kind === "manual") {
      await logAudit(ctx, {
        actorId: args.actorId,
        action: "finance.manual_payment",
        entityType: "payment_order",
        entityId: order._id,
        cafeId: order.cafeId,
        summary: `پرداخت دستی سفارش ${order.orderNumber} تأیید شد.`,
        metadata: JSON.stringify({
          referenceId,
          amountToman: order.totalToman,
          invoiceNumber,
        }),
      });
    }
    return invoiceNumber;
  },
});
