import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getSessionForUser, requireAdminPermission } from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { ensureNewsDefaults, isNewsTone } from "./lib/newsDefaults";
import { logAudit } from "./lib/platform";
import { fail, requireText } from "./lib/validation";
import { newsSourceKindValidator, newsStatusValidator } from "./schema";

function requireSiteAdmin(ctx: Parameters<typeof requireAdminPermission>[0]) {
  return requireAdminPermission(ctx, ADMIN_PERMISSIONS.CONTENT_MANAGE);
}

function optionalUrl(value: string | undefined, label: string) {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  if (text.length > 800) {
    fail("validation", `${label} بیش از حد طولانی است.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    fail("validation", `${label} معتبر نیست.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail("validation", `${label} باید با http یا https شروع شود.`);
  }
  return parsed.toString();
}

function requireUrl(value: string | undefined, label: string) {
  const url = optionalUrl(value, label);
  if (!url) fail("validation", `${label} الزامی است.`);
  return url;
}

function requireMultiline(
  value: string,
  label: string,
  min: number,
  max: number,
) {
  const text = value.trim();
  if (text.length < min) {
    fail("validation", `${label} باید حداقل ${min} نویسه باشد.`);
  }
  if (text.length > max) {
    fail("validation", `${label} نباید بیشتر از ${max} نویسه باشد.`);
  }
  return text;
}

function cleanTone(value: string) {
  if (!isNewsTone(value)) {
    fail("validation", "رنگ دسته‌بندی معتبر نیست.");
  }
  return value;
}

async function categoryExists(
  ctx: Parameters<typeof requireSiteAdmin>[0],
  id: Id<"news_categories">,
) {
  const category = await ctx.db.get(id);
  if (!category) fail("validation", "دسته‌بندی انتخاب‌شده پیدا نشد.");
  return category;
}

async function validateNewsInput(
  ctx: Parameters<typeof requireSiteAdmin>[0],
  args: {
    title: string;
    summary: string;
    body: string;
    imageUrl?: string;
    categoryId: Id<"news_categories">;
    sourceName: string;
    sourceUrl?: string;
    publishedAt: number;
    status: "draft" | "pending" | "published" | "rejected" | "archived";
  },
  allowMissingSourceUrl = false,
) {
  const title = requireText(args.title, "عنوان خبر", 4, 180);
  const summary = requireText(args.summary, "خلاصه خبر", 10, 500);
  const body = requireMultiline(args.body, "متن کامل خبر", 20, 30000);
  const imageUrl = optionalUrl(args.imageUrl, "نشانی تصویر");
  await categoryExists(ctx, args.categoryId);
  if (!Number.isFinite(args.publishedAt) || args.publishedAt <= 0) {
    fail("validation", "تاریخ انتشار معتبر نیست.");
  }
  const sourceName = requireText(args.sourceName, "نام منبع", 2, 140);
  const sourceUrl = optionalUrl(args.sourceUrl, "لینک منبع اصلی");
  if (args.status === "published" && !sourceUrl && !allowMissingSourceUrl) {
    fail("validation", "برای انتشار خبر، لینک منبع اصلی الزامی است.");
  }
  return {
    title,
    summary,
    body,
    imageUrl,
    sourceName,
    sourceUrl,
  };
}

function adminRow(
  item: Doc<"news">,
  category: Doc<"news_categories"> | null,
  source: Doc<"news_sources"> | null,
) {
  return {
    id: item._id,
    title: item.title,
    summary: item.summary,
    body: item.body,
    imageUrl: item.imageUrl ?? null,
    categoryId: item.categoryId,
    categoryName: category?.name ?? "بدون دسته",
    categoryTone: category?.tone ?? "navy",
    sourceId: item.sourceId ?? null,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl ?? null,
    sourceKind: source?.kind ?? (item.isDemo ? "manual" : null),
    publishedAt: item.publishedAt,
    isUrgent: item.isUrgent,
    isPinned: item.isPinned,
    status: item.status,
    isDemo: item.isDemo,
    externalId: item.externalId ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const news = await ctx.db.query("news").collect();
    const categories = await ctx.db.query("news_categories").collect();
    const sources = await ctx.db.query("news_sources").collect();
    return {
      news: {
        total: news.length,
        published: news.filter((item) => item.status === "published").length,
        pending: news.filter((item) => item.status === "pending").length,
        draft: news.filter((item) => item.status === "draft").length,
        urgent: news.filter(
          (item) => item.status === "published" && item.isUrgent,
        ).length,
        demo: news.filter((item) => item.isDemo).length,
      },
      categories: categories.length,
      sources: {
        total: sources.filter((source) => !source.isDemo).length,
        active: sources.filter(
          (source) => !source.isDemo && source.isActive,
        ).length,
      },
      generatedAt: Date.now(),
    };
  },
});

export const list = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(newsStatusValidator),
    categoryId: v.optional(v.id("news_categories")),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const news = await ctx.db
      .query("news")
      .withIndex("by_created")
      .order("desc")
      .take(500);
    const categories = await ctx.db.query("news_categories").collect();
    const sources = await ctx.db.query("news_sources").collect();
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const sourceById = new Map(sources.map((item) => [item._id, item]));
    const search = args.search
      ? args.search.trim().toLocaleLowerCase("fa").replace(/ي/g, "ی")
      : "";

    const items = news
      .filter((item) => {
        if (args.status && item.status !== args.status) return false;
        if (args.categoryId && item.categoryId !== args.categoryId) {
          return false;
        }
        if (search) {
          const haystack = `${item.title} ${item.summary} ${item.sourceName}`
            .trim()
            .toLocaleLowerCase("fa")
            .replace(/ي/g, "ی");
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .map((item) =>
        adminRow(
          item,
          categoryById.get(item.categoryId) ?? null,
          item.sourceId ? sourceById.get(item.sourceId) ?? null : null,
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
      .query("news_categories")
      .withIndex("by_sort_order")
      .collect();
    const news = await ctx.db.query("news").collect();
    return categories.map((category) => ({
      id: category._id,
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
      tone: category.tone,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      newsCount: news.filter((item) => item.categoryId === category._id).length,
    }));
  },
});

export const sources = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const sources = await ctx.db
      .query("news_sources")
      .withIndex("by_created")
      .order("desc")
      .collect();
    const news = await ctx.db.query("news").collect();
    return sources
      .filter((source) => source.isDemo !== true)
      .map((source) => {
      const items = news.filter((item) => item.sourceId === source._id);
      return {
        id: source._id,
        name: source.name,
        kind: source.kind,
        url: source.url ?? null,
        defaultCategoryId: source.defaultCategoryId ?? null,
        isActive: source.isActive,
        isDemo: source.isDemo === true,
        lastFetchedAt: source.lastFetchedAt ?? null,
        lastError: source.lastError ?? null,
        lastItemCount: source.lastItemCount ?? null,
        pendingCount: items.filter((item) => item.status === "pending").length,
        publishedCount: items.filter((item) => item.status === "published")
          .length,
      };
    });
  },
});

export const createNews = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    body: v.string(),
    imageUrl: v.optional(v.string()),
    categoryId: v.id("news_categories"),
    sourceId: v.optional(v.id("news_sources")),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
    publishedAt: v.number(),
    isUrgent: v.boolean(),
    isPinned: v.boolean(),
    status: newsStatusValidator,
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const input = await validateNewsInput(ctx, args);
    const now = Date.now();
    const id = await ctx.db.insert("news", {
      ...input,
      categoryId: args.categoryId,
      sourceId: args.sourceId,
      publishedAt: args.publishedAt,
      isUrgent: args.isUrgent,
      isPinned: args.isPinned,
      status: args.status,
      isDemo: false,
      createdBy: session.user._id,
      createdAt: now,
      updatedAt: now,
      ...(args.status === "published"
        ? { approvedBy: session.user._id, approvedAt: now }
        : {}),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "news.created",
      entityType: "news",
      entityId: id,
      summary: `خبر «${input.title}» با وضعیت ${args.status} ثبت شد.`,
    });
    return { newsId: id };
  },
});

export const updateNews = mutation({
  args: {
    newsId: v.id("news"),
    title: v.string(),
    summary: v.string(),
    body: v.string(),
    imageUrl: v.optional(v.string()),
    categoryId: v.id("news_categories"),
    sourceId: v.optional(v.id("news_sources")),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
    publishedAt: v.number(),
    isUrgent: v.boolean(),
    isPinned: v.boolean(),
    status: newsStatusValidator,
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const existing = await ctx.db.get(args.newsId);
    if (!existing) fail("not_found", "خبر مورد نظر پیدا نشد.");
    const input = await validateNewsInput(ctx, args, existing.isDemo);
    const now = Date.now();
    const newlyPublished =
      args.status === "published" && existing.status !== "published";
    await ctx.db.patch(args.newsId, {
      ...input,
      categoryId: args.categoryId,
      sourceId: args.sourceId,
      publishedAt: args.publishedAt,
      isUrgent: args.isUrgent,
      isPinned: args.isPinned,
      status: args.status,
      updatedAt: now,
      ...(newlyPublished
        ? { approvedBy: session.user._id, approvedAt: now }
        : {}),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "news.updated",
      entityType: "news",
      entityId: args.newsId,
      summary: `خبر «${existing.title}» ویرایش شد.`,
      metadata: JSON.stringify({ status: args.status, newlyPublished }),
    });
    return { ok: true };
  },
});

export const setNewsStatus = mutation({
  args: { newsId: v.id("news"), status: newsStatusValidator },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const news = await ctx.db.get(args.newsId);
    if (!news) fail("not_found", "خبر مورد نظر پیدا نشد.");
    if (args.status === "published") {
      if (!news.sourceName.trim() || (!news.sourceUrl && !news.isDemo)) {
        fail(
          "validation",
          "پیش از انتشار باید نام منبع و لینک منبع اصلی تکمیل شود.",
        );
      }
      if (!news.publishedAt || news.publishedAt <= 0) {
        fail(
          "validation",
          "پیش از انتشار، تاریخ و ساعت انتشار را در ویرایش خبر ثبت کنید.",
        );
      }
    }
    const now = Date.now();
    await ctx.db.patch(args.newsId, {
      status: args.status,
      updatedAt: now,
      ...(args.status === "published" && news.status !== "published"
        ? { approvedBy: session.user._id, approvedAt: now }
        : {}),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "news.status_changed",
      entityType: "news",
      entityId: args.newsId,
      summary: `وضعیت خبر «${news.title}» به ${args.status} تغییر کرد.`,
    });
    return { ok: true };
  },
});

export const deleteNews = mutation({
  args: { newsId: v.id("news") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const news = await ctx.db.get(args.newsId);
    if (!news) fail("not_found", "خبر مورد نظر پیدا نشد.");
    // Important content is archived rather than physically deleted so it can
    // be reviewed and restored without losing saved/read history.
    await ctx.db.patch(args.newsId, {
      status: "archived",
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "news.archived",
      entityType: "news",
      entityId: args.newsId,
      summary: `خبر «${news.title}» بایگانی شد.`,
    });
    return { ok: true };
  },
});

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSiteAdmin(ctx);
    const result = await ensureNewsDefaults(ctx, {
      actorId: session.user._id,
      seedDemo: true,
    });
    return result;
  },
});

export const deleteDemo = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const demo = await ctx.db.query("news").collect();
    let removed = 0;
    for (const item of demo) {
      if (!item.isDemo) continue;
      const saved = await ctx.db
        .query("saved_news")
        .withIndex("by_news", (q) => q.eq("newsId", item._id))
        .collect();
      const reads = await ctx.db
        .query("news_reads")
        .withIndex("by_news", (q) => q.eq("newsId", item._id))
        .collect();
      for (const row of saved) await ctx.db.delete(row._id);
      for (const row of reads) await ctx.db.delete(row._id);
      await ctx.db.delete(item._id);
      removed += 1;
    }
    return { removed };
  },
});

export const createCategory = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    tone: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const name = requireText(args.name, "نام دسته‌بندی", 2, 60);
    const description = args.description?.trim()
      ? requireText(args.description, "توضیح دسته‌بندی", 3, 200)
      : undefined;
    const tone = cleanTone(args.tone);
    const categories = await ctx.db
      .query("news_categories")
      .withIndex("by_sort_order")
      .collect();
    let slug = `category-${Date.now().toString(36)}`;
    let suffix = 1;
    while (
      await ctx.db
        .query("news_categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    ) {
      slug = `category-${Date.now().toString(36)}-${suffix}`;
      suffix += 1;
    }
    const now = Date.now();
    const id = await ctx.db.insert("news_categories", {
      slug,
      name,
      description,
      tone,
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
    categoryId: v.id("news_categories"),
    name: v.string(),
    description: v.optional(v.string()),
    tone: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) fail("not_found", "دسته‌بندی پیدا نشد.");
    const name = requireText(args.name, "نام دسته‌بندی", 2, 60);
    const description = args.description?.trim()
      ? requireText(args.description, "توضیح دسته‌بندی", 3, 200)
      : undefined;
    await ctx.db.patch(args.categoryId, {
      name,
      description,
      tone: cleanTone(args.tone),
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("news_categories") },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) fail("not_found", "دسته‌بندی پیدا نشد.");
    const news = await ctx.db
      .query("news")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .first();
    if (news) {
      fail(
        "conflict",
        "این دسته‌بندی در خبری استفاده شده است؛ ابتدا خبر را جابه‌جا یا حذف کنید.",
      );
    }
    const sources = await ctx.db.query("news_sources").collect();
    for (const source of sources) {
      if (source.defaultCategoryId === args.categoryId) {
        await ctx.db.patch(source._id, { defaultCategoryId: undefined });
      }
    }
    await ctx.db.delete(args.categoryId);
    return { ok: true };
  },
});

export const createSource = mutation({
  args: {
    name: v.string(),
    kind: newsSourceKindValidator,
    url: v.optional(v.string()),
    defaultCategoryId: v.optional(v.id("news_categories")),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const name = requireText(args.name, "نام منبع", 2, 120);
    let url: string | undefined;
    if (args.kind !== "manual") {
      url = requireUrl(args.url, "نشانی فید");
    }
    if (args.defaultCategoryId) {
      await categoryExists(ctx, args.defaultCategoryId);
    }
    const now = Date.now();
    const id = await ctx.db.insert("news_sources", {
      name,
      kind: args.kind,
      url,
      defaultCategoryId: args.defaultCategoryId,
      isActive: true,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    });
    return { sourceId: id };
  },
});

export const updateSource = mutation({
  args: {
    sourceId: v.id("news_sources"),
    name: v.string(),
    url: v.optional(v.string()),
    defaultCategoryId: v.optional(v.id("news_categories")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const source = await ctx.db.get(args.sourceId);
    if (!source) fail("not_found", "منبع خبر پیدا نشد.");
    if (source.isDemo) {
      fail("forbidden", "منبع نمایشی قابل ویرایش نیست.");
    }
    if (args.defaultCategoryId) {
      await categoryExists(ctx, args.defaultCategoryId);
    }
    await ctx.db.patch(args.sourceId, {
      name: requireText(args.name, "نام منبع", 2, 120),
      url:
        source.kind === "manual"
          ? undefined
          : requireUrl(args.url, "نشانی فید"),
      defaultCategoryId: args.defaultCategoryId,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteSource = mutation({
  args: { sourceId: v.id("news_sources") },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const source = await ctx.db.get(args.sourceId);
    if (!source) fail("not_found", "منبع خبر پیدا نشد.");
    if (source.isDemo) {
      fail("forbidden", "منبع نمایشی قابل حذف نیست.");
    }
    const news = await ctx.db
      .query("news")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .first();
    if (news) {
      fail(
        "conflict",
        "برای این منبع خبر ثبت شده است؛ امکان حذف منبع وجود ندارد.",
      );
    }
    await ctx.db.delete(args.sourceId);
    return { ok: true };
  },
});

/** Used only by the authenticated RSS action. */
export const sourceForIngest = internalQuery({
  args: { sourceId: v.id("news_sources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source || source.isDemo || !source.isActive || !source.url) {
      fail("not_found", "منبع فعال با نشانی معتبر پیدا نشد.");
    }
    if (source.kind === "manual") {
      fail("validation", "این منبع برای دریافت خودکار تنظیم نشده است.");
    }
    return {
      id: source._id,
      name: source.name,
      url: source.url,
      kind: source.kind,
      defaultCategoryId: source.defaultCategoryId ?? null,
    };
  },
});

export const recordFetchError = internalMutation({
  args: { sourceId: v.id("news_sources"), message: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      lastError: args.message.slice(0, 500),
      lastFetchedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const importItems = internalMutation({
  args: {
    sourceId: v.id("news_sources"),
    actorId: v.id("users"),
    items: v.array(
      v.object({
        externalId: v.string(),
        title: v.string(),
        summary: v.string(),
        body: v.string(),
        link: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        publishedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await getSessionForUser(ctx, args.actorId);
    if (
      !actor?.isSiteAdmin ||
      actor.isBlocked ||
      (!actor.isSuperAdmin &&
        !actor.adminPermissions.includes(ADMIN_PERMISSIONS.CONTENT_MANAGE))
    ) {
      fail("forbidden", "نقش مدیریتی این حساب اجازه درج خبر را ندارد.");
    }
    const source = await ctx.db.get(args.sourceId);
    if (!source) fail("not_found", "منبع پیدا نشد.");
    let categoryId = source.defaultCategoryId;
    if (!categoryId) {
      const category = await ctx.db
        .query("news_categories")
        .withIndex("by_sort_order")
        .first();
      categoryId = category?._id;
    }
    if (!categoryId) {
      fail("validation", "ابتدا یک دسته‌بندی برای اخبار بسازید.");
    }

    let imported = 0;
    let skipped = 0;
    const now = Date.now();
    for (const item of args.items.slice(0, 50)) {
      const externalId = item.externalId.trim().slice(0, 900);
      if (!externalId) {
        skipped += 1;
        continue;
      }
      const duplicate = await ctx.db
        .query("news")
        .withIndex("by_source_external", (q) =>
          q.eq("sourceId", args.sourceId).eq("externalId", externalId),
        )
        .first();
      if (duplicate) {
        skipped += 1;
        continue;
      }
      const title = item.title.trim().slice(0, 180);
      if (title.length < 4) {
        skipped += 1;
        continue;
      }
      const body = item.body.trim().slice(0, 30000);
      const summary = item.summary.trim().slice(0, 500);
      const sourceUrl = item.link ? optionalUrl(item.link, "لینک خبر") : undefined;
      await ctx.db.insert("news", {
        title,
        summary: summary || title,
        body: body || summary || title,
        imageUrl: item.imageUrl
          ? optionalUrl(item.imageUrl, "تصویر خبر")
          : undefined,
        categoryId,
        sourceId: args.sourceId,
        sourceName: source.name,
        sourceUrl,
        publishedAt:
          Number.isFinite(item.publishedAt) && item.publishedAt > 0
            ? item.publishedAt
            : 0,
        isUrgent: false,
        isPinned: false,
        status: "pending",
        isDemo: false,
        externalId,
        importedAt: now,
        createdBy: args.actorId,
        createdAt: now,
        updatedAt: now,
      });
      imported += 1;
    }
    await ctx.db.patch(args.sourceId, {
      lastFetchedAt: now,
      lastError: undefined,
      lastItemCount: imported,
      updatedAt: now,
    });
    return { imported, skipped };
  },
});
