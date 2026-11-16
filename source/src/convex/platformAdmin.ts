import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  requireAdminPermission,
  requireSession,
} from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { PLATFORM_SETTINGS_KEY, ensurePlatformDefaults, logAudit } from "./lib/platform";
import {
  isPaymentGatewayConfigured,
  periodKey as billingPeriodKey,
} from "./lib/billing";
import { fail, requireText } from "./lib/validation";

function optionalText(value: string | undefined, label: string, max: number) {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  if (text.length > max) {
    fail("validation", `${label} نباید بیشتر از ${max} نویسه باشد.`);
  }
  return text;
}

function optionalHttpUrl(value: string | undefined, label: string) {
  const text = optionalText(value, label, 800);
  if (!text) return undefined;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    fail("validation", `${label} معتبر نیست.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    fail("validation", `${label} باید با http یا https شروع شود.`);
  }
  return url.toString();
}

function optionalEmail(value: string | undefined) {
  const text = optionalText(value, "ایمیل پشتیبانی", 160);
  if (!text) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    fail("validation", "ایمیل پشتیبانی معتبر نیست.");
  }
  return text;
}

function settingsRow(settings: Doc<"platform_settings">) {
  return {
    platformName: settings.platformName,
    tagline: settings.tagline,
    logoUrl: settings.logoUrl ?? null,
    supportEmail: settings.supportEmail ?? null,
    supportPhone: settings.supportPhone ?? null,
    supportAddress: settings.supportAddress ?? null,
    instagramUrl: settings.instagramUrl ?? null,
    telegramUrl: settings.telegramUrl ?? null,
    whatsappUrl: settings.whatsappUrl ?? null,
    websiteUrl: settings.websiteUrl ?? null,
    timezone: settings.timezone,
    locale: settings.locale,
    defaultTheme: settings.defaultTheme,
    registrationEnabled: settings.registrationEnabled,
    notificationsEnabled: settings.notificationsEnabled,
    // These channels are not connected to a provider yet. Never present a
    // stored toggle as an operational delivery channel.
    emailNotificationsEnabled: false,
    smsNotificationsEnabled: false,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage ?? null,
    aiEnabled: settings.aiEnabled,
    aiModel: settings.aiModel,
    aiCostPerRequestToman: settings.aiCostPerRequestToman,
    backupSchedule: settings.backupSchedule,
    backupNote: settings.backupNote ?? null,
    updatedAt: settings.updatedAt,
  };
}

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSession(ctx);
    if (!session.isSiteAdmin) {
      fail("forbidden", "این عملیات فقط برای تیم مدیریت پلتفرم مجاز است.");
    }
    await ensurePlatformDefaults(ctx);
    return { ok: true };
  },
});

export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.SETTINGS_MANAGE);
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
      .first();
    if (!settings) return null;
    const trialPlan = await ctx.db
      .query("subscription_plans")
      .filter((q) => q.eq(q.field("isTrial"), true))
      .first();
    return {
      ...settingsRow(settings),
      trialDays: trialPlan?.durationDays ?? null,
      trialPlanCode: trialPlan?.code ?? null,
      billingSettings: await ctx.db
        .query("billing_settings")
        .withIndex("by_key", (q) => q.eq("key", "default"))
        .first()
        .then((row) =>
          row
            ? {
                allowTrialReuse: row.allowTrialReuse,
                gatewayProvider: row.gatewayProvider,
              }
            : null,
        ),
    };
  },
});

export const updateSettings = mutation({
  args: {
    platformName: v.string(),
    tagline: v.string(),
    logoUrl: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    supportPhone: v.optional(v.string()),
    supportAddress: v.optional(v.string()),
    instagramUrl: v.optional(v.string()),
    telegramUrl: v.optional(v.string()),
    whatsappUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    timezone: v.string(),
    locale: v.string(),
    defaultTheme: v.union(
      v.literal("light"),
      v.literal("dark"),
      v.literal("system"),
    ),
    registrationEnabled: v.boolean(),
    notificationsEnabled: v.boolean(),
    emailNotificationsEnabled: v.boolean(),
    smsNotificationsEnabled: v.boolean(),
    maintenanceMode: v.boolean(),
    maintenanceMessage: v.optional(v.string()),
    aiEnabled: v.boolean(),
    aiModel: v.string(),
    aiCostPerRequestToman: v.number(),
    backupSchedule: v.string(),
    backupNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.SETTINGS_MANAGE,
    );
    if (args.emailNotificationsEnabled || args.smsNotificationsEnabled) {
      fail(
        "validation",
        "ارسال ایمیل و پیامک هنوز به ارائه‌دهنده واقعی متصل نشده است و فعال‌سازی آن مجاز نیست.",
      );
    }
    const aiCost = Math.max(0, Math.round(args.aiCostPerRequestToman));
    if (!Number.isFinite(aiCost)) fail("validation", "هزینه تقریبی معتبر نیست.");
    const patch = {
      platformName: requireText(args.platformName, "نام سامانه", 2, 80),
      tagline: requireText(args.tagline, "شعار سامانه", 3, 160),
      logoUrl: optionalHttpUrl(args.logoUrl, "نشانی لوگو"),
      supportEmail: optionalEmail(args.supportEmail),
      supportPhone: optionalText(args.supportPhone, "تلفن پشتیبانی", 30),
      supportAddress: optionalText(args.supportAddress, "نشانی پشتیبانی", 300),
      instagramUrl: optionalHttpUrl(args.instagramUrl, "لینک اینستاگرام"),
      telegramUrl: optionalHttpUrl(args.telegramUrl, "لینک تلگرام"),
      whatsappUrl: optionalText(args.whatsappUrl, "لینک واتساپ", 300),
      websiteUrl: optionalHttpUrl(args.websiteUrl, "نشانی وب‌سایت"),
      timezone: requireText(args.timezone, "منطقه زمانی", 2, 60),
      locale: requireText(args.locale, "زبان", 2, 20),
      defaultTheme: args.defaultTheme,
      registrationEnabled: args.registrationEnabled,
      notificationsEnabled: args.notificationsEnabled,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
      maintenanceMode: args.maintenanceMode,
      maintenanceMessage:
        optionalText(args.maintenanceMessage, "پیام تعمیرات", 500) ?? undefined,
      aiEnabled: args.aiEnabled,
      aiModel: requireText(args.aiModel, "مدل هوش مصنوعی", 2, 120),
      aiCostPerRequestToman: aiCost,
      backupSchedule: requireText(args.backupSchedule, "زمان‌بندی پشتیبان", 2, 80),
      backupNote: optionalText(args.backupNote, "یادداشت پشتیبان", 500),
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    };
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
      .first();
    if (settings) {
      await ctx.db.insert("platform_settings_history", {
        settingsId: settings._id,
        actorId: session.user._id,
        snapshot: JSON.stringify(settings),
        note: "پیش از ویرایش تنظیمات",
        createdAt: Date.now(),
      });
      await ctx.db.patch(settings._id, patch);
    } else {
      await ctx.db.insert("platform_settings", {
        key: PLATFORM_SETTINGS_KEY,
        ...patch,
      });
    }
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "settings.updated",
      entityType: "platform_settings",
      summary: "تنظیمات عمومی پلتفرم به‌روزرسانی شد.",
      metadata: JSON.stringify({
        registrationEnabled: args.registrationEnabled,
        maintenanceMode: args.maintenanceMode,
        aiEnabled: args.aiEnabled,
        aiModel: args.aiModel,
      }),
    });
    return { ok: true };
  },
});

/** Operational snapshot for the platform administrator. */
export const systemHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.SETTINGS_MANAGE);
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
      .first();
    const cafes = await ctx.db.query("internet_cafes").take(2_000);
    const tickets = await ctx.db.query("support_tickets").take(2_000);
    const pendingOrders = await ctx.db
      .query("payment_orders")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .take(2_000);
    const failedOrders = await ctx.db
      .query("payment_orders")
      .withIndex("by_status_created", (q) => q.eq("status", "failed"))
      .take(2_000);
    const expiringSubscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_ends_at", (q) => q.gte("endsAt", now).lt("endsAt", now + 7 * day))
      .take(2_000);
    const agentRuns = await ctx.db
      .query("agent_runs")
      .withIndex("by_created", (q) => q.gte("createdAt", now - day))
      .take(2_000);
    const usage = await ctx.db
      .query("subscription_usage")
      .withIndex("by_period", (q) => q.eq("periodKey", billingPeriodKey(now)))
      .take(2_000);
    const recentAudit = await ctx.db
      .query("audit_logs")
      .withIndex("by_created")
      .order("desc")
      .take(8);
    const aiRequests = usage.reduce((total, row) => total + row.aiRequests, 0);
    const aiCost = aiRequests * (settings?.aiCostPerRequestToman ?? 0);
    return {
      generatedAt: now,
      database: { reachable: true, cafesCapped: cafes.length >= 2_000 },
      cafes: {
        total: cafes.length,
        active: cafes.filter((cafe) => cafe.status === "active").length,
        suspended: cafes.filter((cafe) => cafe.status === "suspended").length,
      },
      support: {
        open: tickets.filter((ticket) => ticket.status === "open").length,
        inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
        urgent: tickets.filter((ticket) => ticket.priority === "urgent" || ticket.priority === "high").length,
      },
      billing: {
        pendingOrders: pendingOrders.length,
        failedOrders: failedOrders.length,
        expiringWithinSevenDays: expiringSubscriptions.length,
      },
      agent: {
        runs24h: agentRuns.length,
        errors24h: agentRuns.filter((run) => run.status === "error").length,
        fallbacks24h: agentRuns.filter((run) => run.status === "fallback").length,
        requestsThisMonth: aiRequests,
        estimatedCostThisMonthToman: aiCost,
      },
      backup: {
        schedule: settings?.backupSchedule ?? "daily",
        note: settings?.backupNote ?? null,
      },
      integrations: {
        paymentConfigured: isPaymentGatewayConfigured(),
        aiConfigured: Boolean(process.env.VLY_INTEGRATION_KEY?.trim()),
        // No email/SMS delivery adapter is implemented in this release.
        emailToggle: false,
        smsToggle: false,
      },
      recentAudit: recentAudit.map((row) => ({
        id: row._id,
        action: row.action,
        summary: row.summary,
        createdAt: row.createdAt,
      })),
      sectionsCappedAt: 2_000,
    };
  },
});

/**
 * Public, non-sensitive platform identity and support details. Safe to read
 * before sign-in so legal and help pages can show the configured contact data.
 */
export const publicProfile = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
      .first();
    return {
      platformName: settings?.platformName ?? "کافی‌نت‌یار",
      tagline: settings?.tagline ?? "دستیار هوشمند مدیریت کافی‌نت",
      logoUrl: settings?.logoUrl ?? null,
      supportEmail: settings?.supportEmail ?? null,
      supportPhone: settings?.supportPhone ?? null,
      supportAddress: settings?.supportAddress ?? null,
      instagramUrl: settings?.instagramUrl ?? null,
      telegramUrl: settings?.telegramUrl ?? null,
      whatsappUrl: settings?.whatsappUrl ?? null,
      websiteUrl: settings?.websiteUrl ?? null,
      registrationEnabled: settings?.registrationEnabled ?? true,
      maintenanceMode: settings?.maintenanceMode ?? false,
      maintenanceMessage: settings?.maintenanceMessage ?? null,
    };
  },
});

export const notifications = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE,
    );
    const rows = await ctx.db
      .query("platform_notifications")
      .withIndex("by_created")
      .order("desc")
      .take(100);
    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      body: row.body,
      tone: row.tone,
      isActive: row.isActive,
      startsAt: row.startsAt,
      endsAt: row.endsAt ?? null,
      audience: row.audience ?? "all",
      planCode: row.planCode ?? null,
      cafeId: row.cafeId ?? null,
      kind: row.kind ?? "broadcast",
      createdAt: row.createdAt,
    }));
  },
});

export const notificationCafes = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE,
    );
    const cafes = await ctx.db.query("internet_cafes").take(500);
    return cafes
      .sort((a, b) => a.name.localeCompare(b.name, "fa"))
      .map((cafe) => ({ id: cafe._id, name: cafe.name }));
  },
});

export const createNotification = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    tone: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("critical"),
    ),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    audience: v.optional(
      v.union(v.literal("all"), v.literal("plan"), v.literal("cafe")),
    ),
    planCode: v.optional(v.string()),
    cafeId: v.optional(v.id("internet_cafes")),
    kind: v.optional(
      v.union(
        v.literal("broadcast"),
        v.literal("welcome"),
        v.literal("expiry_warning"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE,
    );
    const title = requireText(args.title, "عنوان اعلان", 3, 120);
    const body = requireText(args.body, "متن اعلان", 5, 1000);
    const audience = args.audience ?? "all";
    const planCode = args.planCode?.trim() || undefined;
    if (audience === "plan" && !planCode) {
      fail("validation", "برای اعلان مخصوص پلن، کد پلن لازم است.");
    }
    if (audience === "cafe") {
      if (!args.cafeId) fail("validation", "برای اعلان مخصوص کافی‌نت، کافی‌نت را انتخاب کنید.");
      const cafe = await ctx.db.get(args.cafeId);
      if (!cafe) fail("not_found", "کافی‌نت انتخاب‌شده پیدا نشد.");
    }
    if (!Number.isFinite(args.startsAt)) {
      fail("validation", "تاریخ شروع معتبر نیست.");
    }
    if (
      args.endsAt !== undefined &&
      (!Number.isFinite(args.endsAt) || args.endsAt <= args.startsAt)
    ) {
      fail("validation", "تاریخ پایان باید بعد از شروع باشد.");
    }
    const id = await ctx.db.insert("platform_notifications", {
      title,
      body,
      tone: args.tone,
      isActive: true,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      audience,
      planCode: audience === "plan" ? planCode : undefined,
      cafeId: audience === "cafe" ? args.cafeId : undefined,
      kind: args.kind ?? "broadcast",
      createdBy: session.user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "notification.created",
      entityType: "platform_notification",
      entityId: id,
      summary: `اعلان «${title}» ساخته شد.`,
    });
    return { notificationId: id };
  },
});

export const setNotificationActive = mutation({
  args: { notificationId: v.id("platform_notifications"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE,
    );
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) fail("not_found", "اعلان پیدا نشد.");
    await ctx.db.patch(args.notificationId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "notification.toggled",
      entityType: "platform_notification",
      entityId: args.notificationId,
      summary: `اعلان «${notification.title}» ${args.isActive ? "فعال" : "غیرفعال"} شد.`,
    });
    return { ok: true };
  },
});

export const auditLogs = query({
  args: {
    search: v.optional(v.string()),
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.AUDIT_VIEW);
    const rows = await ctx.db
      .query("audit_logs")
      .withIndex("by_created")
      .order("desc")
      .take(500);
    const users = await ctx.db.query("users").collect();
    const cafes = await ctx.db.query("internet_cafes").collect();
    const userById = new Map(users.map((user) => [user._id, user]));
    const cafeById = new Map(cafes.map((cafe) => [cafe._id, cafe]));
    const search = args.search?.trim().toLocaleLowerCase("fa") ?? "";
    return rows
      .filter((row) => {
        if (args.action && row.action !== args.action) return false;
        if (args.entityType && row.entityType !== args.entityType) return false;
        if (!search) return true;
        const actor = userById.get(row.actorId);
        return `${row.summary} ${row.action} ${row.entityType} ${
          actor?.name ?? ""
        } ${actor?.phone ?? ""} ${
          row.cafeId ? cafeById.get(row.cafeId)?.name ?? "" : ""
        }`
          .toLocaleLowerCase("fa")
          .includes(search);
      })
      .map((row) => {
        const actor = userById.get(row.actorId);
        return {
          id: row._id,
          actorName: actor?.name ?? "مدیر حذف‌شده",
          actorPhone: actor?.phone ?? null,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId ?? null,
          cafeName: row.cafeId ? cafeById.get(row.cafeId)?.name ?? null : null,
          summary: row.summary,
          metadata: row.metadata ?? null,
          createdAt: row.createdAt,
        };
      });
  },
});

export const publicSettings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
      .first();
    return {
      registrationEnabled: settings?.registrationEnabled ?? true,
      maintenanceMode: settings?.maintenanceMode ?? false,
      maintenanceMessage: settings?.maintenanceMessage ?? null,
      platformName: settings?.platformName ?? "کافی‌نت‌یار",
    };
  },
});

export const aiRuntimeConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
      .first();
    return {
      aiEnabled: settings?.aiEnabled ?? true,
      aiModel: settings?.aiModel ?? "openai/gpt-4o-mini",
      aiCostPerRequestToman: settings?.aiCostPerRequestToman ?? 0,
    };
  },
});

export const logCafeAccess = internalMutation({
  args: { actorId: v.id("users"), cafeId: v.id("internet_cafes") },
  handler: async (ctx, args) => {
    const cafe = await ctx.db.get(args.cafeId);
    await logAudit(ctx, {
      actorId: args.actorId,
      action: "cafe.sensitive_view",
      entityType: "internet_cafe",
      entityId: args.cafeId,
      cafeId: args.cafeId,
      summary: `اطلاعات حساس کافی‌نت ${cafe?.name ?? args.cafeId} مشاهده شد.`,
    });
  },
});
