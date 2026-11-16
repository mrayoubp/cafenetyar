import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getSession, requirePlatformOwner } from "./lib/access";
import { logAudit } from "./lib/platform";
import {
  ALLOWED_FEATURE_ROLES,
  ALLOWED_PLAN_CODES,
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_KEY,
  ensureSiteDefaults,
  normalizeHome,
  normalizeSiteSettings,
  normalizeTheme,
  parseSiteSettings,
  siteSettingsValidator,
} from "./lib/siteCms";
import { fail, requireText } from "./lib/validation";

const MAX_PAGE_BODY = 40_000;
const MAX_IMAGE_URLS = 8;

function publicPage(row: Doc<"site_pages">) {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    imageUrls: row.imageUrls,
    sortOrder: row.sortOrder,
    publishedAt: row.publishedAt ?? null,
  };
}

function adminPage(row: Doc<"site_pages">) {
  return {
    id: row._id,
    slug: row.slug,
    published: {
      title: row.title,
      summary: row.summary,
      body: row.body,
      imageUrls: row.imageUrls,
      sortOrder: row.sortOrder,
      status: row.status,
    },
    draft: {
      title: row.draftTitle,
      summary: row.draftSummary,
      body: row.draftBody,
      imageUrls: row.draftImageUrls,
      sortOrder: row.draftSortOrder,
      status: row.draftStatus,
    },
    publishedAt: row.publishedAt ?? null,
    updatedAt: row.updatedAt,
  };
}

function adminNav(row: Doc<"navigation_items">) {
  return {
    id: row._id,
    label: row.label,
    href: row.href,
    location: row.location,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    isExternal: row.isExternal,
    requiredPlanCode: row.requiredPlanCode ?? null,
    requiredPermission: row.requiredPermission ?? null,
    updatedAt: row.updatedAt,
  };
}

function validateHref(value: string) {
  const href = requireText(value, "نشانی منو", 1, 500);
  if (
    (!href.startsWith("/") || href.startsWith("//")) &&
    !href.startsWith("#") &&
    !/^https?:\/\//.test(href)
  ) {
    fail("validation", "نشانی منو باید با /، # یا http شروع شود.");
  }
  return href;
}

function validateSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) {
    fail(
      "validation",
      "شناسه صفحه فقط می‌تواند حروف انگلیسی کوچک، عدد و خط تیره داشته باشد.",
    );
  }
  return slug;
}

function validateImageUrls(values: string[]) {
  if (values.length > MAX_IMAGE_URLS) {
    fail("validation", `حداکثر ${MAX_IMAGE_URLS} تصویر برای هر صفحه مجاز است.`);
  }
  return values.map((value) => {
    const url = value.trim();
    if (!url) fail("validation", "نشانی تصویر خالی است.");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      fail("validation", "نشانی تصویر معتبر نیست.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      fail("validation", "تصویر باید با http یا https شروع شود.");
    }
    return parsed.toString();
  });
}

function validatePageBody(value: string) {
  const body = value.trim();
  if (body.length > MAX_PAGE_BODY) {
    fail("validation", "متن صفحه بیش از حد طولانی است.");
  }
  return body;
}

/** Public, non-sensitive site configuration. */
export const publicSite = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("site_settings")
      .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
      .first();
    const settings = row ? parseSiteSettings(row.published) : DEFAULT_SITE_SETTINGS;
    const pages = await ctx.db
      .query("site_pages")
      .withIndex("by_sort_order")
      .collect();
    return {
      theme: settings.theme,
      home: settings.home,
      pages: pages
        .filter((page) => page.status === "published")
        .map(publicPage),
    };
  },
});

/** A single published CMS page, used by the public page renderer. */
export const publicPageBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("site_pages")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug.trim().toLowerCase()))
      .first();
    if (!row || row.status !== "published") return null;
    return publicPage(row);
  },
});

/** Public header/footer navigation, filtered for active entries only. */
export const publicNavigation = query({
  args: { location: v.optional(v.union(v.literal("public"), v.literal("footer"))) },
  handler: async (ctx, args) => {
    const location = args.location ?? "public";
    const session = await getSession(ctx);
    const cafeId = session?.cafe?._id ?? null;
    const subscription = cafeId
      ? (
          await ctx.db
            .query("subscriptions")
            .withIndex("by_cafe", (q) => q.eq("cafeId", cafeId))
            .collect()
        ).sort((a, b) => b.updatedAt - a.updatedAt)[0]
      : null;
    const planCode =
      subscription?.planCode === "monthly"
        ? "pro"
        : subscription?.planCode === "yearly"
          ? "premium"
          : subscription?.planCode;
    const rows = await ctx.db
      .query("navigation_items")
      .withIndex("by_location_sort", (q) => q.eq("location", location))
      .collect();
    return rows
      .filter((row) => row.isActive)
      .filter(
        (row) =>
          !row.requiredPlanCode ||
          (planCode !== undefined && row.requiredPlanCode === planCode),
      )
      .filter(
        (row) =>
          !row.requiredPermission ||
          (session?.permissions ?? []).some(
            (permission) => permission === row.requiredPermission,
          ),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(adminNav);
  },
});

/** Full CMS state for the owner console. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    const row = await ctx.db
      .query("site_settings")
      .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
      .first();
    const pages = await ctx.db
      .query("site_pages")
      .withIndex("by_sort_order")
      .collect();
    const navigation = await ctx.db.query("navigation_items").collect();
    const features = await ctx.db
      .query("feature_flags")
      .withIndex("by_sort_order")
      .collect();
    const planLimits = await ctx.db.query("feature_plan_limits").collect();
    const aiUsage = await ctx.db.query("subscription_usage").collect();
    const aiTotal = aiUsage.reduce((sum, usage) => sum + usage.aiRequests, 0);
    const versions = await ctx.db
      .query("content_versions")
      .withIndex("by_created")
      .order("desc")
      .take(30);
    return {
      settings: {
        draft: row ? parseSiteSettings(row.draft) : DEFAULT_SITE_SETTINGS,
        published: row ? parseSiteSettings(row.published) : DEFAULT_SITE_SETTINGS,
        publishedAt: row?.publishedAt ?? null,
        updatedAt: row?.updatedAt ?? null,
      },
      pages: pages.map(adminPage),
      navigation: navigation
        .sort((a, b) => a.location.localeCompare(b.location) || a.sortOrder - b.sortOrder)
        .map(adminNav),
      features: features.map((feature) => ({
        id: feature._id,
        key: feature.key,
        label: feature.label,
        description: feature.description,
        isEnabled: feature.isEnabled,
        allowedPlans: feature.allowedPlans,
        allowedRoles: feature.allowedRoles,
        dailyLimit: feature.dailyLimit,
        monthlyLimit: feature.monthlyLimit,
        sortOrder: feature.sortOrder,
        updatedAt: feature.updatedAt,
      })),
      planLimits: planLimits.map((limit) => ({
        id: limit._id,
        featureKey: limit.featureKey,
        planCode: limit.planCode,
        isAllowed: limit.isAllowed,
        dailyLimit: limit.dailyLimit,
        monthlyLimit: limit.monthlyLimit,
      })),
      usage: {
        aiRequests: aiTotal,
        note: "میزان مصرف هوش مصنوعی از شمارنده واقعی درخواست‌های ماه جاری محاسبه شده است.",
      },
      versions: versions.map((version) => ({
        id: version._id,
        entityType: version.entityType,
        entityKey: version.entityKey,
        label: version.label,
        createdAt: version.createdAt,
      })),
      planCodes: [...ALLOWED_PLAN_CODES],
      roleCodes: [...ALLOWED_FEATURE_ROLES],
    };
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requirePlatformOwner(ctx);
    await ensureSiteDefaults(ctx, session.user._id);
    return { ok: true };
  },
});

export const saveSettingsDraft = mutation({
  args: { settings: siteSettingsValidator },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    await ensureSiteDefaults(ctx, session.user._id);
    const row = await ctx.db
      .query("site_settings")
      .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
      .first();
    if (!row) fail("not_found", "تنظیمات سایت پیدا نشد.");
    const settings = {
      theme: normalizeTheme(args.settings.theme),
      home: normalizeHome(args.settings.home),
    };
    await ctx.db.patch(row._id, {
      draft: JSON.stringify(settings),
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.settings_draft_saved",
      entityType: "site_settings",
      summary: "پیش‌نویس ظاهر و صفحه اصلی سایت ذخیره شد.",
    });
    return { ok: true };
  },
});

export const discardSettingsDraft = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requirePlatformOwner(ctx);
    const row = await ctx.db
      .query("site_settings")
      .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
      .first();
    if (!row) fail("not_found", "تنظیمات سایت پیدا نشد.");
    await ctx.db.patch(row._id, {
      draft: row.published,
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.settings_draft_discarded",
      entityType: "site_settings",
      summary: "پیش‌نویس تنظیمات سایت کنار گذاشته شد.",
    });
    return { ok: true };
  },
});

export const publishSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requirePlatformOwner(ctx);
    const row = await ctx.db
      .query("site_settings")
      .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
      .first();
    if (!row) fail("not_found", "تنظیمات سایت پیدا نشد.");
    const parsed = parseSiteSettings(row.draft);
    const now = Date.now();
    await ctx.db.patch(row._id, {
      published: JSON.stringify(parsed),
      publishedAt: now,
      updatedAt: now,
      updatedBy: session.user._id,
    });
    await ctx.db.insert("content_versions", {
      entityType: "site_settings",
      entityKey: SITE_SETTINGS_KEY,
      label: "انتشار ظاهر و صفحه اصلی",
      snapshot: JSON.stringify(parsed),
      actorId: session.user._id,
      createdAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.settings_published",
      entityType: "site_settings",
      summary: "تنظیمات ظاهر و صفحه اصلی سایت منتشر شد.",
    });
    return { ok: true };
  },
});

export const restoreSettingsVersion = mutation({
  args: { versionId: v.id("content_versions") },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const version = await ctx.db.get(args.versionId);
    if (
      !version ||
      version.entityType !== "site_settings" ||
      version.entityKey !== SITE_SETTINGS_KEY
    ) {
      fail("not_found", "نسخه تنظیمات پیدا نشد.");
    }
    const parsed = normalizeSiteSettings(JSON.parse(version.snapshot));
    const row = await ctx.db
      .query("site_settings")
      .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
      .first();
    if (!row) fail("not_found", "تنظیمات سایت پیدا نشد.");
    await ctx.db.patch(row._id, {
      draft: JSON.stringify(parsed),
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.settings_version_restored_to_draft",
      entityType: "site_settings",
      summary: "نسخه قبلی تنظیمات سایت در پیش‌نویس بازیابی شد.",
    });
    return { ok: true };
  },
});

export const createPage = mutation({
  args: { slug: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const slug = validateSlug(args.slug);
    const existing = await ctx.db
      .query("site_pages")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) fail("conflict", "صفحه‌ای با این شناسه وجود دارد.");
    const title = requireText(args.title, "عنوان صفحه", 2, 120);
    const sortOrder = (await ctx.db.query("site_pages").collect()).length * 10 + 10;
    const id = await ctx.db.insert("site_pages", {
      slug,
      title,
      summary: "",
      body: "",
      imageUrls: [],
      sortOrder,
      status: "hidden",
      draftTitle: title,
      draftSummary: "",
      draftBody: "",
      draftImageUrls: [],
      draftSortOrder: sortOrder,
      draftStatus: "hidden",
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.page_created",
      entityType: "site_page",
      entityId: id,
      summary: `صفحه «${title}» به صورت پیش‌نویس ساخته شد.`,
    });
    return { pageId: id };
  },
});

export const savePageDraft = mutation({
  args: {
    pageId: v.id("site_pages"),
    title: v.string(),
    summary: v.string(),
    body: v.string(),
    imageUrls: v.array(v.string()),
    sortOrder: v.number(),
    status: v.union(v.literal("published"), v.literal("hidden")),
  },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const page = await ctx.db.get(args.pageId);
    if (!page) fail("not_found", "صفحه پیدا نشد.");
    await ctx.db.patch(page._id, {
      draftTitle: requireText(args.title, "عنوان صفحه", 2, 120),
      draftSummary: args.summary.trim().slice(0, 500),
      draftBody: validatePageBody(args.body),
      draftImageUrls: validateImageUrls(args.imageUrls),
      draftSortOrder: Math.max(0, Math.round(args.sortOrder)),
      draftStatus: args.status,
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.page_draft_saved",
      entityType: "site_page",
      entityId: page._id,
      summary: `پیش‌نویس صفحه «${page.draftTitle}» ذخیره شد.`,
    });
    return { ok: true };
  },
});

export const discardPageDraft = mutation({
  args: { pageId: v.id("site_pages") },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const page = await ctx.db.get(args.pageId);
    if (!page) fail("not_found", "صفحه پیدا نشد.");
    await ctx.db.patch(page._id, {
      draftTitle: page.title,
      draftSummary: page.summary,
      draftBody: page.body,
      draftImageUrls: page.imageUrls,
      draftSortOrder: page.sortOrder,
      draftStatus: page.status,
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    return { ok: true };
  },
});

export const publishPage = mutation({
  args: { pageId: v.id("site_pages") },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const page = await ctx.db.get(args.pageId);
    if (!page) fail("not_found", "صفحه پیدا نشد.");
    const snapshot = JSON.stringify({
      title: page.draftTitle,
      summary: page.draftSummary,
      body: page.draftBody,
      imageUrls: page.draftImageUrls,
      sortOrder: page.draftSortOrder,
      status: page.draftStatus,
    });
    const now = Date.now();
    await ctx.db.patch(page._id, {
      title: page.draftTitle,
      summary: page.draftSummary,
      body: page.draftBody,
      imageUrls: page.draftImageUrls,
      sortOrder: page.draftSortOrder,
      status: page.draftStatus,
      publishedAt: now,
      updatedAt: now,
      updatedBy: session.user._id,
    });
    await ctx.db.insert("content_versions", {
      entityType: "site_page",
      entityKey: page.slug,
      label: `انتشار صفحه «${page.draftTitle}»`,
      snapshot,
      actorId: session.user._id,
      createdAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.page_published",
      entityType: "site_page",
      entityId: page._id,
      summary: `صفحه «${page.draftTitle}» منتشر شد.`,
    });
    return { ok: true };
  },
});

export const restorePageVersion = mutation({
  args: { pageId: v.id("site_pages"), versionId: v.id("content_versions") },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const page = await ctx.db.get(args.pageId);
    const version = await ctx.db.get(args.versionId);
    if (!page) fail("not_found", "صفحه پیدا نشد.");
    if (!version || version.entityType !== "site_page" || version.entityKey !== page.slug) {
      fail("not_found", "نسخه صفحه پیدا نشد.");
    }
    let snapshot: Record<string, unknown>;
    try {
      snapshot = JSON.parse(version.snapshot) as Record<string, unknown>;
    } catch {
      fail("validation", "نسخه صفحه قابل خواندن نیست.");
    }
    await ctx.db.patch(page._id, {
      draftTitle:
        typeof snapshot.title === "string" ? snapshot.title : page.draftTitle,
      draftSummary:
        typeof snapshot.summary === "string" ? snapshot.summary : page.draftSummary,
      draftBody:
        typeof snapshot.body === "string" ? snapshot.body : page.draftBody,
      draftImageUrls: Array.isArray(snapshot.imageUrls)
        ? snapshot.imageUrls.filter((value): value is string => typeof value === "string")
        : page.draftImageUrls,
      draftSortOrder:
        typeof snapshot.sortOrder === "number"
          ? snapshot.sortOrder
          : page.draftSortOrder,
      draftStatus:
        snapshot.status === "published" || snapshot.status === "hidden"
          ? snapshot.status
          : page.draftStatus,
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.page_version_restored_to_draft",
      entityType: "site_page",
      entityId: page._id,
      summary: `نسخه قبلی صفحه «${page.slug}» در پیش‌نویس بازیابی شد.`,
    });
    return { ok: true };
  },
});

export const saveNavigationItem = mutation({
  args: {
    itemId: v.optional(v.id("navigation_items")),
    label: v.string(),
    href: v.string(),
    location: v.union(
      v.literal("public"),
      v.literal("dashboard"),
      v.literal("footer"),
    ),
    sortOrder: v.number(),
    isActive: v.boolean(),
    isExternal: v.boolean(),
    requiredPlanCode: v.optional(v.string()),
    requiredPermission: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const label = requireText(args.label, "عنوان منو", 2, 80);
    const href = validateHref(args.href);
    const now = Date.now();
    const patch = {
      label,
      href,
      location: args.location,
      sortOrder: Math.max(0, Math.round(args.sortOrder)),
      isActive: args.isActive,
      isExternal: args.isExternal,
      requiredPlanCode: args.requiredPlanCode?.trim() || undefined,
      requiredPermission: args.requiredPermission?.trim() || undefined,
      updatedAt: now,
      updatedBy: session.user._id,
    };
    let itemId = args.itemId;
    if (itemId) {
      const existing = await ctx.db.get(itemId);
      if (!existing) fail("not_found", "آیتم منو پیدا نشد.");
      await ctx.db.patch(itemId, patch);
    } else {
      itemId = await ctx.db.insert("navigation_items", patch);
    }
    await ctx.db.insert("content_versions", {
      entityType: "navigation",
      entityKey: "default",
      label: `ذخیره منو «${label}»`,
      snapshot: JSON.stringify(patch),
      actorId: session.user._id,
      createdAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.navigation_saved",
      entityType: "navigation_item",
      entityId: itemId,
      summary: `آیتم منو «${label}» ذخیره شد.`,
    });
    return { itemId };
  },
});

export const deleteNavigationItem = mutation({
  args: { itemId: v.id("navigation_items") },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) fail("not_found", "آیتم منو پیدا نشد.");
    await ctx.db.delete(args.itemId);
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.navigation_deleted",
      entityType: "navigation_item",
      entityId: args.itemId,
      summary: `آیتم منو «${item.label}» حذف شد.`,
    });
    return { ok: true };
  },
});

export const saveFeatureFlag = mutation({
  args: {
    featureId: v.id("feature_flags"),
    isEnabled: v.boolean(),
    allowedPlans: v.array(v.string()),
    allowedRoles: v.array(v.string()),
    dailyLimit: v.number(),
    monthlyLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const feature = await ctx.db.get(args.featureId);
    if (!feature) fail("not_found", "قابلیت پیدا نشد.");
    const allowedPlans = [...new Set(args.allowedPlans)]
      .filter((code): code is (typeof ALLOWED_PLAN_CODES)[number] =>
        (ALLOWED_PLAN_CODES as readonly string[]).includes(code),
      )
      .slice(0, 4);
    const allowedRoles = [...new Set(args.allowedRoles)]
      .filter((role): role is (typeof ALLOWED_FEATURE_ROLES)[number] =>
        (ALLOWED_FEATURE_ROLES as readonly string[]).includes(role),
      )
      .slice(0, 3);
    const now = Date.now();
    await ctx.db.patch(feature._id, {
      isEnabled: args.isEnabled,
      allowedPlans,
      allowedRoles,
      dailyLimit: Math.max(0, Math.round(args.dailyLimit)),
      monthlyLimit: Math.max(0, Math.round(args.monthlyLimit)),
      updatedAt: now,
      updatedBy: session.user._id,
    });
    await ctx.db.insert("content_versions", {
      entityType: "feature",
      entityKey: feature.key,
      label: `به‌روزرسانی قابلیت «${feature.label}»`,
      snapshot: JSON.stringify({
        isEnabled: args.isEnabled,
        allowedPlans,
        allowedRoles,
        dailyLimit: Math.max(0, Math.round(args.dailyLimit)),
        monthlyLimit: Math.max(0, Math.round(args.monthlyLimit)),
      }),
      actorId: session.user._id,
      createdAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "site.feature_updated",
      entityType: "feature_flag",
      entityId: feature._id,
      summary: `سیاست قابلیت «${feature.label}» به‌روزرسانی شد.`,
      metadata: JSON.stringify({
        isEnabled: args.isEnabled,
        allowedPlans,
        allowedRoles,
        dailyLimit: args.dailyLimit,
        monthlyLimit: args.monthlyLimit,
      }),
    });
    return { ok: true };
  },
});

export const saveFeaturePlanLimit = mutation({
  args: {
    featureKey: v.string(),
    planCode: v.string(),
    isAllowed: v.boolean(),
    dailyLimit: v.number(),
    monthlyLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    if (!(ALLOWED_PLAN_CODES as readonly string[]).includes(args.planCode)) {
      fail("validation", "کد پلن معتبر نیست.");
    }
    const feature = await ctx.db
      .query("feature_flags")
      .withIndex("by_key", (q) => q.eq("key", args.featureKey))
      .first();
    if (!feature) fail("not_found", "قابلیت پیدا نشد.");
    const existing = await ctx.db
      .query("feature_plan_limits")
      .withIndex("by_feature_plan", (q) =>
        q.eq("featureKey", args.featureKey).eq("planCode", args.planCode),
      )
      .first();
    const patch = {
      isAllowed: args.isAllowed,
      dailyLimit: Math.max(0, Math.round(args.dailyLimit)),
      monthlyLimit: Math.max(0, Math.round(args.monthlyLimit)),
      updatedAt: Date.now(),
      updatedBy: session.user._id,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("feature_plan_limits", {
        featureKey: args.featureKey,
        planCode: args.planCode,
        ...patch,
      });
    }
    return { ok: true };
  },
});

export const history = query({
  args: {
    entityType: v.union(
      v.literal("site_settings"),
      v.literal("site_page"),
      v.literal("navigation"),
      v.literal("feature"),
    ),
    entityKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePlatformOwner(ctx);
    const rows = await ctx.db
      .query("content_versions")
      .withIndex("by_entity_created", (q) =>
        q.eq("entityType", args.entityType),
      )
      .order("desc")
      .take(50);
    return rows
      .filter((row) => !args.entityKey || row.entityKey === args.entityKey)
      .map((row) => ({
        id: row._id,
        entityKey: row.entityKey,
        label: row.label,
        createdAt: row.createdAt,
      }));
  },
});

