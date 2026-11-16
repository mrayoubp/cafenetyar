import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  assertCafeActive,
  getSession,
  getSessionForUser,
  requireOwner,
  requireSession,
} from "./lib/access";
import {
  normalizePhone,
  validateCafeInput,
  validateName,
  fail,
} from "./lib/validation";
import { PERMISSION_DEFINITIONS } from "./permissions";
import { ensureNewsDefaults } from "./lib/newsDefaults";
import { ensureWebsiteCatalog } from "./lib/websiteDefaults";
import { ensureAgentDefaults } from "./lib/agentDefaults";
import {
  configuredAdminBootstrapPhone,
  ensurePlatformDefaults,
} from "./lib/platform";
import {
  LEGACY_PLAN_CODES,
  TRIAL_PLAN_CODE,
  ensureBillingDefaults,
  getBillingSnapshot,
} from "./lib/billing";

const DAY = 24 * 60 * 60 * 1000;

/** Idempotently seeds the current billing catalogue. */
export async function ensureDefaultPlans(ctx: MutationCtx) {
  return await ensureBillingDefaults(ctx);
}

/** Seeds the permissions catalog used by the employee permission editor. */
export async function ensurePermissionCatalog(ctx: MutationCtx) {
  for (const [index, permission] of PERMISSION_DEFINITIONS.entries()) {
    const existing = await ctx.db
      .query("permissions")
      .withIndex("by_key", (q) => q.eq("key", permission.key))
      .first();
    if (!existing) {
      await ctx.db.insert("permissions", {
        key: permission.key,
        label: permission.label,
        description: permission.description,
        available: permission.available,
        sortOrder: index,
      });
    } else if (
      existing.label !== permission.label ||
      existing.description !== permission.description ||
      existing.available !== permission.available ||
      existing.sortOrder !== index
    ) {
      await ctx.db.patch(existing._id, {
        label: permission.label,
        description: permission.description,
        available: permission.available,
        sortOrder: index,
      });
    }
  }
}

export async function createWorkspace(
  ctx: MutationCtx,
  args: {
    ownerId: Parameters<typeof getSessionForUser>[1];
    name: string;
    province: string;
    city: string;
    address: string;
    recovery?: { codeHash: string; salt: string; phone: string } | null;
  },
) {
  const existing = await ctx.db
    .query("internet_cafes")
    .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
    .first();
  if (existing) {
    fail("conflict", "برای این حساب قبلاً یک کافی‌نت ثبت شده است.");
  }

  const trial = await ensureDefaultPlans(ctx);
  await ensurePermissionCatalog(ctx);
  await ensurePlatformDefaults(ctx);
  const now = Date.now();
  const cafeId = await ctx.db.insert("internet_cafes", {
    ownerId: args.ownerId,
    name: args.name,
    province: args.province,
    city: args.city,
    address: args.address,
    status: "active",
    trialUsedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const plan = trial ?? {
    code: TRIAL_PLAN_CODE,
    durationDays: 14,
    name: "دوره آزمایشی",
  };

  await ctx.db.insert("subscriptions", {
    cafeId,
    planCode: plan.code,
    status: "trial",
    startsAt: now,
    endsAt: now + (plan.durationDays ?? 14) * DAY,
    createdAt: now,
    updatedAt: now,
  });

  // The newsroom is global. Only explicit development seeding creates demo
  // articles; production workspaces start with an empty, honest newsroom.
  await ensureNewsDefaults(ctx, {
    actorId: args.ownerId,
    seedDemo: process.env.SEED_DEMO_DATA === "true",
  });
  // The directory is shared, and the first workspace bootstraps its curated
  // official catalogue. Later workspaces reuse it without duplicating links.
  await ensureWebsiteCatalog(ctx, {
    actorId: args.ownerId,
    onlyIfEmpty: true,
  });
  // Service and knowledge taxonomies are global. Prices intentionally start
  // empty and marked as needing review instead of showing invented tariffs.
  await ensureAgentDefaults(ctx, {
    actorId: args.ownerId,
    onlyIfEmpty: true,
  });

  if (args.recovery) {
    await ctx.db.insert("recovery_codes", {
      userId: args.ownerId,
      phone: args.recovery.phone,
      codeHash: args.recovery.codeHash,
      salt: args.recovery.salt,
      attempts: 0,
      createdAt: now,
    });
  }

  return cafeId;
}

/**
 * Creates the cafe, trial subscription and recovery record for a freshly
 * created owner account. Only callable from our own signup action.
 */
export const bootstrapOwner = internalMutation({
  args: {
    ownerId: v.id("users"),
    name: v.string(),
    province: v.string(),
    city: v.string(),
    address: v.string(),
    recoveryHash: v.string(),
    recoverySalt: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const cafeId = await createWorkspace(ctx, {
      ownerId: args.ownerId,
      name: args.name,
      province: args.province,
      city: args.city,
      address: args.address,
      recovery: {
        codeHash: args.recoveryHash,
        salt: args.recoverySalt,
        phone: args.phone,
      },
    });
    await ctx.db.patch(args.ownerId, { termsAcceptedAt: Date.now() });
    return { cafeId };
  },
});

/** Fallback for accounts whose workspace could not be created during signup. */
export const createMyCafe = mutation({
  args: {
    name: v.string(),
    province: v.string(),
    city: v.string(),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx);
    if (session.isGuest) {
      fail("forbidden", "حساب مهمان نمی‌تواند کافی‌نت ثبت کند.");
    }
    if (session.isSiteAdmin) {
      fail("forbidden", "حساب مدیر اصلی پلتفرم نمی‌تواند کافی‌نت ثبت کند.");
    }
    if (session.cafe) {
      fail("conflict", "برای این حساب قبلاً یک کافی‌نت ثبت شده است.");
    }
    const input = validateCafeInput(args);
    const cafeId = await createWorkspace(ctx, {
      ownerId: session.user._id,
      ...input,
    });
    return { cafeId };
  },
});

/** Everything the UI needs to render tenant-aware navigation and guards. */
export const myContext = query({
  args: {},
  handler: async (ctx) => {
    const session = await getSession(ctx);
    if (!session) return null;

    const adminBootstrapPhone = configuredAdminBootstrapPhone();
    const userPhone = normalizePhone(session.user.phone ?? "");
    const canBootstrapAdmin =
      adminBootstrapPhone !== null &&
      userPhone === adminBootstrapPhone &&
      !session.isSiteAdmin &&
      !session.isBlocked &&
      !session.isGuest &&
      !session.employee &&
      (!session.cafe || session.cafe.status === "active");
    const billing = session.cafe
      ? await getBillingSnapshot(ctx, session.cafe._id)
      : null;
    const now = Date.now();
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();
    const notificationRows = await ctx.db
      .query("platform_notifications")
      .withIndex("by_active_created", (q) => q.eq("isActive", true))
      .order("desc")
      .take(12);
    const planCode = billing?.subscription?.planCode ?? null;
    const cafeAgeDays = session.cafe
      ? (now - session.cafe.createdAt) / DAY
      : Number.POSITIVE_INFINITY;
    const notifications =
      settings?.notificationsEnabled === false
        ? []
        : notificationRows
            .filter((item) => {
              if (item.startsAt > now) return false;
              if (item.endsAt !== undefined && item.endsAt <= now) return false;
              if (
                item.audience === "plan" &&
                (!planCode || item.planCode !== planCode)
              ) {
                return false;
              }
              if (
                item.audience === "cafe" &&
                (!session.cafe || item.cafeId !== session.cafe._id)
              ) {
                return false;
              }
              if (item.kind === "welcome" && cafeAgeDays > 7) return false;
              if (
                item.kind === "expiry_warning" &&
                (!billing || billing.daysLeft > 7 || billing.daysLeft <= 0)
              ) {
                return false;
              }
              return true;
            })
            .slice(0, 6)
            .map((item) => ({
              id: item._id,
              title: item.title,
              body: item.body,
              tone: item.tone,
              createdAt: item.createdAt,
              kind: item.kind ?? "broadcast",
            }));

    return {
      user: {
        id: session.user._id,
        name: session.user.name ?? null,
        phone: session.user.phone ?? null,
        isAnonymous: session.user.isAnonymous === true,
        requiresPhoneVerification: session.user.requiresPhoneVerification === true && !session.user.phoneVerificationTime,
      },
      isSiteAdmin: session.isSiteAdmin,
      isSuperAdmin: session.isSuperAdmin,
      isPlatformOwner: session.isPlatformOwner,
      isBlocked: session.isBlocked,
      adminRoles: session.adminRoles,
      adminPermissions: session.adminPermissions,
      isGuest: session.isGuest,
      needsSetup: session.needsSetup,
      isOwner: session.isOwner,
      membershipActive: session.membershipActive,
      permissions: session.permissions,
      cafe: session.cafe
        ? {
            id: session.cafe._id,
            name: session.cafe.name,
            province: session.cafe.province,
            city: session.cafe.city,
            address: session.cafe.address,
            status: session.cafe.status,
            createdAt: session.cafe.createdAt,
          }
        : null,
      membership: session.isOwner
        ? { role: "owner" as const, title: "صاحب کافی‌نت" }
        : session.employee
          ? {
              role: "employee" as const,
              id: session.employee._id,
              title: session.employee.roleTitle || "کارمند",
              active: session.employee.active,
            }
          : null,
      subscription: billing?.subscription ?? null,
      plan: billing?.plan ?? null,
      entitlements: billing?.entitlements ?? null,
      usage: billing?.usage ?? null,
      subscriptionActive: billing?.isActive ?? false,
      canUseAgent: billing?.canUseAgent ?? false,
      canUseRates: billing?.canUseRates ?? false,
      hasAdvancedReports: billing?.hasAdvancedReports ?? false,
      hasAdvancedManagement: billing?.hasAdvancedManagement ?? false,
      daysLeft: billing?.daysLeft ?? 0,
      trialUsed: billing?.trialUsed ?? false,
      platform: {
        name: settings?.platformName ?? "کافی‌نت‌یار",
        tagline: settings?.tagline ?? "دستیار هوشمند مدیریت کافی‌نت",
        supportEmail: settings?.supportEmail ?? null,
        supportPhone: settings?.supportPhone ?? null,
        maintenanceMode: settings?.maintenanceMode ?? false,
        maintenanceMessage: settings?.maintenanceMessage ?? null,
        registrationEnabled: settings?.registrationEnabled ?? true,
        adminBootstrapConfigured: adminBootstrapPhone !== null,
        canBootstrapAdmin,
      },
      notifications,
      serverNow: Date.now(),
    };
  },
});

export const updateCafe = mutation({
  args: {
    name: v.string(),
    province: v.string(),
    city: v.string(),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwner(ctx);
    assertCafeActive(session.cafe);
    const input = validateCafeInput(args);
    await ctx.db.patch(session.cafe._id, {
      ...input,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const updateProfileName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx);
    if (session.isGuest) {
      fail("forbidden", "حساب مهمان قابل ویرایش نیست.");
    }
    const name = validateName(args.name);
    await ctx.db.patch(session.user._id, { name });
    if (session.employee) {
      await ctx.db.patch(session.employee._id, {
        fullName: name,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    await requireSession(ctx);
    const plans = await ctx.db
      .query("subscription_plans")
      .withIndex("by_sort_order")
      .collect();
    return plans
      .filter(
        (plan) =>
          plan.isActive &&
          plan.isTrial !== true &&
          !(LEGACY_PLAN_CODES as readonly string[]).includes(plan.code),
      )
      .map((plan) => ({
        code: plan.code,
        name: plan.name,
        description: plan.description ?? null,
        durationDays: plan.durationDays,
        priceToman: plan.monthlyPriceToman ?? plan.priceToman,
        monthlyPriceToman: plan.monthlyPriceToman ?? plan.priceToman,
        yearlyPriceToman: plan.yearlyPriceToman ?? 0,
        yearlyDiscountPercent: plan.yearlyDiscountPercent ?? 0,
        features: plan.features,
        entitlements: plan.entitlements ?? null,
        isActive: plan.isActive,
      }));
  },
});

/**
 * Used by server actions before creating a new auth account, to reject
 * duplicated phone numbers deterministically.
 */
export const findByPhone = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    if (!phone) return { phone: null, user: null, employee: null };
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    return {
      phone,
      user: user
        ? {
            id: user._id,
            name: user.name ?? null,
            role: user.role ?? null,
            isAnonymous: user.isAnonymous === true,
          }
        : null,
      employee: employee
        ? { id: employee._id, cafeId: employee.cafeId, active: employee.active }
        : null,
    };
  },
});

/** Minimal authorization snapshot for server actions. */
export const permissionSnapshot = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const session = await getSessionForUser(ctx, args.userId);
    if (!session) return null;
    return {
      userId: session.user._id,
      name: session.user.name ?? null,
      phone: session.user.phone ?? null,
      isOwner: session.isOwner,
      isSiteAdmin: session.isSiteAdmin,
      isSuperAdmin: session.isSuperAdmin,
      isPlatformOwner: session.isPlatformOwner,
      isBlocked: session.isBlocked,
      adminPermissions: session.adminPermissions,
      isGuest: session.isGuest,
      membershipActive: session.membershipActive,
      cafeId: session.cafe?._id ?? null,
      cafeStatus: session.cafe?.status ?? null,
      permissions: session.permissions,
    };
  },
});

/** Owner-level guard for actions that must also reject suspended cafes. */
export const actionOwnerContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const session = await getSessionForUser(ctx, args.userId);
    if (!session || !session.isOwner || !session.cafe) return null;
    return {
      cafeId: session.cafe._id,
      cafeStatus: session.cafe.status,
      permissions: session.permissions,
    };
  },
});
