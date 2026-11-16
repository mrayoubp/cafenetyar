import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { assertCafeActive, requirePermission } from "./lib/access";
import { assertPlanFeature, getBillingSnapshot } from "./lib/billing";
import {
  AGENT_MODEL,
  buildPricingResult,
  buildSystemPrompt,
  extractQuantity,
  hasPricingIntent,
  matchService,
} from "./lib/agent";
import { tokenize } from "./lib/knowledge";
import { fail, requireText } from "./lib/validation";
import { PERMISSIONS } from "./permissions";
import {
  agentFeedbackRatingValidator,
  type AgentCalculation,
  type AgentSource,
} from "./schema";
import { getVly } from "../lib/vly-integrations";

async function agentUser(ctx: Parameters<typeof requirePermission>[0]) {
  const session = await requirePermission(ctx, PERMISSIONS.AGENT_USE);
  assertCafeActive(session.cafe);
  await assertPlanFeature(
    ctx,
    session.cafe._id,
    "agent",
    session.isOwner ? "owner" : "employee",
  );
  return session;
}



type AgentContext = {
  cafeName: string;
  canViewRates: boolean;
  knowledge: {
    documentId: Id<"knowledge_documents">;
    title: string;
    summary: string;
    content: string;
    categoryName: string | null;
    sourceName: string;
    sourceUrl: string | null;
    updatedAt: number;
    lastReviewedAt: number | null;
  }[];
  knowledgeCount: number;
  services: {
    id: Id<"services">;
    name: string;
    description: string;
    unit: string;
    isAddon: boolean;
    updatedAt: number;
    effective: {
      priceToman: number;
      priceType: "official" | "suggested" | "custom";
      priceMode: "fixed" | "markup_percent" | "markup_toman";
      markupPercent: number | null;
      markupToman: number | null;
      sourceName: string | null;
      sourceUrl: string | null;
      validUntil: number | null;
      isCafeOverride: boolean;
    } | null;
    effectiveStatus: string;
  }[];
  officialLinks: { name: string; url: string; sourceName: string }[];
  history: { role: "user" | "assistant"; content: string }[];
};

function faDate(value: number) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function buildContextPrompt(context: AgentContext) {
  const parts: string[] = [
    "اطلاعات زیر تنها منبع مجاز برای پاسخ است. اگر پاسخ در آن نیست، اعلام کن که اطلاعات تأییدشده نداری.",
  ];
  if (context.knowledge.length === 0) {
    parts.push("\nدانش تأییدشده مرتبط: هیچ سندی پیدا نشد.");
  } else {
    parts.push("\nدانش تأییدشده مرتبط:");
    context.knowledge.forEach((doc, index) => {
      parts.push(
        `[${index + 1}] ${doc.title} (آخرین به‌روزرسانی: ${faDate(
          doc.updatedAt,
        )}، منبع: ${doc.sourceName})\n${doc.content}`,
      );
    });
  }

  if (context.services.length > 0) {
    parts.push("\nنرخ‌نامه معتبر همین کافی‌نت:");
    for (const service of context.services) {
      if (service.effective) {
        parts.push(
          `- ${service.name}: ${service.effective.priceToman.toLocaleString(
            "fa-IR",
          )} تومان برای هر ${service.unit}؛ نوع: ${
            service.effective.priceType === "official"
              ? "رسمی"
              : service.effective.priceType === "suggested"
                ? "پیشنهادی"
                : "اختصاصی کافی‌نت"
          }${service.effective.sourceName ? `؛ منبع: ${service.effective.sourceName}` : ""}${
            service.effective.validUntil
              ? `؛ اعتبار تا ${faDate(service.effective.validUntil)}`
              : ""
          }`,
        );
      } else {
        parts.push(
          `- ${service.name}: نرخ معتبر ثبت نشده (وضعیت: ${service.effectiveStatus}). برای این خدمت مبلغ اعلام نکن.`,
        );
      }
    }
  }
  if (context.officialLinks.length > 0) {
    parts.push("\nسامانه‌های رسمی مرتبط:");
    for (const link of context.officialLinks) {
      parts.push(`- ${link.name}: ${link.url} (منبع: ${link.sourceName})`);
    }
  }
  return parts.join("\n");
}

function knowledgeSources(context: AgentContext): AgentSource[] {
  return context.knowledge.map((doc) => ({
    title: doc.title,
    url: doc.sourceUrl ?? undefined,
    documentId: doc.documentId,
    updatedAt: doc.lastReviewedAt ?? doc.updatedAt,
    kind: "knowledge" as const,
  }));
}

/** Finds explicitly named add-on services; general pricing words never match. */
function requestedAddons(
  message: string,
  services: AgentContext["services"],
  mainServiceId: Id<"services">,
) {
  const tokens = new Set(tokenize(message));
  if (tokens.size === 0) return [];
  return services
    .filter((service) => {
      if (!service.isAddon || !service.effective || service.id === mainServiceId) {
        return false;
      }
      return tokenize(service.name).some((token) => tokens.has(token));
    })
    .slice(0, 4);
}

export const meta = query({
  args: {},
  handler: async (ctx) => {
    const session = await agentUser(ctx);
    const approved = await ctx.db
      .query("knowledge_documents")
      .withIndex("by_status_updated", (q) => q.eq("status", "approved"))
      .take(200);
    const services = await ctx.db
      .query("services")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .take(300);
    const overrides = await ctx.db
      .query("cafe_service_prices")
      .withIndex("by_cafe", (q) => q.eq("cafeId", session.cafe._id))
      .collect();
    const overrideIds = new Set(overrides.map((row) => row.serviceId));
    const billing = await getBillingSnapshot(ctx, session.cafe._id);
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();
    return {
      knowledgeDocs: approved.length,
      totalServices: services.length,
      overriddenServices: overrideIds.size,
      usage: billing.usage,
      canUseAgent: billing.canUseAgent,
      canViewRates:
        session.isOwner ||
        session.permissions.includes(PERMISSIONS.RATES_VIEW),
      canManageRates:
        session.isOwner ||
        session.permissions.includes(PERMISSIONS.RATES_MANAGE),
      model: settings?.aiModel ?? AGENT_MODEL,
      aiEnabled: settings?.aiEnabled ?? true,
      aiConfigured: Boolean(process.env.VLY_INTEGRATION_KEY?.trim()),
      serverNow: Date.now(),
    };
  },
});

export const conversations = query({
  args: {},
  handler: async (ctx) => {
    const session = await agentUser(ctx);
    const rows = await ctx.db
      .query("agent_conversations")
      .withIndex("by_cafe_user_updated", (q) =>
        q.eq("cafeId", session.cafe._id).eq("userId", session.user._id),
      )
      .order("desc")
      .take(50);
    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      messageCount: row.messageCount,
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
    }));
  },
});

export const conversation = query({
  args: { conversationId: v.id("agent_conversations") },
  handler: async (ctx, args) => {
    const session = await agentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      conversation.cafeId !== session.cafe._id ||
      conversation.userId !== session.user._id
    ) {
      fail("not_found", "این گفت‌وگو پیدا نشد.");
    }
    const messages = await ctx.db
      .query("agent_messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .take(200);
    const feedback = await ctx.db
      .query("agent_feedback")
      .withIndex("by_cafe_created", (q) => q.eq("cafeId", session.cafe._id))
      .order("desc")
      .take(300);
    const feedbackByMessage = new Map(
      feedback
        .filter((row) => row.userId === session.user._id)
        .map((row) => [row.messageId, row.rating]),
    );
    return {
      id: conversation._id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      messages: messages.map((message) => ({
        id: message._id,
        role: message.role,
        content: message.content,
        sources: message.sources,
        calculation: message.calculation ?? null,
        model: message.model ?? null,
        createdAt: message.createdAt,
        feedback: feedbackByMessage.get(message._id) ?? null,
      })),
    };
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.id("agent_conversations") },
  handler: async (ctx, args) => {
    const session = await agentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      conversation.cafeId !== session.cafe._id ||
      conversation.userId !== session.user._id
    ) {
      fail("not_found", "این گفت‌وگو پیدا نشد.");
    }
    const messages = await ctx.db
      .query("agent_messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();
    const feedback = await ctx.db
      .query("agent_feedback")
      .withIndex("by_cafe_created", (q) => q.eq("cafeId", session.cafe._id))
      .collect();
    for (const row of feedback) {
      if (
        row.conversationId === args.conversationId &&
        row.userId === session.user._id
      ) {
        await ctx.db.delete(row._id);
      }
    }
    for (const message of messages) await ctx.db.delete(message._id);
    await ctx.db.delete(args.conversationId);
    return { ok: true };
  },
});

export const submitFeedback = mutation({
  args: {
    messageId: v.id("agent_messages"),
    conversationId: v.id("agent_conversations"),
    rating: agentFeedbackRatingValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await agentUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.cafeId !== session.cafe._id ||
      message.userId !== session.user._id ||
      message.conversationId !== args.conversationId ||
      message.role !== "assistant"
    ) {
      fail("not_found", "پیام مورد نظر پیدا نشد.");
    }
    const note = args.note?.trim()
      ? requireText(args.note, "توضیح بازخورد", 2, 500)
      : undefined;
    const existing = await ctx.db
      .query("agent_feedback")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", session.user._id),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        note,
      });
    } else {
      await ctx.db.insert("agent_feedback", {
        messageId: args.messageId,
        conversationId: args.conversationId,
        cafeId: session.cafe._id,
        userId: session.user._id,
        rating: args.rating,
        note,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const ask = action({
  args: {
    message: v.string(),
    conversationId: v.optional(v.id("agent_conversations")),
  },
  handler: async (ctx, args): Promise<{
    conversationId: Id<"agent_conversations">;
    answer: string;
    sources: AgentSource[];
    calculation: AgentCalculation | null;
    model?: string;
  }> => {
    const startedAt = Date.now();
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("برای استفاده از ایجنت باید وارد حساب شوید.");
    }
    const snapshot = await ctx.runQuery(internal.tenancy.permissionSnapshot, {
      userId,
    });
    if (!snapshot?.cafeId) {
      throw new Error("حساب شما به کافی‌نتی متصل نیست.");
    }
    if (snapshot.cafeStatus !== "active") {
      throw new Error("حساب این کافی‌نت غیرفعال است.");
    }
    if (!snapshot.permissions.includes(PERMISSIONS.AGENT_USE)) {
      throw new Error("دسترسی به ایجنت هوشمند برای شما فعال نیست.");
    }
    const message = args.message.trim();
    if (message.length < 2) throw new Error("پیام خیلی کوتاه است.");
    if (message.length > 2000) {
      throw new Error("پیام نباید بیشتر از ۲۰۰۰ نویسه باشد.");
    }
    const runtimeConfig = (await ctx.runQuery(
      internal.platformAdmin.aiRuntimeConfig,
      {},
    )) as { aiEnabled: boolean; aiModel: string };
    const pricingIntent = hasPricingIntent(message);
    const aiConfigured = Boolean(process.env.VLY_INTEGRATION_KEY?.trim());

    // Plan access is required for every agent route, but the monthly AI quota
    // is only consumed by a real model call. Deterministic rate calculations
    // must remain available even when the AI provider is not configured.
    await ctx.runQuery(internal.billing.agentAccess, {
      cafeId: snapshot.cafeId,
      requireQuota: runtimeConfig.aiEnabled && aiConfigured && !pricingIntent,
      role: snapshot.isOwner ? "owner" : "employee",
    });

    const begun = (await ctx.runMutation(internal.agentStore.beginTurn, {
      userId,
      message,
      conversationId: args.conversationId,
    })) as {
      conversationId: Id<"agent_conversations">;
      cafeId: Id<"internet_cafes">;
      userId: Id<"users">;
    };
    const context = (await ctx.runQuery(internal.agentContext.context, {
      userId,
      cafeId: begun.cafeId,
      query: message,
      conversationId: begun.conversationId,
    })) as AgentContext;

    const matched = matchService(message, context.services);
    let answer: string;
    let sources: AgentSource[] = [];
    let calculation: AgentCalculation | null = null;
    let model: string | undefined;
    let route = "permission";
    let runStatus: "success" | "fallback" | "error" = "success";
    let errorMessage: string | undefined;

    if (pricingIntent && !context.canViewRates) {
      answer =
        "دسترسی به نرخ‌نامه برای حساب شما فعال نیست؛ بنابراین نمی‌توانم مبلغ خدمتی را اعلام کنم. برای مشاهده نرخ‌ها از صاحب کافی‌نت درخواست مجوز «مشاهده نرخ‌نامه» کنید.";
      model = "permission-check";
    } else if (pricingIntent && matched) {
      route = "pricing";
      const resolution = matched.effective
        ? {
            status: "available" as const,
            price: {
              priceToman: matched.effective.priceToman,
              priceType: matched.effective.priceType,
              priceMode: matched.effective.priceMode,
              markupPercent: matched.effective.markupPercent,
              markupToman: matched.effective.markupToman,
              sourceId: undefined,
              validFrom: null,
              validUntil: matched.effective.validUntil,
              isCafeOverride: matched.effective.isCafeOverride,
            },
          }
        : {
            status: matched.effectiveStatus as
              | "missing"
              | "needs_review"
              | "inactive"
              | "expired"
              | "future",
            price: null,
          };
      const quantity = extractQuantity(message, matched.unit);
      const addons = requestedAddons(message, context.services, matched.id);
      const result = buildPricingResult(
        { _id: matched.id, name: matched.name, unit: matched.unit },
        resolution,
        quantity,
        matched.effective?.sourceName ?? undefined,
        addons.map((addon) => ({
          _id: addon.id,
          name: addon.name,
          unit: addon.unit,
          priceToman: addon.effective!.priceToman,
        })),
      );
      answer = result.content;
      calculation = result.calculation;
      model = "deterministic-pricing";
      if (matched.effective) {
        sources = [
          {
            title: `نرخ ${matched.name}`,
            url: matched.effective.sourceUrl ?? undefined,
            serviceId: matched.id,
            updatedAt: matched.updatedAt,
            kind: "price" as const,
          },
          ...addons.map((addon) => ({
            title: `نرخ ${addon.name}`,
            url: addon.effective?.sourceUrl ?? undefined,
            serviceId: addon.id,
            updatedAt: addon.updatedAt,
            kind: "price" as const,
          })),
        ];
      }
    } else if (pricingIntent) {
      route = "pricing-unmatched";
      answer = `برای اعلام مبلغ دقیق، نام خدمت را کمی روشن‌تر بنویسید (مثلاً «تایپ و ویرایش» یا «پرینت»).\n\nدر حال حاضر فقط نرخ‌های ثبت‌شده در نرخ‌نامه کافی‌نت قابل استناد هستند و اگر نرخی تأیید نشده باشد، مبلغی اعلام نمی‌کنم.`;
      model = "deterministic-pricing";
    } else {
      route = "ai";
      const contextPrompt = buildContextPrompt(context);
      const history = context.history
        .filter(
          (row, index) =>
            !(
              index === context.history.length - 1 &&
              row.role === "user" &&
              row.content === message
            ),
        )
        .slice(-8);
      const unavailableAnswer = `ارتباط با سرویس هوش مصنوعی در این لحظه برقرار نشد. ${
        context.knowledge.length > 0
          ? "منابع تأییدشده مرتبط در کنار همین پیام نمایش داده شده‌اند؛ لطفاً دوباره تلاش کنید."
          : "لطفاً پرسش را بعداً دوباره مطرح کنید یا از منوی «سامانه‌های کاربردی» به منبع رسمی مراجعه کنید."
      }`;
      try {
        if (!runtimeConfig.aiEnabled) {
          answer = unavailableAnswer;
          model = "unavailable";
          runStatus = "fallback";
          errorMessage = "ai_disabled_by_admin";
        } else if (!aiConfigured) {
          answer = unavailableAnswer;
          model = "unavailable";
          runStatus = "fallback";
          errorMessage = "ai_not_configured";
        } else {
          await ctx.runMutation(internal.billing.consumeAiRequest, {
            cafeId: snapshot.cafeId,
          });
          const completion = await getVly().ai.completion({
            model: runtimeConfig.aiModel,
            temperature: 0.2,
            maxTokens: 700,
            messages: [
              { role: "system", content: buildSystemPrompt() },
              { role: "system", content: contextPrompt },
              ...history.map((row) => ({
                role: row.role,
                content: row.content,
              })),
              { role: "user", content: message },
            ],
          });
          if (
            completion.success &&
            completion.data?.choices[0]?.message.content
          ) {
            answer = completion.data.choices[0].message.content.trim();
            model = runtimeConfig.aiModel;
          } else {
            answer = unavailableAnswer;
            model = "unavailable";
            runStatus = "fallback";
            errorMessage = "completion_failed";
          }
        }
      } catch (error) {
        answer = unavailableAnswer;
        model = "unavailable";
        runStatus = "error";
        errorMessage = error instanceof Error ? error.message : "unknown_ai_error";
      }
      sources = knowledgeSources(context);
      if (context.officialLinks.length > 0) {
        sources = [
          ...sources,
          ...context.officialLinks.map((link) => ({
            title: link.name,
            url: link.url,
            kind: "official" as const,
          })),
        ];
      }
    }

    await ctx.runMutation(internal.agentStore.completeTurn, {
      userId,
      conversationId: begun.conversationId,
      content: answer,
      sources: sources.slice(0, 6),
      calculation: calculation ?? undefined,
      model,
    });
    try {
      await ctx.runMutation(internal.agentStore.recordRun, {
        userId,
        cafeId: begun.cafeId,
        conversationId: begun.conversationId,
        route,
        status: runStatus,
        model,
        durationMs: Date.now() - startedAt,
        hasSources: sources.length > 0,
        question: message,
        errorMessage,
      });
    } catch (logError) {
      // A logging failure must not break an answer that was already stored.
      if (logError instanceof Error) errorMessage = logError.message;
    }
    return {
      conversationId: begun.conversationId,
      answer,
      sources: sources.slice(0, 6),
      calculation,
      model,
    };
  },
});
