import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "./validation";

type DbContext = { db: QueryCtx["db"] | MutationCtx["db"] };

export async function featurePlanDecision(
  ctx: DbContext,
  cafeId: Id<"internet_cafes">,
  featureKey: string,
  role?: "owner" | "employee" | "site_admin",
) {
  const feature = await ctx.db
    .query("feature_flags")
    .withIndex("by_key", (q) => q.eq("key", featureKey))
    .first();
  if (!feature) return { allowed: true, dailyLimit: 0, monthlyLimit: 0 };
  if (!feature.isEnabled) return { allowed: false, dailyLimit: 0, monthlyLimit: 0 };
  if (
    role &&
    feature.allowedRoles.length > 0 &&
    !feature.allowedRoles.includes(role)
  ) {
    return { allowed: false, dailyLimit: 0, monthlyLimit: 0 };
  }
  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_cafe", (q) => q.eq("cafeId", cafeId))
    .collect();
  const subscription = subscriptions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const planCode =
    subscription?.planCode === "monthly"
      ? "pro"
      : subscription?.planCode === "yearly"
        ? "premium"
        : subscription?.planCode ?? "basic";
  const override = await ctx.db
    .query("feature_plan_limits")
    .withIndex("by_feature_plan", (q) =>
      q.eq("featureKey", featureKey).eq("planCode", planCode),
    )
    .first();
  if (override) {
    return {
      allowed: override.isAllowed,
      dailyLimit: override.dailyLimit,
      monthlyLimit: override.monthlyLimit,
    };
  }
  return {
    allowed:
      feature.allowedPlans.length === 0 ||
      feature.allowedPlans.includes(planCode),
    dailyLimit: feature.dailyLimit,
    monthlyLimit: feature.monthlyLimit,
  };
}

export async function assertCmsFeature(
  ctx: DbContext,
  cafeId: Id<"internet_cafes">,
  featureKey: string,
  role?: "owner" | "employee" | "site_admin",
) {
  const decision = await featurePlanDecision(ctx, cafeId, featureKey, role);
  if (!decision.allowed) {
    fail(
      "forbidden",
      "این قابلیت برای پلن یا نقش فعلی شما توسط مدیر سایت غیرفعال شده است. برای بررسی دسترسی با پشتیبانی تماس بگیرید.",
    );
  }
  return decision;
}
