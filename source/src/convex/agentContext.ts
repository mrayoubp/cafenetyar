import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { getSessionForUser } from "./lib/access";
import { scoreKnowledgeChunk, tokenize } from "./lib/knowledge";
import { resolveServicePrice } from "./lib/pricing";
import { PERMISSIONS } from "./permissions";
import { fail } from "./lib/validation";

export const context = internalQuery({
  args: {
    userId: v.id("users"),
    cafeId: v.id("internet_cafes"),
    query: v.string(),
    conversationId: v.optional(v.id("agent_conversations")),
  },
  handler: async (ctx, args) => {
    const session = await getSessionForUser(ctx, args.userId);
    if (!session || !session.cafe || session.cafe._id !== args.cafeId) {
      fail("forbidden", "دسترسی به این کافی‌نت مجاز نیست.");
    }
    if (session.cafe.status !== "active") {
      fail("suspended", "حساب این کافی‌نت غیرفعال است.");
    }
    if (!session.permissions.includes(PERMISSIONS.AGENT_USE)) {
      fail("forbidden", "دسترسی به ایجنت هوشمند برای شما فعال نیست.");
    }

    const docs = await ctx.db
      .query("knowledge_documents")
      .withIndex("by_status_updated", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(200);
    const chunks = await ctx.db.query("knowledge_chunks").take(2500);
    const categoryRows = await ctx.db.query("knowledge_categories").collect();
    const categoryById = new Map(categoryRows.map((item) => [item._id, item]));
    const activeKnowledgeCategories = new Set(
      categoryRows.filter((item) => item.isActive).map((item) => item._id),
    );
    const docById = new Map(docs.map((doc) => [doc._id, doc]));
    const scored = chunks
      .map((chunk) => {
        const doc = docById.get(chunk.documentId);
        if (!doc || !activeKnowledgeCategories.has(doc.categoryId)) return null;
        return {
          doc,
          content: chunk.content,
          score: scoreKnowledgeChunk(
            args.query,
            doc.title,
            doc.summary,
            doc.tags,
            chunk.content,
          ),
        };
      })
      .filter(
        (item): item is NonNullable<typeof item> =>
          item !== null && item.score > 0,
      )
      .sort((a, b) => b.score - a.score);
    const selectedDocs: typeof docs = [];
    const selectedChunks: { doc: Doc<"knowledge_documents">; content: string }[] = [];
    for (const item of scored) {
      if (selectedDocs.some((doc) => doc._id === item.doc._id)) continue;
      selectedDocs.push(item.doc);
      selectedChunks.push({ doc: item.doc, content: item.content });
      if (selectedDocs.length >= 4) break;
    }

    const categories = await ctx.db
      .query("service_categories")
      .withIndex("by_sort_order")
      .collect();
    const activeCategoryIds = new Set(
      categories.filter((item) => item.isActive).map((item) => item._id),
    );
    const services = await ctx.db
      .query("services")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .order("asc")
      .take(300);
    const overrides = await ctx.db
      .query("cafe_service_prices")
      .withIndex("by_cafe", (q) => q.eq("cafeId", args.cafeId))
      .collect();
    const overrideByService = new Map(
      overrides.map((row) => [row.serviceId, row]),
    );
    const sources = await ctx.db.query("price_sources").collect();
    const sourceById = new Map(sources.map((source) => [source._id, source]));
    const now = Date.now();
    const canViewRates =
      session.isOwner || session.permissions.includes(PERMISSIONS.RATES_VIEW);
    const serviceRows = (canViewRates ? services : [])
      .filter((service) => activeCategoryIds.has(service.categoryId))
      .map((service) => {
        const override = overrideByService.get(service._id) ?? null;
        const resolution = resolveServicePrice(service, override, now);
        const source =
          resolution.status === "available" && resolution.price.sourceId
            ? sourceById.get(resolution.price.sourceId)
            : undefined;
        return {
          id: service._id,
          name: service.name,
          description: service.description,
          unit: service.unit,
          isAddon: service.isAddon,
          updatedAt: service.updatedAt,
          effective:
            resolution.status === "available"
              ?                {
                  priceToman: resolution.price.priceToman,
                  priceType: resolution.price.priceType,
                  priceMode: resolution.price.priceMode,
                  markupPercent: resolution.price.markupPercent,
                  markupToman: resolution.price.markupToman,
                  sourceName: source?.name ?? null,
                  sourceUrl: source?.url ?? null,
                  validUntil: resolution.price.validUntil,
                  isCafeOverride: resolution.price.isCafeOverride,
                }
              : null,
          effectiveStatus: resolution.status,
        };
      });

    const websites = await ctx.db
      .query("websites")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .take(300);
    const queryTokens = tokenize(args.query);
    const officialLinks = websites
      .map((site) => {
        const haystack = tokenize(`${site.name} ${site.description}`);
        let score = 0;
        for (const token of queryTokens) {
          if (haystack.some((candidate) => candidate === token)) score += 3;
          else if (
            haystack.some(
              (candidate) =>
                candidate.startsWith(token) || token.startsWith(candidate),
            )
          ) {
            score += 1;
          }
        }
        return { site, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ site }) => ({
        name: site.name,
        url: site.url,
        sourceName: site.sourceName,
      }));

    const history = args.conversationId
      ? await ctx.db
          .query("agent_messages")
          .withIndex("by_conversation_created", (q) =>
            q.eq("conversationId", args.conversationId!),
          )
          .order("desc")
          .take(12)
      : [];

    return {
      cafeName: session.cafe.name,
      canViewRates,
      knowledge: selectedChunks.map(({ doc, content }) => ({
        documentId: doc._id,
        title: doc.title,
        summary: doc.summary,
        content,
        categoryName: categoryById.get(doc.categoryId)?.name ?? null,
        sourceName: doc.sourceName,
        sourceUrl: doc.sourceUrl ?? null,
        updatedAt: doc.updatedAt,
        lastReviewedAt: doc.lastReviewedAt ?? null,
      })),
      knowledgeCount: docs.length,
      services: serviceRows,
      officialLinks,
      history: history.reverse().map((row) => ({
        role: row.role,
        content: row.content,
      })),
    };
  },
});
