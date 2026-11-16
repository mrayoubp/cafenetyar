import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertCafeActive, requirePermission } from "./lib/access";
import { assertCmsFeature } from "./lib/siteFeatures";
import { fail, requireText } from "./lib/validation";
import {
  normalizeOptionalWebsiteUrl,
  normalizeWebsiteUrl,
} from "./lib/websites";
import { PERMISSIONS } from "./permissions";
import { websiteReportReasonValidator } from "./schema";

async function requireSitesUser(ctx: Parameters<typeof requirePermission>[0]) {
  const session = await requirePermission(ctx, PERMISSIONS.SITES_VIEW);
  assertCafeActive(session.cafe);
  await assertCmsFeature(
    ctx,
    session.cafe._id,
    "sites",
    session.isOwner ? "owner" : "employee",
  );
  return session;
}

async function activeWebsite(
  ctx: Parameters<typeof requirePermission>[0],
  websiteId: Id<"websites">,
) {
  const website = await ctx.db.get(websiteId);
  if (!website || !website.isActive) {
    fail("not_found", "این سامانه در بانک سایت‌ها فعال نیست.");
  }
  const category = await ctx.db.get(website.categoryId);
  if (!category || !category.isActive) {
    fail("not_found", "دسته‌بندی این سامانه غیرفعال است.");
  }
  return { website, category };
}

function websiteCard(
  website: Doc<"websites">,
  category: Doc<"website_categories"> | null,
  favoriteOrder: number | null,
  lastVisitedAt: number | null,
) {
  return {
    id: website._id,
    name: website.name,
    description: website.description,
    url: website.url,
    logoUrl: website.logoUrl ?? null,
    sourceName: website.sourceName,
    sourceUrl: website.sourceUrl ?? null,
    verificationStatus: website.verificationStatus,
    lastCheckedAt: website.lastCheckedAt ?? null,
    lastCheckStatus: website.lastCheckStatus,
    visitCount: website.visitCount,
    isFeatured: website.isFeatured,
    isActive: website.isActive,
    sortOrder: website.sortOrder,
    updatedAt: website.updatedAt,
    createdAt: website.createdAt,
    isFavorite: favoriteOrder !== null,
    favoriteOrder,
    lastVisitedAt,
    category: {
      id: website.categoryId,
      name: category?.name ?? "بدون دسته",
      icon: category?.icon ?? "grid",
      tone: category?.tone ?? "navy",
    },
  };
}

export const catalog = query({
  args: {},
  handler: async (ctx) => {
    const session = await requireSitesUser(ctx);
    const categories = await ctx.db
      .query("website_categories")
      .withIndex("by_sort_order")
      .collect();
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const activeCategories = categories.filter((item) => item.isActive);

    const allWebsites = await ctx.db
      .query("websites")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .order("asc")
      .take(500);

    const visible = allWebsites.filter(
      (site) => categoryById.get(site.categoryId)?.isActive === true,
    );

    const favoriteRows = await ctx.db
      .query("user_favorites")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .collect();
    const favoriteById = new Map(
      favoriteRows.map((row) => [row.websiteId, row.sortOrder]),
    );

    const visitRows = await ctx.db
      .query("website_visits")
      .withIndex("by_user_visited", (q) => q.eq("userId", session.user._id))
      .collect();
    const visitById = new Map(
      visitRows.map((row) => [row.websiteId, row.lastVisitedAt]),
    );

    const suggestions = await ctx.db
      .query("website_suggestions")
      .withIndex("by_user_created", (q) => q.eq("userId", session.user._id))
      .order("desc")
      .take(10);

    const items = visible.map((site) =>
      websiteCard(
        site,
        categoryById.get(site.categoryId) ?? null,
        favoriteById.get(site._id) ?? null,
        visitById.get(site._id) ?? null,
      ),
    );

    return {
      items,
      categories: activeCategories.map((category) => ({
        id: category._id,
        slug: category.slug,
        name: category.name,
        description: category.description ?? null,
        icon: category.icon,
        tone: category.tone,
        count: visible.filter((site) => site.categoryId === category._id)
          .length,
      })),
      mySuggestions: suggestions.map((suggestion) => ({
        id: suggestion._id,
        name: suggestion.name,
        url: suggestion.url,
        description: suggestion.description,
        status: suggestion.status,
        adminNote: suggestion.adminNote ?? null,
        createdAt: suggestion.createdAt,
      })),
      stats: {
        total: visible.length,
        favorites: favoriteRows.filter((row) =>
          visible.some((site) => site._id === row.websiteId),
        ).length,
        recent: visitRows.filter((row) =>
          visible.some((site) => site._id === row.websiteId),
        ).length,
        featured: visible.filter((site) => site.isFeatured).length,
        needsReview: visible.filter(
          (site) => site.verificationStatus === "needs_review",
        ).length,
      },
      serverNow: Date.now(),
    };
  },
});

export const toggleFavorite = mutation({
  args: { websiteId: v.id("websites") },
  handler: async (ctx, args) => {
    const session = await requireSitesUser(ctx);
    const existing = await ctx.db
      .query("user_favorites")
      .withIndex("by_user_website", (q) =>
        q.eq("userId", session.user._id).eq("websiteId", args.websiteId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { isFavorite: false };
    }

    await activeWebsite(ctx, args.websiteId);
    const favorites = await ctx.db
      .query("user_favorites")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .collect();
    if (favorites.length >= 60) {
      fail("validation", "حداکثر ۶۰ سامانه را می‌توانید در علاقه‌مندی‌ها نگه دارید.");
    }
    const maxOrder = favorites.reduce(
      (max, row) => Math.max(max, row.sortOrder),
      -1,
    );
    await ctx.db.insert("user_favorites", {
      userId: session.user._id,
      websiteId: args.websiteId,
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
    });
    return { isFavorite: true };
  },
});

export const moveFavorite = mutation({
  args: {
    websiteId: v.id("websites"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const session = await requireSitesUser(ctx);
    const favorites = await ctx.db
      .query("user_favorites")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .collect();
    favorites.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
    );
    const index = favorites.findIndex(
      (row) => row.websiteId === args.websiteId,
    );
    if (index < 0) fail("not_found", "این سامانه در علاقه‌مندی‌ها نیست.");
    const target = args.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= favorites.length) return { moved: false };
    const current = favorites[index];
    const other = favorites[target];
    await ctx.db.patch(current._id, { sortOrder: target });
    await ctx.db.patch(other._id, { sortOrder: index });
    return { moved: true };
  },
});

export const recordVisit = mutation({
  args: { websiteId: v.id("websites") },
  handler: async (ctx, args) => {
    const session = await requireSitesUser(ctx);
    const { website } = await activeWebsite(ctx, args.websiteId);
    const now = Date.now();
    const existing = await ctx.db
      .query("website_visits")
      .withIndex("by_user_website", (q) =>
        q.eq("userId", session.user._id).eq("websiteId", args.websiteId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastVisitedAt: now,
        visitCount: existing.visitCount + 1,
      });
    } else {
      await ctx.db.insert("website_visits", {
        userId: session.user._id,
        websiteId: args.websiteId,
        lastVisitedAt: now,
        visitCount: 1,
      });
    }
    await ctx.db.patch(website._id, {
      visitCount: website.visitCount + 1,
    });
    return { ok: true };
  },
});

export const submitSuggestion = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    url: v.string(),
    categoryId: v.id("website_categories"),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSitesUser(ctx);
    const name = requireText(args.name, "نام سامانه", 3, 120);
    const description = requireText(args.description, "توضیح کوتاه", 10, 300);
    const url = normalizeWebsiteUrl(args.url);
    const category = await ctx.db.get(args.categoryId);
    if (!category || !category.isActive) {
      fail("validation", "دسته‌بندی انتخاب‌شده معتبر نیست.");
    }
    const sourceName = requireText(args.sourceName, "نام منبع رسمی", 2, 140);
    const sourceUrl = normalizeOptionalWebsiteUrl(
      args.sourceUrl,
      "لینک منبع رسمی",
    );

    const existingWebsite = await ctx.db
      .query("websites")
      .withIndex("by_url", (q) => q.eq("url", url))
      .first();
    if (existingWebsite) {
      fail("conflict", "این سامانه از قبل در بانک سایت‌ها ثبت شده است.");
    }
    const similar = await ctx.db
      .query("website_suggestions")
      .withIndex("by_url", (q) => q.eq("url", url))
      .collect();
    if (similar.some((row) => row.status === "pending")) {
      fail("conflict", "این سامانه قبلاً پیشنهاد شده و در انتظار بررسی است.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("website_suggestions", {
      userId: session.user._id,
      name,
      description,
      url,
      categoryId: args.categoryId,
      sourceName,
      sourceUrl,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { suggestionId: id };
  },
});

export const reportBroken = mutation({
  args: {
    websiteId: v.id("websites"),
    reason: websiteReportReasonValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSitesUser(ctx);
    const { website } = await activeWebsite(ctx, args.websiteId);
    const note = args.note?.trim()
      ? requireText(args.note, "توضیح گزارش", 3, 500)
      : undefined;
    const existing = await ctx.db
      .query("website_reports")
      .withIndex("by_user_website", (q) =>
        q.eq("userId", session.user._id).eq("websiteId", args.websiteId),
      )
      .collect();
    if (existing.some((row) => row.status === "open")) {
      fail("conflict", "گزارش باز شما برای این سامانه قبلاً ثبت شده است.");
    }
    await ctx.db.insert("website_reports", {
      websiteId: website._id,
      userId: session.user._id,
      reason: args.reason,
      note,
      status: "open",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Compact directory used by the dashboard's quick-access card. */
export const highlights = query({
  args: {},
  handler: async (ctx) => {
    const session = await requireSitesUser(ctx);
    const categories = await ctx.db
      .query("website_categories")
      .withIndex("by_sort_order")
      .collect();
    const activeCategoryIds = new Set(
      categories.filter((item) => item.isActive).map((item) => item._id),
    );
    const sites = await ctx.db
      .query("websites")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .order("asc")
      .take(200);
    const visible = sites.filter((site) =>
      activeCategoryIds.has(site.categoryId),
    );
    const popular = [...visible]
      .sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          b.visitCount - a.visitCount ||
          a.sortOrder - b.sortOrder,
      )
      .slice(0, 4);
    const favorites = await ctx.db
      .query("user_favorites")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .collect();
    const favoriteIds = new Set(favorites.map((row) => row.websiteId));
    return {
      items: popular.map((site) =>
        websiteCard(
          site,
          categories.find((category) => category._id === site.categoryId) ??
            null,
          favoriteIds.has(site._id) ? 0 : null,
          null,
        ),
      ),
      favoriteCount: favoriteIds.size,
      total: visible.length,
    };
  },
});
