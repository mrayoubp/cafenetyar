import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireAdminPermission } from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { chunkKnowledge, normalizeFa } from "./lib/knowledge";
import { PLATFORM_SETTINGS_KEY, logAudit } from "./lib/platform";
import { fail, requireText } from "./lib/validation";
import { isWebsiteTone, normalizeOptionalWebsiteUrl } from "./lib/websites";
import {
  agentFeedbackRatingValidator,
  knowledgeStatusValidator,
} from "./schema";

type AdminCtx = MutationCtx;

const ALLOWED_FILE_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv"]);
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

function requireSiteAdmin(ctx: Parameters<typeof requireAdminPermission>[0]) {
  return requireAdminPermission(ctx, ADMIN_PERMISSIONS.AI_MANAGE);
}

export const assertAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    return true;
  },
});

function optionalText(value: string | undefined, label: string, max: number) {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  if (text.length > max) {
    fail("validation", `${label} نباید بیشتر از ${max} نویسه باشد.`);
  }
  return text;
}

function cleanTags(tags: string[]) {
  const unique = new Set<string>();
  for (const tag of tags) {
    const clean = tag.trim().replace(/\s+/g, " ");
    if (!clean) continue;
    if (clean.length > 40) {
      fail("validation", "هر برچسب نباید بیشتر از ۴۰ نویسه باشد.");
    }
    unique.add(clean);
  }
  if (unique.size > 12) {
    fail("validation", "حداکثر ۱۲ برچسب برای هر سند مجاز است.");
  }
  return [...unique];
}

async function categoryOrFail(
  ctx: AdminCtx,
  id: Id<"knowledge_categories">,
) {
  const category = await ctx.db.get(id);
  if (!category) fail("validation", "دسته‌بندی دانش پیدا نشد.");
  return category;
}

async function sourceOrFail(ctx: AdminCtx, id: Id<"price_sources"> | undefined) {
  if (!id) return null;
  const source = await ctx.db.get(id);
  if (!source) fail("validation", "منبع رسمی پیدا نشد.");
  return source;
}

async function rebuildChunks(
  ctx: AdminCtx,
  documentId: Id<"knowledge_documents">,
  categoryId: Id<"knowledge_categories">,
  content: string,
) {
  const old = await ctx.db
    .query("knowledge_chunks")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();
  for (const chunk of old) await ctx.db.delete(chunk._id);
  const chunks = chunkKnowledge(content);
  const now = Date.now();
  for (const [index, chunk] of chunks.entries()) {
    await ctx.db.insert("knowledge_chunks", {
      documentId,
      categoryId,
      chunkIndex: index,
      content: chunk,
      createdAt: now,
    });
  }
  return chunks.length;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const documents = await ctx.db.query("knowledge_documents").collect();
    const categories = await ctx.db.query("knowledge_categories").collect();
    const chunks = await ctx.db.query("knowledge_chunks").take(5000);
    const conversations = await ctx.db.query("agent_conversations").collect();
    const feedback = await ctx.db.query("agent_feedback").collect();
    return {
      documents: {
        total: documents.length,
        approved: documents.filter((doc) => doc.status === "approved").length,
        draft: documents.filter((doc) => doc.status === "draft").length,
        archived: documents.filter((doc) => doc.status === "archived").length,
      },
      categories: categories.length,
      chunks: chunks.length,
      conversations: conversations.length,
      feedback: {
        total: feedback.length,
        helpful: feedback.filter((row) => row.rating === "helpful").length,
        notHelpful: feedback.filter((row) => row.rating === "not_helpful")
          .length,
      },
    };
  },
});

export const categories = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const categories = await ctx.db
      .query("knowledge_categories")
      .withIndex("by_sort_order")
      .collect();
    const documents = await ctx.db.query("knowledge_documents").collect();
    return categories.map((category) => ({
      id: category._id,
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
      icon: category.icon,
      tone: category.tone,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      documentCount: documents.filter(
        (doc) => doc.categoryId === category._id,
      ).length,
      approvedCount: documents.filter(
        (doc) =>
          doc.categoryId === category._id && doc.status === "approved",
      ).length,
    }));
  },
});

export const documents = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("knowledge_categories")),
    status: v.optional(knowledgeStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const rows = await ctx.db
      .query("knowledge_documents")
      .withIndex("by_created")
      .order("desc")
      .take(300);
    const categories = await ctx.db.query("knowledge_categories").collect();
    const sources = await ctx.db.query("price_sources").collect();
    const chunks = await ctx.db.query("knowledge_chunks").take(5000);
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const sourceById = new Map(sources.map((item) => [item._id, item]));
    const search = args.search
      ? args.search.trim().toLocaleLowerCase("fa").replace(/ي/g, "ی")
      : "";
    return rows
      .filter((doc) => !args.categoryId || doc.categoryId === args.categoryId)
      .filter((doc) => !args.status || doc.status === args.status)
      .filter((doc) => {
        if (!search) return true;
        return `${doc.title} ${doc.summary} ${doc.content} ${doc.tags.join(" ")}`
          .toLocaleLowerCase("fa")
          .replace(/ي/g, "ی")
          .includes(search);
      })
      .map((doc) => ({
        id: doc._id,
        title: doc.title,
        summary: doc.summary,
        categoryId: doc.categoryId,
        categoryName: categoryById.get(doc.categoryId)?.name ?? "بدون دسته",
        categoryTone: categoryById.get(doc.categoryId)?.tone ?? "navy",
        sourceName: doc.sourceName,
        sourceUrl: doc.sourceUrl ?? null,
        fileName: doc.fileName ?? null,
        sourceId: doc.sourceId ?? null,
        sourceRegistryName: doc.sourceId
          ? sourceById.get(doc.sourceId)?.name ?? null
          : null,
        tags: doc.tags,
        status: doc.status,
        chunkCount: chunks.filter((chunk) => chunk.documentId === doc._id)
          .length,
        lastReviewedAt: doc.lastReviewedAt ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));
  },
});

export const document = query({
  args: { documentId: v.id("knowledge_documents") },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) fail("not_found", "سند پیدا نشد.");
    const category = await ctx.db.get(doc.categoryId);
    const source = doc.sourceId ? await ctx.db.get(doc.sourceId) : null;
    const chunks = await ctx.db
      .query("knowledge_chunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    return {
      id: doc._id,
      title: doc.title,
      summary: doc.summary,
      content: doc.content,
      categoryId: doc.categoryId,
      categoryName: category?.name ?? "بدون دسته",
      sourceId: doc.sourceId ?? null,
      sourceName: doc.sourceName,
      sourceUrl: doc.sourceUrl ?? null,
      fileId: doc.fileId ?? null,
      fileName: doc.fileName ?? null,
      fileSize: doc.fileSize ?? null,
      fileMimeType: doc.fileMimeType ?? null,
      fileUrl: doc.fileId ? await ctx.storage.getUrl(doc.fileId) : null,
      sourceRegistryName: source?.name ?? null,
      tags: doc.tags,
      status: doc.status,
      chunkCount: chunks.length,
      lastReviewedAt: doc.lastReviewedAt ?? null,
      reviewedBy: doc.reviewedBy ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },
});

export const feedback = query({
  args: {
    rating: v.optional(agentFeedbackRatingValidator),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const rows = await ctx.db
      .query("agent_feedback")
      .withIndex("by_created")
      .order("desc")
      .take(200);
    const messages = await ctx.db.query("agent_messages").collect();
    const users = await ctx.db.query("users").collect();
    const cafes = await ctx.db.query("internet_cafes").collect();
    const messageById = new Map(messages.map((item) => [item._id, item]));
    const userById = new Map(users.map((item) => [item._id, item]));
    const cafeById = new Map(cafes.map((item) => [item._id, item]));
    return rows
      .filter((row) => !args.rating || row.rating === args.rating)
      .map((row) => ({
        id: row._id,
        rating: row.rating,
        note: row.note ?? null,
        answerExcerpt:
          messageById.get(row.messageId)?.content.slice(0, 240) ?? "پیام حذف‌شده",
        userName: userById.get(row.userId)?.name ?? "کاربر کافی‌نت",
        cafeName: cafeById.get(row.cafeId)?.name ?? "کافی‌نت حذف‌شده",
        createdAt: row.createdAt,
      }));
  },
});

export const frequentQuestions = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const messages = await ctx.db
      .query("agent_messages")
      .withIndex("by_created")
      .order("desc")
      .take(600);
    const cafes = await ctx.db.query("internet_cafes").collect();
    const cafeById = new Map(cafes.map((item) => [item._id, item]));
    const groups = new Map<
      string,
      { question: string; count: number; lastAskedAt: number; cafeNames: Set<string> }
    >();
    for (const message of messages) {
      if (message.role !== "user") continue;
      const normalized = normalizeFa(message.content)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (normalized.length < 8) continue;
      const key = normalized.slice(0, 90);
      const current = groups.get(key) ?? {
        question: message.content.slice(0, 180),
        count: 0,
        lastAskedAt: 0,
        cafeNames: new Set<string>(),
      };
      current.count += 1;
      current.lastAskedAt = Math.max(current.lastAskedAt, message.createdAt);
      const cafe = cafeById.get(message.cafeId);
      if (cafe) current.cafeNames.add(cafe.name);
      groups.set(key, current);
    }
    return [...groups.values()]
      .sort((a, b) => b.count - a.count || b.lastAskedAt - a.lastAskedAt)
      .slice(0, 12)
      .map((group) => ({
        question: group.question,
        count: group.count,
        lastAskedAt: group.lastAskedAt,
        cafeCount: group.cafeNames.size,
      }));
  },
});

export const saveDocument = mutation({
  args: {
    documentId: v.optional(v.id("knowledge_documents")),
    categoryId: v.id("knowledge_categories"),
    title: v.string(),
    summary: v.string(),
    content: v.string(),
    sourceId: v.optional(v.id("price_sources")),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    fileMimeType: v.optional(v.string()),
    tags: v.array(v.string()),
    status: knowledgeStatusValidator,
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    await categoryOrFail(ctx, args.categoryId);
    const source = await sourceOrFail(ctx, args.sourceId);
    const content = args.content.trim();
    if (content.length < 20) {
      fail("validation", "متن سند باید حداقل ۲۰ نویسه باشد.");
    }
    if (content.length > 40_000) {
      fail("validation", "متن سند نباید بیشتر از ۴۰٬۰۰۰ نویسه باشد.");
    }
    let fileMetadata: { size: number; contentType: string | null } | null = null;
    let attachmentName: string | undefined;
    if (args.fileId) {
      fileMetadata = await ctx.storage.getMetadata(args.fileId);
      if (!fileMetadata) fail("validation", "فایل پیوست پیدا نشد؛ دوباره بارگذاری کنید.");
      if (fileMetadata.size > 8 * 1024 * 1024) {
        fail("validation", "حجم فایل راهنما نباید بیشتر از ۸ مگابایت باشد.");
      }
      attachmentName = optionalText(args.fileName, "نام فایل", 180);
      if (!attachmentName) {
        fail("validation", "نام فایل پیوست معتبر نیست.");
      }
      const extension = attachmentName.split(".").pop()?.toLowerCase() ?? "";
      const contentType = fileMetadata.contentType?.split(";")[0].toLowerCase();
      if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
        fail(
          "validation",
          "فقط فایل‌های PDF، Word (docx)، متن، Markdown و CSV مجاز هستند.",
        );
      }
      if (contentType && !ALLOWED_FILE_TYPES.has(contentType)) {
        fail("validation", "نوع فایل پیوست مجاز نیست.");
      }
    }
    const attachmentFields = args.fileId
      ? {
          fileId: args.fileId,
          fileName: attachmentName ?? "پیوست راهنما",
          fileSize: fileMetadata?.size ?? 0,
          fileMimeType:
            fileMetadata?.contentType ??
            optionalText(args.fileMimeType, "نوع فایل", 120),
        }
      : {
          fileId: undefined,
          fileName: undefined,
          fileSize: undefined,
          fileMimeType: undefined,
        };
    const now = Date.now();
    const fields = {
      categoryId: args.categoryId,
      title: requireText(args.title, "عنوان سند", 3, 160),
      summary: requireText(args.summary, "خلاصه سند", 10, 400),
      content,
      sourceId: source?._id,
      sourceName: requireText(args.sourceName, "نام منبع رسمی", 2, 180),
      sourceUrl: normalizeOptionalWebsiteUrl(args.sourceUrl, "لینک منبع"),
      ...attachmentFields,
      tags: cleanTags(args.tags),
      status: args.status,
      updatedBy: session.user._id,
      updatedAt: now,
      ...(args.status === "approved"
        ? { lastReviewedAt: now, reviewedBy: session.user._id }
        : {}),
    };

    let documentId: Id<"knowledge_documents">;
    if (args.documentId) {
      const existing = await ctx.db.get(args.documentId);
      if (!existing) fail("not_found", "سند پیدا نشد.");
      await ctx.db.patch(args.documentId, fields);
      if (existing.fileId && existing.fileId !== args.fileId) {
        await ctx.storage.delete(existing.fileId);
      }
      documentId = args.documentId;
    } else {
      documentId = await ctx.db.insert("knowledge_documents", {
        ...fields,
        createdAt: now,
      });
    }
    const chunkCount = await rebuildChunks(
      ctx,
      documentId,
      args.categoryId,
      content,
    );
    await logAudit(ctx, {
      actorId: session.user._id,
      action: args.documentId ? "knowledge.document_updated" : "knowledge.document_created",
      entityType: "knowledge_document",
      entityId: documentId,
      summary: `${args.documentId ? "ویرایش" : "ایجاد"} سند «${fields.title}» با وضعیت ${args.status}`,
      metadata: JSON.stringify({ chunkCount }),
    });
    return { documentId, chunkCount };
  },
});

export const setDocumentStatus = mutation({
  args: {
    documentId: v.id("knowledge_documents"),
    status: knowledgeStatusValidator,
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) fail("not_found", "سند پیدا نشد.");
    await ctx.db.patch(args.documentId, {
      status: args.status,
      updatedBy: session.user._id,
      updatedAt: Date.now(),
      ...(args.status === "approved"
        ? { lastReviewedAt: Date.now(), reviewedBy: session.user._id }
        : {}),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "knowledge.status_changed",
      entityType: "knowledge_document",
      entityId: args.documentId,
      summary: `وضعیت سند «${doc.title}» به ${args.status} تغییر کرد.`,
    });
    return { ok: true };
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("knowledge_documents") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) fail("not_found", "سند پیدا نشد.");
    // Archived documents are excluded from the agent (which only reads
    // approved docs) while the file and chunks remain recoverable.
    await ctx.db.patch(args.documentId, {
      status: "archived",
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "knowledge.document_archived",
      entityType: "knowledge_document",
      entityId: args.documentId,
      summary: `سند «${doc.title}» بایگانی شد.`,
    });
    return { ok: true };
  },
});

export const agentPerformance = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const runs = await ctx.db
      .query("agent_runs")
      .withIndex("by_created")
      .order("desc")
      .take(500);
    const usage = await ctx.db.query("subscription_usage").collect();
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
      .first();
    const aiRequests = usage.reduce((sum, row) => sum + row.aiRequests, 0);
    const aiCostPerRequestToman = settings?.aiCostPerRequestToman ?? 0;
    const total = runs.length;
    const success = runs.filter((row) => row.status === "success").length;
    const fallback = runs.filter((row) => row.status === "fallback").length;
    const errors = runs.filter((row) => row.status === "error").length;
    const avgDurationMs =
      total === 0
        ? 0
        : Math.round(
            runs.reduce((sum, row) => sum + row.durationMs, 0) / total,
          );
    const routeCounts = new Map<string, number>();
    for (const row of runs) {
      routeCounts.set(row.route, (routeCounts.get(row.route) ?? 0) + 1);
    }
    return {
      total,
      success,
      fallback,
      errors,
      avgDurationMs,
      aiRequests,
      aiCostPerRequestToman,
      estimatedCostToman: aiRequests * aiCostPerRequestToman,
      aiEnabled: settings?.aiEnabled ?? true,
      aiModel: settings?.aiModel ?? "openai/gpt-4o-mini",
      routes: [...routeCounts.entries()].map(([route, count]) => ({
        route,
        count,
      })),
      recentErrors: runs
        .filter((row) => row.status !== "success")
        .slice(0, 20)
        .map((row) => ({
          id: row._id,
          route: row.route,
          status: row.status,
          question: row.question,
          errorMessage: row.errorMessage ?? null,
          durationMs: row.durationMs,
          createdAt: row.createdAt,
        })),
    };
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
    if (!isWebsiteTone(args.tone)) {
      fail("validation", "رنگ دسته‌بندی معتبر نیست.");
    }
    const categories = await ctx.db
      .query("knowledge_categories")
      .withIndex("by_sort_order")
      .collect();
    let slug = `knowledge-${Date.now().toString(36)}`;
    let suffix = 1;
    while (
      await ctx.db
        .query("knowledge_categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    ) {
      slug = `knowledge-${Date.now().toString(36)}-${suffix}`;
      suffix += 1;
    }
    const now = Date.now();
    const id = await ctx.db.insert("knowledge_categories", {
      slug,
      name: requireText(args.name, "نام دسته‌بندی", 2, 100),
      description: optionalText(args.description, "توضیح دسته‌بندی", 250),
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
    categoryId: v.id("knowledge_categories"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.string(),
    tone: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    await categoryOrFail(ctx, args.categoryId);
    if (!isWebsiteTone(args.tone)) {
      fail("validation", "رنگ دسته‌بندی معتبر نیست.");
    }
    await ctx.db.patch(args.categoryId, {
      name: requireText(args.name, "نام دسته‌بندی", 2, 100),
      description: optionalText(args.description, "توضیح دسته‌بندی", 250),
      icon: args.icon,
      tone: args.tone,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("knowledge_categories") },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    await categoryOrFail(ctx, args.categoryId);
    const used = await ctx.db
      .query("knowledge_documents")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .first();
    if (used) {
      fail("conflict", "این دسته سند دارد؛ ابتدا اسناد را جابه‌جا کنید.");
    }
    await ctx.db.delete(args.categoryId);
    return { ok: true };
  },
});
