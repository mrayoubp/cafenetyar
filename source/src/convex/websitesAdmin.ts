import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdminPermission } from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { fail, requireText } from "./lib/validation";
import {
  isWebsiteIcon,
  isWebsiteTone,
  normalizeLogoUrl,
  normalizeOptionalWebsiteUrl,
  normalizeWebsiteUrl,
} from "./lib/websites";
import { ensureWebsiteCatalog } from "./lib/websiteDefaults";
import { logAudit } from "./lib/platform";
import {
  websiteReportStatusValidator,
  websiteSuggestionStatusValidator,
  websiteVerificationValidator,
} from "./schema";

function requireSiteAdmin(ctx: Parameters<typeof requireAdminPermission>[0]) {
  return requireAdminPermission(ctx, ADMIN_PERMISSIONS.CONTENT_MANAGE);
}

type DbCtx = Parameters<typeof requireSiteAdmin>[0];

function optionalText(value: string | undefined, label: string, max: number) {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  if (text.length > max) {
    fail("validation", `${label} نباید بیشتر از ${max} نویسه باشد.`);
  }
  return text;
}

async function categoryForWebsite(
  ctx: DbCtx,
  categoryId: Id<"website_categories">,
) {
  const category = await ctx.db.get(categoryId);
  if (!category) fail("validation", "دسته‌بندی انتخاب‌شده پیدا نشد.");
  return category;
}

async function validateWebsiteInput(
  ctx: DbCtx,
  args: {
    name: string;
    description: string;
    url: string;
    logoUrl?: string;
    categoryId: Id<"website_categories">;
    sourceName: string;
    sourceUrl?: string;
    verificationStatus: "verified" | "needs_review";
    isActive: boolean;
  },
) {
  const name = requireText(args.name, "نام سامانه", 3, 120);
  const description = requireText(args.description, "توضیح کوتاه", 10, 300);
  const url = normalizeWebsiteUrl(args.url);
  await categoryForWebsite(ctx, args.categoryId);
  const sourceName = requireText(args.sourceName, "نام منبع رسمی", 2, 140);
  const sourceUrl = normalizeOptionalWebsiteUrl(
    args.sourceUrl,
    "لینک منبع رسمی",
  );
  const logoUrl = normalizeLogoUrl(args.logoUrl);
  if (args.isActive && args.verificationStatus !== "verified") {
    fail(
      "validation",
      "سامانه نیازمند بررسی را نمی‌توان منتشر کرد؛ ابتدا منبع و آدرس را تأیید کنید.",
    );
  }
  return {
    name,
    description,
    url,
    logoUrl,
    categoryId: args.categoryId,
    sourceName,
    sourceUrl,
    verificationStatus: args.verificationStatus,
    isActive: args.isActive,
  };
}

function websiteAdminRow(
  site: Doc<"websites">,
  category: Doc<"website_categories"> | null,
  reportCount: number,
  favoriteCount: number,
) {
  return {
    id: site._id,
    name: site.name,
    description: site.description,
    url: site.url,
    logoUrl: site.logoUrl ?? null,
    categoryId: site.categoryId,
    categoryName: category?.name ?? "بدون دسته",
    categoryTone: category?.tone ?? "navy",
    sourceName: site.sourceName,
    sourceUrl: site.sourceUrl ?? null,
    verificationStatus: site.verificationStatus,
    isActive: site.isActive,
    isFeatured: site.isFeatured,
    sortOrder: site.sortOrder,
    visitCount: site.visitCount,
    lastCheckedAt: site.lastCheckedAt ?? null,
    lastCheckStatus: site.lastCheckStatus,
    verifiedAt: site.verifiedAt ?? null,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    reportCount,
    favoriteCount,
  };
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const websites = await ctx.db.query("websites").collect();
    const categories = await ctx.db.query("website_categories").collect();
    const suggestions = await ctx.db.query("website_suggestions").collect();
    const reports = await ctx.db.query("website_reports").collect();
    return {
      websites: {
        total: websites.length,
        active: websites.filter((site) => site.isActive).length,
        needsReview: websites.filter(
          (site) => site.verificationStatus === "needs_review",
        ).length,
        featured: websites.filter((site) => site.isFeatured).length,
      },
      categories: {
        total: categories.length,
        active: categories.filter((category) => category.isActive).length,
      },
      suggestions: suggestions.filter((item) => item.status === "pending")
        .length,
      reports: reports.filter((item) => item.status === "open").length,
      visits: websites.reduce((sum, site) => sum + site.visitCount, 0),
      generatedAt: Date.now(),
    };
  },
});

export const listWebsites = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("website_categories")),
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("active"),
        v.literal("inactive"),
        v.literal("needs_review"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const websites = await ctx.db
      .query("websites")
      .withIndex("by_created")
      .order("desc")
      .take(500);
    const categories = await ctx.db.query("website_categories").collect();
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const reports = await ctx.db.query("website_reports").collect();
    const favorites = await ctx.db.query("user_favorites").collect();
    const search = args.search
      ? args.search.trim().toLocaleLowerCase("fa").replace(/ي/g, "ی")
      : "";

    const items = websites
      .filter((site) => {
        if (args.categoryId && site.categoryId !== args.categoryId) {
          return false;
        }
        if (args.status === "active" && !site.isActive) return false;
        if (args.status === "inactive" && site.isActive) return false;
        if (
          args.status === "needs_review" &&
          site.verificationStatus !== "needs_review"
        ) {
          return false;
        }
        if (search) {
          const haystack = `${site.name} ${site.description} ${site.url} ${site.sourceName}`
            .toLocaleLowerCase("fa")
            .replace(/ي/g, "ی");
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .map((site) =>
        websiteAdminRow(
          site,
          categoryById.get(site.categoryId) ?? null,
          reports.filter(
            (report) =>
              report.websiteId === site._id && report.status === "open",
          ).length,
          favorites.filter((favorite) => favorite.websiteId === site._id)
            .length,
        ),
      );

    return { items, total: items.length };
  },
});

export const categories = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const categories = await ctx.db
      .query("website_categories")
      .withIndex("by_sort_order")
      .collect();
    const websites = await ctx.db.query("websites").collect();
    return categories.map((category) => ({
      id: category._id,
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
      icon: category.icon,
      tone: category.tone,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      websiteCount: websites.filter(
        (site) => site.categoryId === category._id,
      ).length,
      activeCount: websites.filter(
        (site) => site.categoryId === category._id && site.isActive,
      ).length,
    }));
  },
});

export const suggestions = query({
  args: {
    status: v.optional(websiteSuggestionStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const rows = await ctx.db
      .query("website_suggestions")
      .withIndex("by_created")
      .order("desc")
      .take(250);
    const categories = await ctx.db.query("website_categories").collect();
    const users = await ctx.db.query("users").collect();
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const userById = new Map(users.map((item) => [item._id, item]));
    return rows
      .filter((row) => !args.status || row.status === args.status)
      .map((row) => {
        const user = userById.get(row.userId);
        return {
          id: row._id,
          name: row.name,
          description: row.description,
          url: row.url,
          categoryId: row.categoryId,
          categoryName:
            categoryById.get(row.categoryId)?.name ?? "بدون دسته",
          sourceName: row.sourceName,
          sourceUrl: row.sourceUrl ?? null,
          status: row.status,
          adminNote: row.adminNote ?? null,
          websiteId: row.websiteId ?? null,
          createdByName: user?.name ?? "کاربر کافی‌نت",
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt ?? null,
        };
      });
  },
});

export const reports = query({
  args: { status: v.optional(websiteReportStatusValidator) },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const rows = await ctx.db
      .query("website_reports")
      .withIndex("by_created")
      .order("desc")
      .take(250);
    const websites = await ctx.db.query("websites").collect();
    const users = await ctx.db.query("users").collect();
    const websiteById = new Map(websites.map((item) => [item._id, item]));
    const userById = new Map(users.map((item) => [item._id, item]));
    return rows
      .filter((row) => !args.status || row.status === args.status)
      .map((row) => {
        const site = websiteById.get(row.websiteId);
        return {
          id: row._id,
          websiteId: row.websiteId,
          websiteName: site?.name ?? "سامانه حذف‌شده",
          websiteUrl: site?.url ?? null,
          reason: row.reason,
          note: row.note ?? null,
          status: row.status,
          createdByName:
            userById.get(row.userId)?.name ?? "کاربر کافی‌نت",
          createdAt: row.createdAt,
          resolvedAt: row.resolvedAt ?? null,
        };
      });
  },
});

export const createWebsite = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    url: v.string(),
    logoUrl: v.optional(v.string()),
    categoryId: v.id("website_categories"),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
    verificationStatus: websiteVerificationValidator,
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const input = await validateWebsiteInput(ctx, args);
    const duplicate = await ctx.db
      .query("websites")
      .withIndex("by_url", (q) => q.eq("url", input.url))
      .first();
    if (duplicate) {
      fail("conflict", "این آدرس قبلاً در بانک سامانه‌ها ثبت شده است.");
    }
    const all = await ctx.db.query("websites").collect();
    const maxOrder = all.reduce((max, site) => Math.max(max, site.sortOrder), -1);
    const sortOrder =
      typeof args.sortOrder === "number" && Number.isFinite(args.sortOrder)
        ? Math.max(0, Math.trunc(args.sortOrder))
        : maxOrder + 1;
    const now = Date.now();
    const id = await ctx.db.insert("websites", {
      ...input,
      isFeatured: args.isFeatured,
      sortOrder,
      visitCount: 0,
      lastCheckStatus: "unchecked",
      createdBy: session.user._id,
      verifiedAt: input.verificationStatus === "verified" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "website.created",
      entityType: "website",
      entityId: id,
      summary: `سامانه «${input.name}» به بانک سامانه‌ها اضافه شد.`,
      metadata: JSON.stringify({ verificationStatus: input.verificationStatus }),
    });
    return { websiteId: id };
  },
});

export const updateWebsite = mutation({
  args: {
    websiteId: v.id("websites"),
    name: v.string(),
    description: v.string(),
    url: v.string(),
    logoUrl: v.optional(v.string()),
    categoryId: v.id("website_categories"),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
    verificationStatus: websiteVerificationValidator,
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const existing = await ctx.db.get(args.websiteId);
    if (!existing) fail("not_found", "سامانه مورد نظر پیدا نشد.");
    const input = await validateWebsiteInput(ctx, args);
    const duplicate = await ctx.db
      .query("websites")
      .withIndex("by_url", (q) => q.eq("url", input.url))
      .first();
    if (duplicate && duplicate._id !== args.websiteId) {
      fail("conflict", "این آدرس برای سامانه دیگری ثبت شده است.");
    }
    const urlChanged = existing.url !== input.url;
    const newlyVerified =
      input.verificationStatus === "verified" &&
      existing.verificationStatus !== "verified";
    const now = Date.now();
    await ctx.db.patch(args.websiteId, {
      ...input,
      isFeatured: args.isFeatured,
      sortOrder: Math.max(0, Math.trunc(args.sortOrder)),
      updatedAt: now,
      ...(urlChanged
        ? {
            lastCheckedAt: undefined,
            lastCheckStatus: "unchecked" as const,
            verifiedAt:
              input.verificationStatus === "verified" ? now : undefined,
          }
        : newlyVerified
          ? { verifiedAt: now }
          : {}),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "website.updated",
      entityType: "website",
      entityId: args.websiteId,
      summary: `سامانه «${existing.name}» ویرایش شد.`,
      metadata: JSON.stringify({ verificationStatus: input.verificationStatus }),
    });
    return { ok: true };
  },
});

export const setWebsiteActive = mutation({
  args: { websiteId: v.id("websites"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const site = await ctx.db.get(args.websiteId);
    if (!site) fail("not_found", "سامانه مورد نظر پیدا نشد.");
    if (args.isActive && site.verificationStatus !== "verified") {
      fail(
        "validation",
        "این سامانه نیازمند بررسی است؛ ابتدا منبع و آدرس را تأیید کنید.",
      );
    }
    await ctx.db.patch(args.websiteId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "website.status_changed",
      entityType: "website",
      entityId: args.websiteId,
      summary: `سامانه «${site.name}» ${args.isActive ? "فعال" : "غیرفعال"} شد.`,
    });
    return { ok: true };
  },
});

export const deleteWebsite = mutation({
  args: { websiteId: v.id("websites") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const site = await ctx.db.get(args.websiteId);
    if (!site) fail("not_found", "سامانه مورد نظر پیدا نشد.");
    // Archive by deactivation to keep favorites, visits, reports and the
    // original verification data available for restore.
    await ctx.db.patch(args.websiteId, {
      isActive: false,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "website.archived",
      entityType: "website",
      entityId: args.websiteId,
      summary: `سامانه «${site.name}» بایگانی و غیرفعال شد.`,
    });
    return { ok: true };
  },
});

export const seedCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSiteAdmin(ctx);
    return await ensureWebsiteCatalog(ctx, {
      actorId: session.user._id,
      onlyIfEmpty: false,
    });
  },
});

export const createCategory = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.string(),
    tone: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const name = requireText(args.name, "نام دسته‌بندی", 2, 80);
    const description = optionalText(
      args.description,
      "توضیح دسته‌بندی",
      200,
    );
    if (!isWebsiteIcon(args.icon)) {
      fail("validation", "آیکون دسته‌بندی معتبر نیست.");
    }
    if (!isWebsiteTone(args.tone)) {
      fail("validation", "رنگ دسته‌بندی معتبر نیست.");
    }
    const categories = await ctx.db
      .query("website_categories")
      .withIndex("by_sort_order")
      .collect();
    let slug = `category-${Date.now().toString(36)}`;
    let suffix = 1;
    while (
      await ctx.db
        .query("website_categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    ) {
      slug = `category-${Date.now().toString(36)}-${suffix}`;
      suffix += 1;
    }
    const now = Date.now();
    const id = await ctx.db.insert("website_categories", {
      slug,
      name,
      description,
      icon: args.icon,
      tone: args.tone,
      sortOrder: categories.length,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return { categoryId: id };
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("website_categories"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.string(),
    tone: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) fail("not_found", "دسته‌بندی پیدا نشد.");
    if (!isWebsiteIcon(args.icon)) {
      fail("validation", "آیکون دسته‌بندی معتبر نیست.");
    }
    if (!isWebsiteTone(args.tone)) {
      fail("validation", "رنگ دسته‌بندی معتبر نیست.");
    }
    await ctx.db.patch(args.categoryId, {
      name: requireText(args.name, "نام دسته‌بندی", 2, 80),
      description: optionalText(args.description, "توضیح دسته‌بندی", 200),
      icon: args.icon,
      tone: args.tone,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("website_categories") },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) fail("not_found", "دسته‌بندی پیدا نشد.");
    const used = await ctx.db
      .query("websites")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .first();
    if (used) {
      fail(
        "conflict",
        "این دسته‌بندی سامانه دارد؛ ابتدا سامانه‌ها را جابه‌جا یا حذف کنید.",
      );
    }
    const pending = await ctx.db
      .query("website_suggestions")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .collect();
    if (pending.some((row) => row.categoryId === args.categoryId)) {
      fail(
        "conflict",
        "برای این دسته‌بندی پیشنهاد در انتظار بررسی وجود دارد.",
      );
    }
    await ctx.db.delete(args.categoryId);
    return { ok: true };
  },
});

export const approveSuggestion = mutation({
  args: {
    suggestionId: v.id("website_suggestions"),
    categoryId: v.optional(v.id("website_categories")),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) fail("not_found", "پیشنهاد پیدا نشد.");
    if (suggestion.status !== "pending") {
      fail("conflict", "این پیشنهاد قبلاً بررسی شده است.");
    }
    const categoryId = args.categoryId ?? suggestion.categoryId;
    await categoryForWebsite(ctx, categoryId);
    const url = normalizeWebsiteUrl(suggestion.url, "آدرس سامانه");
    const sourceUrl = normalizeOptionalWebsiteUrl(
      suggestion.sourceUrl,
      "لینک منبع رسمی",
    );
    const duplicate = await ctx.db
      .query("websites")
      .withIndex("by_url", (q) => q.eq("url", url))
      .first();
    if (duplicate) {
      fail("conflict", "این آدرس قبلاً در بانک سامانه‌ها ثبت شده است.");
    }
    const all = await ctx.db.query("websites").collect();
    const maxOrder = all.reduce((max, site) => Math.max(max, site.sortOrder), -1);
    const now = Date.now();
    const websiteId = await ctx.db.insert("websites", {
      name: suggestion.name,
      description: suggestion.description,
      url,
      categoryId,
      sourceName: suggestion.sourceName,
      sourceUrl,
      verificationStatus: "verified",
      isActive: true,
      isFeatured: false,
      sortOrder: maxOrder + 1,
      visitCount: 0,
      lastCheckStatus: "unchecked",
      createdBy: session.user._id,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.suggestionId, {
      status: "approved",
      categoryId,
      adminNote: optionalText(args.adminNote, "یادداشت مدیر", 500),
      reviewedBy: session.user._id,
      reviewedAt: now,
      websiteId,
      updatedAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "website.suggestion_approved",
      entityType: "website_suggestion",
      entityId: args.suggestionId,
      summary: `پیشنهاد «${suggestion.name}» تأیید و به بانک سامانه‌ها اضافه شد.`,
      metadata: JSON.stringify({ websiteId }),
    });
    return { websiteId };
  },
});

export const rejectSuggestion = mutation({
  args: {
    suggestionId: v.id("website_suggestions"),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) fail("not_found", "پیشنهاد پیدا نشد.");
    if (suggestion.status !== "pending") {
      fail("conflict", "این پیشنهاد قبلاً بررسی شده است.");
    }
    await ctx.db.patch(args.suggestionId, {
      status: "rejected",
      adminNote: optionalText(args.adminNote, "یادداشت مدیر", 500),
      reviewedBy: session.user._id,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "website.suggestion_rejected",
      entityType: "website_suggestion",
      entityId: args.suggestionId,
      summary: `پیشنهاد «${suggestion.name}» رد شد.`,
    });
    return { ok: true };
  },
});

export const resolveReport = mutation({
  args: { reportId: v.id("website_reports") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) fail("not_found", "گزارش پیدا نشد.");
    await ctx.db.patch(args.reportId, {
      status: report.status === "open" ? "resolved" : "open",
      resolvedAt: report.status === "open" ? Date.now() : undefined,
      resolvedBy:
        report.status === "open" ? session.user._id : undefined,
    });
    return { ok: true };
  },
});

/** Used only by the authenticated link-check action. */
export const websiteForCheck = internalQuery({
  args: { websiteId: v.id("websites") },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.websiteId);
    if (!site) fail("not_found", "سامانه مورد نظر پیدا نشد.");
    return { id: site._id, name: site.name, url: site.url };
  },
});

export const recordWebsiteCheck = internalMutation({
  args: {
    websiteId: v.id("websites"),
    status: v.union(v.number(), v.null()),
    ok: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.websiteId, {
      lastCheckedAt: Date.now(),
      lastCheckStatus: args.ok ? "ok" : "error",
      updatedAt: Date.now(),
    });
    return { status: args.status };
  },
});
