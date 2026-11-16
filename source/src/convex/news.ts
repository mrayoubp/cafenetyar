import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertCafeActive, requirePermission } from "./lib/access";
import { assertCmsFeature } from "./lib/siteFeatures";
import { fail } from "./lib/validation";
import { PERMISSIONS } from "./permissions";

const MAX_FEED = 80;

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک");
}

function card(
  item: Doc<"news">,
  category: Doc<"news_categories"> | null,
  saved: boolean,
  read: boolean,
) {
  return {
    id: item._id,
    title: item.title,
    summary: item.summary,
    imageUrl: item.imageUrl ?? null,
    category: {
      id: item.categoryId,
      name: category?.name ?? "بدون دسته",
      slug: category?.slug ?? "uncategorized",
      tone: category?.tone ?? "navy",
    },
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl ?? null,
    publishedAt: item.publishedAt,
    isUrgent: item.isUrgent,
    isPinned: item.isPinned,
    isDemo: item.isDemo,
    saved,
    read,
  };
}

async function loadUserSets(
  ctx: Parameters<typeof requirePermission>[0],
  userId: Id<"users">,
) {
  const savedRows = await ctx.db
    .query("saved_news")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const readRows = await ctx.db
    .query("news_reads")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return {
    savedIds: new Set(savedRows.map((row) => row.newsId)),
    readIds: new Set(readRows.map((row) => row.newsId)),
  };
}

export const feed = query({
  args: {
    categoryId: v.optional(v.id("news_categories")),
    search: v.optional(v.string()),
    sort: v.optional(v.union(v.literal("newest"), v.literal("oldest"))),
    savedOnly: v.optional(v.boolean()),
    unreadOnly: v.optional(v.boolean()),
    preferredOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await requirePermission(ctx, PERMISSIONS.NEWS_VIEW);
    await assertCmsFeature(
      ctx,
      session.cafe._id,
      "news",
      session.isOwner ? "owner" : "employee",
    );
    assertCafeActive(session.cafe);

    const categories = await ctx.db
      .query("news_categories")
      .withIndex("by_sort_order")
      .collect();
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const { savedIds, readIds } = await loadUserSets(ctx, session.user._id);

    const preference = await ctx.db
      .query("news_preferences")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .first();

    const all = await ctx.db
      .query("news")
      .withIndex("by_status_published", (q) => q.eq("status", "published"))
      .order("desc")
      .take(300);

    const search = args.search ? normalizeSearch(args.search) : "";
    const preferredIds = new Set(preference?.categoryIds ?? []);
    const now = Date.now();
    const filtered = all.filter((item) => {
      if (item.publishedAt > now) return false;
      if (args.categoryId && item.categoryId !== args.categoryId) return false;
      if (args.savedOnly && !savedIds.has(item._id)) return false;
      if (args.unreadOnly && readIds.has(item._id)) return false;
      if (args.preferredOnly && !preferredIds.has(item.categoryId)) {
        return false;
      }
      if (search) {
        const haystack = normalizeSearch(
          `${item.title} ${item.summary} ${item.body} ${item.sourceName}`,
        );
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    const direction = args.sort === "oldest" ? 1 : -1;
    filtered.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (a.publishedAt - b.publishedAt) * direction;
    });

    const items = filtered.slice(0, MAX_FEED).map((item) =>
      card(
        item,
        categoryById.get(item.categoryId) ?? null,
        savedIds.has(item._id),
        readIds.has(item._id),
      ),
    );

    const visibleAll = all.filter((item) => item.publishedAt <= now);
    const urgent = visibleAll
      .filter((item) => item.isUrgent)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.publishedAt - a.publishedAt;
      })
      .slice(0, 5)
      .map((item) =>
        card(
          item,
          categoryById.get(item.categoryId) ?? null,
          savedIds.has(item._id),
          readIds.has(item._id),
        ),
      );

    const sources = await ctx.db.query("news_sources").collect();
    const visibleSources = sources
      .filter((source) => !source.isDemo && source.isActive)
      .map((source) => ({
        id: source._id,
        name: source.name,
        kind: source.kind,
        lastFetchedAt: source.lastFetchedAt ?? null,
      }));

    const publishedIds = new Set(visibleAll.map((item) => item._id));
    const unreadCount = [...publishedIds].filter(
      (id) => !readIds.has(id),
    ).length;

    return {
      items,
      urgent,
      categories: categories
        .filter((item) => item.isActive)
        .map((item) => ({
          id: item._id,
          name: item.name,
          slug: item.slug,
          tone: item.tone,
          newsCount: visibleAll.filter(
            (news) => news.categoryId === item._id,
          ).length,
        })),
      preferences: {
        categoryIds: (preference?.categoryIds ?? []).filter(
          (id) => categoryById.get(id)?.isActive === true,
        ),
        updatedAt: preference?.updatedAt ?? null,
      },
      savedCount: savedIds.size,
      unreadCount,
      totalCount: visibleAll.length,
      hasDemo: visibleAll.some((item) => item.isDemo),
      sources: visibleSources,
      serverNow: Date.now(),
    };
  },
});

export const get = query({
  args: { newsId: v.string() },
  handler: async (ctx, args) => {
    const session = await requirePermission(ctx, PERMISSIONS.NEWS_VIEW);
    assertCafeActive(session.cafe);
    const newsId = ctx.db.normalizeId("news", args.newsId);
    if (!newsId) return null;

    const item = await ctx.db.get(newsId);
    if (!item || item.status !== "published" || item.publishedAt > Date.now()) {
      return null;
    }
    const category = await ctx.db.get(item.categoryId);
    const saved = await ctx.db
      .query("saved_news")
      .withIndex("by_user_news", (q) =>
        q.eq("userId", session.user._id).eq("newsId", newsId),
      )
      .first();
    const read = await ctx.db
      .query("news_reads")
      .withIndex("by_user_news", (q) =>
        q.eq("userId", session.user._id).eq("newsId", newsId),
      )
      .first();

    return {
      ...card(item, category, saved !== null, read !== null),
      body: item.body,
    };
  },
});

/** Compact feed used by the dashboard's announcement card. */
export const highlights = query({
  args: {},
  handler: async (ctx) => {
    const session = await requirePermission(ctx, PERMISSIONS.NEWS_VIEW);
    assertCafeActive(session.cafe);
    const categories = await ctx.db
      .query("news_categories")
      .withIndex("by_sort_order")
      .collect();
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const published = await ctx.db
      .query("news")
      .withIndex("by_status_published", (q) => q.eq("status", "published"))
      .order("desc")
      .take(40);
    const now = Date.now();
    const visible = published.filter((item) => item.publishedAt <= now);
    const sorted = [...visible].sort((a, b) => {
      const aScore = (a.isUrgent ? 2 : 0) + (a.isPinned ? 1 : 0);
      const bScore = (b.isUrgent ? 2 : 0) + (b.isPinned ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return b.publishedAt - a.publishedAt;
    });
    return {
      items: sorted.slice(0, 4).map((item) =>
        card(item, categoryById.get(item.categoryId) ?? null, false, false),
      ),
      hasDemo: published.some((item) => item.isDemo),
    };
  },
});

export const markRead = mutation({
  args: { newsId: v.id("news") },
  handler: async (ctx, args) => {
    const session = await requirePermission(ctx, PERMISSIONS.NEWS_VIEW);
    assertCafeActive(session.cafe);
    const item = await ctx.db.get(args.newsId);
    if (!item || item.status !== "published" || item.publishedAt > Date.now()) {
      fail("not_found", "این خبر پیدا نشد.");
    }
    const existing = await ctx.db
      .query("news_reads")
      .withIndex("by_user_news", (q) =>
        q.eq("userId", session.user._id).eq("newsId", args.newsId),
      )
      .first();
    if (!existing) {
      await ctx.db.insert("news_reads", {
        userId: session.user._id,
        newsId: args.newsId,
        readAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const toggleSaved = mutation({
  args: { newsId: v.id("news") },
  handler: async (ctx, args) => {
    const session = await requirePermission(ctx, PERMISSIONS.NEWS_VIEW);
    assertCafeActive(session.cafe);
    const item = await ctx.db.get(args.newsId);
    if (!item || item.status !== "published" || item.publishedAt > Date.now()) {
      fail("not_found", "این خبر پیدا نشد.");
    }
    const existing = await ctx.db
      .query("saved_news")
      .withIndex("by_user_news", (q) =>
        q.eq("userId", session.user._id).eq("newsId", args.newsId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("saved_news", {
      userId: session.user._id,
      newsId: args.newsId,
      createdAt: Date.now(),
    });
    return { saved: true };
  },
});

export const setPreferences = mutation({
  args: { categoryIds: v.array(v.id("news_categories")) },
  handler: async (ctx, args) => {
    const session = await requirePermission(ctx, PERMISSIONS.NEWS_VIEW);
    assertCafeActive(session.cafe);
    const unique: Id<"news_categories">[] = [];
    for (const id of args.categoryIds) {
      if (unique.includes(id)) continue;
      const category = await ctx.db.get(id);
      if (!category || !category.isActive) {
        fail("validation", "یکی از دسته‌بندی‌های انتخاب‌شده معتبر نیست.");
      }
      unique.push(id);
    }
    if (unique.length > 12) {
      fail("validation", "حداکثر ۱۲ دسته‌بندی را می‌توانید انتخاب کنید.");
    }
    const existing = await ctx.db
      .query("news_preferences")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        categoryIds: unique,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("news_preferences", {
        userId: session.user._id,
        categoryIds: unique,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
