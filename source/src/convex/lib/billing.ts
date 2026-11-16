import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type {
  BillingCycle,
  PlanEntitlements,
  SubscriptionStatus,
} from "../schema";
import { assertCmsFeature } from "./siteFeatures";
import { fail } from "./validation";

export const DAY = 24 * 60 * 60 * 1000;
export const TRIAL_PLAN_CODE = "trial";

/** Gateway payments require both a merchant id and a public return URL. */
export function isPaymentGatewayConfigured() {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID?.trim();
  const siteUrl = (
    process.env.SITE_URL ??
    process.env.VLY_APP_URL ??
    ""
  ).trim();
  return Boolean(merchantId && siteUrl);
}
export const DEFAULT_PLAN_CODE = "basic";

export const PLAN_CODES = ["basic", "pro", "premium"] as const;
export type PublicPlanCode = (typeof PLAN_CODES)[number];
export const LEGACY_PLAN_CODES = ["monthly", "yearly"] as const;

export const DEFAULT_ENTITLEMENTS: Record<string, PlanEntitlements> = {
  basic: {
    maxEmployees: 2,
    aiRequestsPerMonth: 0,
    agent: false,
    rates: false,
    accounting: "limited",
    advancedReports: false,
    advancedManagement: false,
    prioritySupport: false,
  },
  pro: {
    maxEmployees: 5,
    aiRequestsPerMonth: 300,
    agent: true,
    rates: true,
    accounting: "full",
    advancedReports: true,
    advancedManagement: false,
    prioritySupport: false,
  },
  premium: {
    maxEmployees: -1,
    aiRequestsPerMonth: 1500,
    agent: true,
    rates: true,
    accounting: "full",
    advancedReports: true,
    advancedManagement: true,
    prioritySupport: true,
  },
  trial: {
    maxEmployees: 2,
    aiRequestsPerMonth: 30,
    agent: true,
    rates: true,
    accounting: "limited",
    advancedReports: false,
    advancedManagement: false,
    prioritySupport: false,
  },
  monthly: {
    maxEmployees: 5,
    aiRequestsPerMonth: 300,
    agent: true,
    rates: true,
    accounting: "full",
    advancedReports: true,
    advancedManagement: false,
    prioritySupport: false,
  },
  yearly: {
    maxEmployees: -1,
    aiRequestsPerMonth: 1500,
    agent: true,
    rates: true,
    accounting: "full",
    advancedReports: true,
    advancedManagement: true,
    prioritySupport: true,
  },
};

type SeedPlan = {
  code: string;
  name: string;
  description: string;
  durationDays: number;
  monthlyPriceToman: number;
  yearlyPriceToman: number;
  yearlyDiscountPercent: number;
  features: string[];
  entitlements: PlanEntitlements;
  isTrial: boolean;
  isActive: boolean;
  sortOrder: number;
};

export const DEFAULT_PLANS: SeedPlan[] = [
  {
    code: "basic",
    name: "پایه",
    description: "شروع منظم برای کافی‌نت‌های کوچک و تازه‌تأسیس.",
    durationDays: 30,
    monthlyPriceToman: 0,
    yearlyPriceToman: 0,
    yearlyDiscountPercent: 0,
    features: [
      "داشبورد و مدیریت پایه کافی‌نت",
      "بانک سایت‌ها و سامانه‌های کاربردی",
      "اخبار و اطلاعیه‌های محدود",
      "حسابداری محدود",
      "حداکثر ۲ کارمند",
    ],
    entitlements: DEFAULT_ENTITLEMENTS.basic,
    isTrial: false,
    isActive: true,
    sortOrder: 10,
  },
  {
    code: "pro",
    name: "حرفه‌ای",
    description: "برای کافی‌نت‌های فعالی که به ابزارهای کامل نیاز دارند.",
    durationDays: 30,
    monthlyPriceToman: 0,
    yearlyPriceToman: 0,
    yearlyDiscountPercent: 0,
    features: [
      "همه امکانات پلن پایه",
      "حسابداری کامل",
      "ایجنت هوشمند با سهمیه ماهانه",
      "نرخ‌نامه کامل و ماشین‌حساب",
      "حداکثر ۵ کارمند",
      "گزارش‌های مدیریتی پیشرفته",
    ],
    entitlements: DEFAULT_ENTITLEMENTS.pro,
    isTrial: false,
    isActive: true,
    sortOrder: 20,
  },
  {
    code: "premium",
    name: "ویژه",
    description: "ظرفیت بالا، ابزارهای پیشرفته و اولویت پشتیبانی.",
    durationDays: 30,
    monthlyPriceToman: 0,
    yearlyPriceToman: 0,
    yearlyDiscountPercent: 0,
    features: [
      "همه امکانات پلن حرفه‌ای",
      "سهمیه بالاتر هوش مصنوعی",
      "امکانات مدیریتی پیشرفته",
      "کارمندان بیشتر یا نامحدود طبق تنظیمات",
      "گزارش‌ها و ابزارهای تکمیلی",
      "اولویت پشتیبانی",
    ],
    entitlements: DEFAULT_ENTITLEMENTS.premium,
    isTrial: false,
    isActive: true,
    sortOrder: 30,
  },
  {
    code: TRIAL_PLAN_CODE,
    name: "دوره آزمایشی",
    description: "دسترسی محدود و زمان‌دار برای ارزیابی کافی‌نت‌یار.",
    durationDays: 14,
    monthlyPriceToman: 0,
    yearlyPriceToman: 0,
    yearlyDiscountPercent: 0,
    features: [
      "ارزیابی بخش‌های اصلی",
      "ایجنت با سهمیه محدود",
      "نرخ‌نامه و ماشین‌حساب",
      "بدون پرداخت",
    ],
    entitlements: DEFAULT_ENTITLEMENTS.trial,
    isTrial: true,
    isActive: true,
    sortOrder: 0,
  },
];

export function normalizePlanCode(code: string) {
  if (code === "monthly") return "pro";
  if (code === "yearly") return "premium";
  return code;
}

export function planEntitlements(
  plan: Doc<"subscription_plans"> | null,
  fallbackCode = DEFAULT_PLAN_CODE,
): PlanEntitlements {
  return (
    plan?.entitlements ??
    DEFAULT_ENTITLEMENTS[plan?.code ?? fallbackCode] ??
    DEFAULT_ENTITLEMENTS[fallbackCode] ??
    DEFAULT_ENTITLEMENTS.basic
  );
}

export function monthlyPrice(plan: Doc<"subscription_plans"> | null) {
  return plan?.monthlyPriceToman ?? plan?.priceToman ?? 0;
}

export function yearlyPrice(plan: Doc<"subscription_plans"> | null) {
  if (plan?.yearlyPriceToman && plan.yearlyPriceToman > 0) {
    return plan.yearlyPriceToman;
  }
  const monthly = monthlyPrice(plan);
  const discount = Math.min(
    100,
    Math.max(0, plan?.yearlyDiscountPercent ?? 0),
  );
  return monthly > 0 ? Math.round(monthly * 12 * (1 - discount / 100)) : 0;
}

export function periodKey(now: number) {
  const date = new Date(now);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function effectiveSubscriptionStatus(
  subscription: Doc<"subscriptions"> | null,
  now = Date.now(),
): SubscriptionStatus {
  if (!subscription) return "expired";
  if (subscription.status === "canceled") return "canceled";
  if (subscription.status === "pending_payment") return "pending_payment";
  if (subscription.endsAt <= now) return "expired";
  return subscription.status;
}

export async function ensureBillingDefaults(ctx: MutationCtx) {
  const now = Date.now();
  for (const seed of DEFAULT_PLANS) {
    const existing = await ctx.db
      .query("subscription_plans")
      .withIndex("by_code", (q) => q.eq("code", seed.code))
      .first();
    if (!existing) {
      await ctx.db.insert("subscription_plans", {
        code: seed.code,
        name: seed.name,
        description: seed.description,
        durationDays: seed.durationDays,
        priceToman: seed.monthlyPriceToman,
        monthlyPriceToman: seed.monthlyPriceToman,
        yearlyPriceToman: seed.yearlyPriceToman,
        yearlyDiscountPercent: seed.yearlyDiscountPercent,
        features: seed.features,
        entitlements: seed.entitlements,
        isTrial: seed.isTrial,
        isActive: seed.isActive,
        sortOrder: seed.sortOrder,
        updatedAt: now,
      });
      continue;
    }
    const patch: Partial<Doc<"subscription_plans">> = {};
    if (!existing.description) patch.description = seed.description;
    if (existing.monthlyPriceToman === undefined) {
      patch.monthlyPriceToman = existing.priceToman ?? 0;
    }
    if (existing.yearlyPriceToman === undefined) {
      patch.yearlyPriceToman = yearlyPrice(existing);
    }
    if (existing.yearlyDiscountPercent === undefined) {
      patch.yearlyDiscountPercent = 0;
    }
    if (!existing.entitlements) {
      patch.entitlements = planEntitlements(existing, seed.code);
    }
    if (existing.isTrial === undefined) patch.isTrial = seed.isTrial;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, { ...patch, updatedAt: now });
    }
  }

  const settings = await ctx.db
    .query("billing_settings")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .first();
  if (!settings) {
    await ctx.db.insert("billing_settings", {
      key: "default",
      allowTrialReuse: false,
      gatewayProvider: "zarinpal",
      updatedAt: now,
    });
  }
  return await ctx.db
    .query("subscription_plans")
    .withIndex("by_code", (q) => q.eq("code", TRIAL_PLAN_CODE))
    .first();
}

export async function getPlan(
  ctx: QueryCtx | MutationCtx,
  code: string,
) {
  return await ctx.db
    .query("subscription_plans")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
}

export type BillingSnapshot = Awaited<ReturnType<typeof getBillingSnapshot>>;

export function assertAgentPlan(snapshot: BillingSnapshot) {
  if (!snapshot.isActive) {
    fail(
      "forbidden",
      "اشتراک این کافی‌نت فعال یا معتبر نیست. برای ادامه، از بخش «اشتراک من» اشتراک را تمدید کنید.",
    );
  }
  if (!snapshot.canUseAgent) {
    fail(
      "forbidden",
      "پلن فعلی شما به ایجنت هوشمند دسترسی ندارد. برای فعال‌سازی، پلن حرفه‌ای یا ویژه را انتخاب کنید.",
    );
  }
  return snapshot.usage;
}

export async function getBillingSnapshot(
  ctx: QueryCtx | MutationCtx,
  cafeId: Doc<"internet_cafes">["_id"],
  now = Date.now(),
) {
  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_cafe", (q) => q.eq("cafeId", cafeId))
    .collect();
  const subscription =
    rows.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  const resolvedPlanCode = subscription
    ? normalizePlanCode(subscription.planCode)
    : undefined;
  const plan = resolvedPlanCode ? await getPlan(ctx, resolvedPlanCode) : null;
  const entitlements = planEntitlements(plan, resolvedPlanCode);
  const key = periodKey(now);
  const usage = await ctx.db
    .query("subscription_usage")
    .withIndex("by_cafe_period", (q) =>
      q.eq("cafeId", cafeId).eq("periodKey", key),
    )
    .first();
  const aiUsed = usage?.aiRequests ?? 0;
  const status = effectiveSubscriptionStatus(subscription, now);
  const isActive = status === "active" || status === "trial";
  const aiLimit = entitlements.aiRequestsPerMonth;
  const aiRemaining = aiLimit <= 0 ? 0 : Math.max(0, aiLimit - aiUsed);
  const daysLeft = subscription
    ? Math.max(0, Math.ceil((subscription.endsAt - now) / DAY))
    : 0;
  const cafe = await ctx.db.get(cafeId);
  return {
    cafeId,
    subscription: subscription
      ? {
          id: subscription._id,
          planCode: resolvedPlanCode ?? subscription.planCode,
          planName: plan?.name ?? resolvedPlanCode ?? subscription.planCode,
          status,
          storedStatus: subscription.status,
          startsAt: subscription.startsAt,
          endsAt: subscription.endsAt,
          billingCycle: subscription.billingCycle ?? ("monthly" as BillingCycle),
          lastPaymentAt: subscription.lastPaymentAt ?? null,
          renewalAt: subscription.renewalAt ?? subscription.endsAt,
        }
      : null,
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          description: plan.description ?? null,
          features: plan.features,
          entitlements,
          monthlyPriceToman: monthlyPrice(plan),
          yearlyPriceToman: yearlyPrice(plan),
          yearlyDiscountPercent: plan.yearlyDiscountPercent ?? 0,
          isTrial: plan.isTrial === true,
          durationDays: plan.durationDays,
        }
      : null,
    status,
    isActive,
    daysLeft,
    entitlements,
    usage: {
      periodKey: key,
      aiUsed,
      aiLimit,
      aiRemaining,
    },
    canUseAgent: isActive && entitlements.agent && aiLimit !== 0,
    canUseRates: isActive && entitlements.rates,
    hasAdvancedReports: isActive && entitlements.advancedReports,
    hasAdvancedManagement: isActive && entitlements.advancedManagement,
    trialUsed: cafe?.trialUsedAt !== undefined,
    serverNow: now,
  };
}

export async function assertEmployeeQuota(
  ctx: QueryCtx | MutationCtx,
  cafeId: Doc<"internet_cafes">["_id"],
  additional = 0,
) {
  const snapshot = await getBillingSnapshot(ctx, cafeId);
  const limit = snapshot.entitlements.maxEmployees;
  if (limit < 0) return snapshot;
  const employees = await ctx.db
    .query("employees")
    .withIndex("by_cafe", (q) => q.eq("cafeId", cafeId))
    .collect();
  if (employees.length + additional > limit) {
    fail(
      "limit_reached",
      `پلن فعلی شما حداکثر ${limit.toLocaleString("fa-IR")} کارمند را پشتیبانی می‌کند. برای افزودن کارمند بیشتر، پلن را ارتقا دهید.`,
    );
  }
  return snapshot;
}

export function planFeatureMessage(feature: "agent" | "rates" | "accounting") {
  const labels = {
    agent: "ایجنت هوشمند",
    rates: "نرخ‌نامه",
    accounting: "حسابداری کامل",
  } as const;
  return `پلن فعلی شما به ${labels[feature]} دسترسی ندارد. برای فعال‌سازی، از بخش «اشتراک من» پلن حرفه‌ای یا ویژه را انتخاب کنید.`;
}

export async function assertPlanFeature(
  ctx: QueryCtx | MutationCtx,
  cafeId: Doc<"internet_cafes">["_id"],
  feature: "agent" | "rates" | "accounting",
  role?: "owner" | "employee" | "site_admin",
) {
  const snapshot = await getBillingSnapshot(ctx, cafeId);
  if (!snapshot.isActive) {
    fail(
      "forbidden",
      "اشتراک این کافی‌نت فعال یا معتبر نیست. برای ادامه، از بخش «اشتراک من» اشتراک را تمدید کنید.",
    );
  }
  if (feature === "agent" && !snapshot.canUseAgent) {
    fail("forbidden", planFeatureMessage("agent"));
  }
  if (feature === "rates" && !snapshot.canUseRates) {
    fail("forbidden", planFeatureMessage("rates"));
  }
  if (
    feature === "accounting" &&
    snapshot.entitlements.accounting !== "full"
  ) {
    fail("forbidden", planFeatureMessage("accounting"));
  }
  await assertCmsFeature(ctx, cafeId, feature, role);
  return snapshot;
}
