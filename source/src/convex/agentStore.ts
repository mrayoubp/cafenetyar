import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { getSessionForUser } from "./lib/access";
import { fail } from "./lib/validation";
import { PERMISSIONS } from "./permissions";
import {
  agentCalculationValidator,
  agentSourceValidator,
} from "./schema";

export const beginTurn = internalMutation({
  args: {
    userId: v.id("users"),
    message: v.string(),
    conversationId: v.optional(v.id("agent_conversations")),
  },
  handler: async (ctx, args) => {
    const session = await getSessionForUser(ctx, args.userId);
    if (!session || !session.cafe) {
      fail("forbidden", "حساب شما به کافی‌نتی متصل نیست.");
    }
    if (session.cafe.status !== "active") {
      fail("suspended", "حساب این کافی‌نت غیرفعال است.");
    }
    if (!session.permissions.includes(PERMISSIONS.AGENT_USE)) {
      fail("forbidden", "دسترسی به ایجنت هوشمند برای شما فعال نیست.");
    }
    const now = Date.now();
    const recent = await ctx.db
      .query("agent_messages")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(40);
    if (
      recent.filter((row) => row.createdAt > now - 60 * 60 * 1000).length >= 30
    ) {
      fail(
        "rate_limited",
        "تعداد پیام‌های شما در یک ساعت اخیر زیاد بوده است؛ کمی بعد دوباره تلاش کنید.",
      );
    }
    const message = args.message.trim();
    if (message.length < 2) fail("validation", "پیام خیلی کوتاه است.");
    if (message.length > 2000) {
      fail("validation", "پیام نباید بیشتر از ۲۰۰۰ نویسه باشد.");
    }

    let conversationId: Id<"agent_conversations">;
    if (args.conversationId) {
      const existing = await ctx.db.get(args.conversationId);
      if (
        !existing ||
        existing.cafeId !== session.cafe._id ||
        existing.userId !== session.user._id
      ) {
        fail("not_found", "گفت‌وگو پیدا نشد.");
      }
      conversationId = existing._id;
      await ctx.db.patch(existing._id, {
        messageCount: existing.messageCount + 1,
        lastMessageAt: now,
        updatedAt: now,
      });
    } else {
      conversationId = await ctx.db.insert("agent_conversations", {
        cafeId: session.cafe._id,
        userId: session.user._id,
        title: message.replace(/\s+/g, " ").slice(0, 70),
        messageCount: 1,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("agent_messages", {
      conversationId,
      cafeId: session.cafe._id,
      userId: session.user._id,
      role: "user",
      content: message,
      sources: [],
      createdAt: now,
    });
    return {
      conversationId,
      cafeId: session.cafe._id,
      userId: session.user._id,
    };
  },
});

export const recordRun = internalMutation({
  args: {
    userId: v.id("users"),
    cafeId: v.id("internet_cafes"),
    conversationId: v.optional(v.id("agent_conversations")),
    route: v.string(),
    status: v.union(
      v.literal("success"),
      v.literal("fallback"),
      v.literal("error"),
    ),
    model: v.optional(v.string()),
    durationMs: v.number(),
    hasSources: v.boolean(),
    question: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agent_runs", {
      ...args,
      question: args.question.slice(0, 500),
      errorMessage: args.errorMessage?.slice(0, 700),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const completeTurn = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("agent_conversations"),
    content: v.string(),
    sources: v.array(agentSourceValidator),
    calculation: v.optional(agentCalculationValidator),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== args.userId) {
      fail("not_found", "گفت‌وگو پیدا نشد.");
    }
    const now = Date.now();
    const messageId = await ctx.db.insert("agent_messages", {
      conversationId: args.conversationId,
      cafeId: conversation.cafeId,
      userId: args.userId,
      role: "assistant",
      content: args.content,
      sources: args.sources,
      calculation: args.calculation,
      model: args.model,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, {
      messageCount: conversation.messageCount + 1,
      lastMessageAt: now,
      updatedAt: now,
    });
    return { messageId };
  },
});
