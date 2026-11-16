import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertCafeActive, requirePermission } from "./lib/access";
import { assertPlanFeature } from "./lib/billing";
import { scoreKnowledgeChunk } from "./lib/knowledge";
import { PERMISSIONS } from "./permissions";

/**
 * User-facing guide search. It only searches approved documents in active
 * categories, so archived or draft material can never leak into answers.
 */
export const search = query({
  args: { search: v.string() },
  handler: async (ctx, args) => {
    const session = await requirePermission(ctx, PERMISSIONS.AGENT_USE);
    assertCafeActive(session.cafe);
    await assertPlanFeature(
      ctx,
      session.cafe._id,
      "agent",
      session.isOwner ? "owner" : "employee",
    );
    const search = args.search.trim().slice(0, 200);
    const categories = await ctx.db
      .query("knowledge_categories")
      .withIndex("by_sort_order")
      .collect();
    const categoryById = new Map(
      categories.filter((row) => row.isActive).map((row) => [row._id, row]),
    );
    const approved = await ctx.db
      .query("knowledge_documents")
      .withIndex("by_status_updated", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(200);
    const documents = approved.filter((row) =>
      categoryById.has(row.categoryId),
    );
    const documentById = new Map(documents.map((row) => [row._id, row]));

    const matches: {
      documentId: typeof documents[number]["_id"];
      score: number;
      snippet: string;
    }[] = [];
    for (const category of categoryById.values()) {
      const chunks = await ctx.db
        .query("knowledge_chunks")
        .withIndex("by_category", (q) => q.eq("categoryId", category._id))
        .take(500);
      for (const chunk of chunks) {
        const document = documentById.get(chunk.documentId);
        if (!document) continue;
        const score = search
          ? scoreKnowledgeChunk(
              search,
              document.title,
              document.summary,
              document.tags,
              chunk.content,
            )
          : document.updatedAt;
        if (score <= 0) continue;
        matches.push({
          documentId: document._id,
          score,
          snippet: chunk.content,
        });
      }
    }
    matches.sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const results = [];
    for (const match of matches) {
      if (seen.has(match.documentId)) continue;
      seen.add(match.documentId);
      const document = documentById.get(match.documentId);
      if (!document) continue;
      const category = categoryById.get(document.categoryId);
      results.push({
        id: document._id,
        title: document.title,
        summary: document.summary,
        snippet: match.snippet.slice(0, 520),
        categoryName: category?.name ?? "راهنما",
        sourceName: document.sourceName,
        sourceUrl: document.sourceUrl ?? null,
        fileUrl: document.fileId
          ? await ctx.storage.getUrl(document.fileId)
          : null,
        reviewedAt: document.lastReviewedAt ?? document.updatedAt,
        updatedAt: document.updatedAt,
      });
      if (results.length >= 12) break;
    }
    return { results, total: results.length };
  },
});
