import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdminPermission } from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { ensureAgentDefaults } from "./lib/agentDefaults";
import { logAudit } from "./lib/platform";
import {
  resolveServicePrice,
  validatePriceToman,
  validatePriceValidity,
} from "./lib/pricing";
import { fail, requireText } from "./lib/validation";
import {
  isWebsiteTone,
  normalizeOptionalWebsiteUrl,
} from "./lib/websites";
import {
  priceSourceKindValidator,
  rateSuggestionStatusValidator,
  servicePriceStatusValidator,
  servicePriceTypeValidator,
} from "./schema";

function requireSiteAdmin(ctx: Parameters<typeof requireAdminPermission>[0]) {
  return requireAdminPermission(ctx, ADMIN_PERMISSIONS.RATES_MANAGE);
}

type AdminCtx = Parameters<typeof requireSiteAdmin>[0];

function optionalText(value: string | undefined, label: string, max: number) {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  if (text.length > max) {
    fail("validation", `${label} نباید بیشتر از ${max} نویسه باشد.`);
  }
  return text;
}

async function serviceOrFail(ctx: AdminCtx, id: Id<"services">) {
  const service = await ctx.db.get(id);
  if (!service) fail("not_found", "خدمت مورد نظر پیدا نشد.");
  return service;
}

async function categoryOrFail(
  ctx: AdminCtx,
  id: Id<"service_categories">,
) {
  const category = await ctx.db.get(id);
  if (!category) fail("validation", "دسته‌بندی خدمت پیدا نشد.");
  return category;
}

async function sourceOrFail(ctx: AdminCtx, id: Id<"price_sources"> | undefined) {
  if (!id) return null;
  const source = await ctx.db.get(id);
  if (!source) fail("validation", "منبع قیمت پیدا نشد.");
  return source;
}

function sourceRow(source: Doc<"price_sources">) {
  return {
    id: source._id,
    name: source.name,
    url: source.url ?? null,
    kind: source.kind,
    description: source.description ?? null,
    isActive: source.isActive,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const services = await ctx.db.query("services").collect();
    const categories = await ctx.db.query("service_categories").collect();
    const sources = await ctx.db.query("price_sources").collect();
    const suggestions = await ctx.db.query("rate_suggestions").collect();
    const overrides = await ctx.db.query("cafe_service_prices").collect();
    return {
      services: {
        total: services.length,
        active: services.filter((service) => service.isActive).length,
        priced: services.filter(
          (service) =>
            service.priceStatus === "active" &&
            service.basePriceToman !== undefined,
        ).length,
        needsReview: services.filter(
          (service) => service.priceStatus !== "active",
        ).length,
      },
      categories: categories.length,
      sources: sources.filter((source) => source.isActive).length,
      pendingSuggestions: suggestions.filter(
        (row) => row.status === "pending",
      ).length,
      cafeOverrides: overrides.length,
    };
  },
});

export const listServices = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("service_categories")),
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("active"),
        v.literal("inactive"),
        v.literal("priced"),
        v.literal("needs_review"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const services = await ctx.db
      .query("services")
      .withIndex("by_created")
      .order("desc")
      .take(500);
    const categories = await ctx.db.query("service_categories").collect();
    const sources = await ctx.db.query("price_sources").collect();
    const overrides = await ctx.db.query("cafe_service_prices").collect();
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const sourceById = new Map(sources.map((item) => [item._id, item]));
    const search = args.search
      ? args.search.trim().toLocaleLowerCase("fa").replace(/ي/g, "ی")
      : "";
    const now = Date.now();
    return services
      .filter((service) => {
        if (args.categoryId && service.categoryId !== args.categoryId) return false;
        if (args.status === "active" && !service.isActive) return false;
        if (args.status === "inactive" && service.isActive) return false;
        if (
          args.status === "priced" &&
          (service.priceStatus !== "active" ||
            service.basePriceToman === undefined)
        ) {
          return false;
        }
        if (args.status === "needs_review" && service.priceStatus === "active") {
          return false;
        }
        if (search) {
          const haystack = `${service.name} ${service.description} ${service.unit}`
            .toLocaleLowerCase("fa")
            .replace(/ي/g, "ی");
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .map((service) => {
        const category = categoryById.get(service.categoryId);
        const source = service.sourceId
          ? sourceById.get(service.sourceId)
          : undefined;
        const resolution = resolveServicePrice(service, null, now);
        return {
          id: service._id,
          name: service.name,
          description: service.description,
          unit: service.unit,
          categoryId: service.categoryId,
          categoryName: category?.name ?? "بدون دسته",
          categoryTone: category?.tone ?? "navy",
          basePriceToman: service.basePriceToman ?? null,
          priceType: service.priceType,
          priceStatus: service.priceStatus,
          source: source ? sourceRow(source) : null,
          validFrom: service.validFrom ?? null,
          validUntil: service.validUntil ?? null,
          isAddon: service.isAddon,
          isActive: service.isActive,
          sortOrder: service.sortOrder,
          effectiveStatus: resolution.status,
          cafeOverrideCount: overrides.filter(
            (row) => row.serviceId === service._id,
          ).length,
          createdAt: service.createdAt,
          updatedAt: service.updatedAt,
        };
      });
  },
});

export const categories = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const categories = await ctx.db
      .query("service_categories")
      .withIndex("by_sort_order")
      .collect();
    const services = await ctx.db.query("services").collect();
    return categories.map((category) => ({
      id: category._id,
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
      icon: category.icon,
      tone: category.tone,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      serviceCount: services.filter(
        (service) => service.categoryId === category._id,
      ).length,
    }));
  },
});

export const sources = query({
  args: {},
  handler: async (ctx) => {
    await requireSiteAdmin(ctx);
    const sources = await ctx.db
      .query("price_sources")
      .withIndex("by_created")
      .order("desc")
      .collect();
    const services = await ctx.db.query("services").collect();
    const cafePrices = await ctx.db.query("cafe_service_prices").collect();
    const documents = await ctx.db.query("knowledge_documents").collect();
    return sources.map((source) => ({
      ...sourceRow(source),
      usageCount:
        services.filter((service) => service.sourceId === source._id).length +
        cafePrices.filter((row) => row.sourceId === source._id).length +
        documents.filter((doc) => doc.sourceId === source._id).length,
    }));
  },
});

export const suggestions = query({
  args: {
    status: v.optional(rateSuggestionStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const rows = await ctx.db
      .query("rate_suggestions")
      .withIndex("by_status_created")
      .order("desc")
      .take(250);
    const services = await ctx.db.query("services").collect();
    const cafes = await ctx.db.query("internet_cafes").collect();
    const sources = await ctx.db.query("price_sources").collect();
    const serviceById = new Map(services.map((item) => [item._id, item]));
    const cafeById = new Map(cafes.map((item) => [item._id, item]));
    const sourceById = new Map(sources.map((item) => [item._id, item]));
    return rows
      .filter((row) => !args.status || row.status === args.status)
      .map((row) => ({
        id: row._id,
        serviceId: row.serviceId,
        serviceName: serviceById.get(row.serviceId)?.name ?? "خدمت حذف‌شده",
        unit: serviceById.get(row.serviceId)?.unit ?? "واحد",
        cafeId: row.cafeId,
        cafeName: cafeById.get(row.cafeId)?.name ?? "کافی‌نت حذف‌شده",
        proposedPriceToman: row.proposedPriceToman,
        proposedPriceType: row.proposedPriceType,
        sourceName: row.sourceId
          ? sourceById.get(row.sourceId)?.name ?? null
          : null,
        note: row.note ?? null,
        status: row.status,
        createdAt: row.createdAt,
        reviewedAt: row.reviewedAt ?? null,
      }));
  },
});

export const history = query({
  args: {
    serviceId: v.optional(v.id("services")),
    cafeId: v.optional(v.id("internet_cafes")),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    const rows = args.serviceId
      ? await ctx.db
          .query("price_history")
          .withIndex("by_service_changed", (q) =>
            q.eq("serviceId", args.serviceId!),
          )
          .order("desc")
          .take(250)
      : await ctx.db
          .query("price_history")
          .withIndex("by_changed")
          .order("desc")
          .take(300);
    const services = await ctx.db.query("services").collect();
    const cafes = await ctx.db.query("internet_cafes").collect();
    const sources = await ctx.db.query("price_sources").collect();
    const users = await ctx.db.query("users").collect();
    const serviceById = new Map(services.map((item) => [item._id, item]));
    const cafeById = new Map(cafes.map((item) => [item._id, item]));
    const sourceById = new Map(sources.map((item) => [item._id, item]));
    const userById = new Map(users.map((item) => [item._id, item]));
    return rows
      .filter((row) => !args.cafeId || row.cafeId === args.cafeId)
      .map((row) => ({
        id: row._id,
        scope: row.scope,
        serviceName: serviceById.get(row.serviceId)?.name ?? "خدمت حذف‌شده",
        cafeName: row.cafeId
          ? cafeById.get(row.cafeId)?.name ?? "کافی‌نت حذف‌شده"
          : null,
        oldPriceToman: row.oldPriceToman ?? null,
        newPriceToman: row.newPriceToman ?? null,
        oldPriceType: row.oldPriceType ?? null,
        newPriceType: row.newPriceType ?? null,
        oldStatus: row.oldStatus ?? null,
        newStatus: row.newStatus ?? null,
        sourceName: row.sourceId
          ? sourceById.get(row.sourceId)?.name ?? null
          : null,
        note: row.note ?? null,
        changedByName: userById.get(row.changedBy)?.name ?? "مدیر",
        changedAt: row.changedAt,
      }));
  },
});

export const createService = mutation({
  args: {
    name: v.string(),
    categoryId: v.id("service_categories"),
    description: v.string(),
    unit: v.string(),
    basePriceToman: v.optional(v.number()),
    priceType: servicePriceTypeValidator,
    priceStatus: servicePriceStatusValidator,
    sourceId: v.optional(v.id("price_sources")),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    isAddon: v.boolean(),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    await categoryOrFail(ctx, args.categoryId);
    const basePriceToman = validatePriceToman(
      args.basePriceToman,
      "قیمت پایه",
    );
    if (args.priceStatus === "active" && basePriceToman === undefined) {
      fail("validation", "برای نرخ فعال باید مبلغ قیمت را وارد کنید.");
    }
    const validity = validatePriceValidity(args.validFrom, args.validUntil);
    const source = await sourceOrFail(ctx, args.sourceId);
    const all = await ctx.db.query("services").collect();
    const maxOrder = all.reduce((max, service) => Math.max(max, service.sortOrder), -1);
    const now = Date.now();
    const id = await ctx.db.insert("services", {
      name: requireText(args.name, "نام خدمت", 2, 140),
      categoryId: args.categoryId,
      description: requireText(args.description, "توضیحات خدمت", 5, 500),
      unit: requireText(args.unit, "واحد محاسبه", 1, 30),
      basePriceToman,
      priceType: args.priceType,
      priceStatus: args.priceStatus,
      sourceId: source?._id,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      isAddon: args.isAddon,
      isActive: args.isActive,
      sortOrder:
        typeof args.sortOrder === "number" && Number.isFinite(args.sortOrder)
          ? Math.max(0, Math.trunc(args.sortOrder))
          : maxOrder + 1,
      createdBy: session.user._id,
      updatedBy: session.user._id,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("price_history", {
      scope: "platform",
      serviceId: id,
      newPriceToman: basePriceToman,
      newPriceType: args.priceType,
      newStatus: args.priceStatus,
      sourceId: source?._id,
      note: "ایجاد خدمت و ثبت نرخ پایه",
      changedBy: session.user._id,
      changedAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "rate.service_created",
      entityType: "service",
      entityId: id,
      summary: `خدمت «${args.name}» به نرخ‌نامه اضافه شد.`,
      metadata: JSON.stringify({ basePriceToman, priceStatus: args.priceStatus }),
    });
    return { serviceId: id };
  },
});

export const updateService = mutation({
  args: {
    serviceId: v.id("services"),
    name: v.string(),
    categoryId: v.id("service_categories"),
    description: v.string(),
    unit: v.string(),
    basePriceToman: v.optional(v.number()),
    priceType: servicePriceTypeValidator,
    priceStatus: servicePriceStatusValidator,
    sourceId: v.optional(v.id("price_sources")),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    isAddon: v.boolean(),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const existing = await serviceOrFail(ctx, args.serviceId);
    await categoryOrFail(ctx, args.categoryId);
    const basePriceToman = validatePriceToman(
      args.basePriceToman,
      "قیمت پایه",
    );
    if (args.priceStatus === "active" && basePriceToman === undefined) {
      fail("validation", "برای نرخ فعال باید مبلغ قیمت را وارد کنید.");
    }
    const validity = validatePriceValidity(args.validFrom, args.validUntil);
    const source = await sourceOrFail(ctx, args.sourceId);
    const now = Date.now();
    const changed =
      existing.basePriceToman !== basePriceToman ||
      existing.priceType !== args.priceType ||
      existing.priceStatus !== args.priceStatus ||
      existing.sourceId !== source?._id ||
      existing.validFrom !== validity.validFrom ||
      existing.validUntil !== validity.validUntil;
    await ctx.db.patch(args.serviceId, {
      name: requireText(args.name, "نام خدمت", 2, 140),
      categoryId: args.categoryId,
      description: requireText(args.description, "توضیحات خدمت", 5, 500),
      unit: requireText(args.unit, "واحد محاسبه", 1, 30),
      basePriceToman,
      priceType: args.priceType,
      priceStatus: args.priceStatus,
      sourceId: source?._id,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      isAddon: args.isAddon,
      isActive: args.isActive,
      sortOrder: Math.max(0, Math.trunc(args.sortOrder)),
      updatedBy: session.user._id,
      updatedAt: now,
    });
    if (changed) {
      await ctx.db.insert("price_history", {
        scope: "platform",
        serviceId: args.serviceId,
        oldPriceToman: existing.basePriceToman,
        newPriceToman: basePriceToman,
        oldPriceType: existing.priceType,
        newPriceType: args.priceType,
        oldStatus: existing.priceStatus,
        newStatus: args.priceStatus,
        sourceId: source?._id,
        note: "ویرایش نرخ پایه یا اطلاعات خدمت",
        changedBy: session.user._id,
        changedAt: now,
      });
      await logAudit(ctx, {
        actorId: session.user._id,
        action: "rate.price_changed",
        entityType: "service",
        entityId: args.serviceId,
        summary: `نرخ خدمت «${existing.name}» تغییر کرد.`,
        metadata: JSON.stringify({
          oldPriceToman: existing.basePriceToman,
          newPriceToman: basePriceToman,
          oldStatus: existing.priceStatus,
          newStatus: args.priceStatus,
        }),
      });
    }
    return { ok: true };
  },
});

export const setServiceActive = mutation({
  args: { serviceId: v.id("services"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    await serviceOrFail(ctx, args.serviceId);
    await ctx.db.patch(args.serviceId, {
      isActive: args.isActive,
      updatedBy: session.user._id,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "rate.service_status_changed",
      entityType: "service",
      entityId: args.serviceId,
      summary: `خدمت نرخ‌نامه ${args.isActive ? "فعال" : "غیرفعال"} شد.`,
    });
    return { ok: true };
  },
});

export const deleteService = mutation({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const service = await serviceOrFail(ctx, args.serviceId);
    // Do not delete definitions that may be referenced by cafe-specific
    // prices. Archiving preserves the historical relationship and allows
    // the service to be restored later.
    await ctx.db.patch(args.serviceId, {
      isActive: false,
      updatedBy: session.user._id,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "rate.service_archived",
      entityType: "service",
      entityId: args.serviceId,
      summary: `خدمت «${service.name}» بایگانی و غیرفعال شد.`,
    });
    return { ok: true, deletedName: service.name };
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
      .query("service_categories")
      .withIndex("by_sort_order")
      .collect();
    let slug = `services-${Date.now().toString(36)}`;
    let suffix = 1;
    while (
      await ctx.db
        .query("service_categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    ) {
      slug = `services-${Date.now().toString(36)}-${suffix}`;
      suffix += 1;
    }
    const now = Date.now();
    const id = await ctx.db.insert("service_categories", {
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
    categoryId: v.id("service_categories"),
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
  args: { categoryId: v.id("service_categories") },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    await categoryOrFail(ctx, args.categoryId);
    const used = await ctx.db
      .query("services")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .first();
    if (used) {
      fail("conflict", "این دسته خدمت دارد؛ ابتدا خدمات را جابه‌جا کنید.");
    }
    await ctx.db.delete(args.categoryId);
    return { ok: true };
  },
});

export const createSource = mutation({
  args: {
    name: v.string(),
    url: v.optional(v.string()),
    kind: priceSourceKindValidator,
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("price_sources", {
      name: requireText(args.name, "نام منبع", 2, 140),
      url: normalizeOptionalWebsiteUrl(args.url, "لینک منبع"),
      kind: args.kind,
      description: optionalText(args.description, "توضیح منبع", 400),
      isActive: true,
      createdBy: session.user._id,
      createdAt: now,
      updatedAt: now,
    });
    return { sourceId: id };
  },
});

export const updateSource = mutation({
  args: {
    sourceId: v.id("price_sources"),
    name: v.string(),
    url: v.optional(v.string()),
    kind: priceSourceKindValidator,
    description: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    await sourceOrFail(ctx, args.sourceId);
    await ctx.db.patch(args.sourceId, {
      name: requireText(args.name, "نام منبع", 2, 140),
      url: normalizeOptionalWebsiteUrl(args.url, "لینک منبع"),
      kind: args.kind,
      description: optionalText(args.description, "توضیح منبع", 400),
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteSource = mutation({
  args: { sourceId: v.id("price_sources") },
  handler: async (ctx, args) => {
    await requireSiteAdmin(ctx);
    await sourceOrFail(ctx, args.sourceId);
    const services = await ctx.db.query("services").collect();
    const prices = await ctx.db.query("cafe_service_prices").collect();
    const docs = await ctx.db.query("knowledge_documents").collect();
    const used =
      services.some((row) => row.sourceId === args.sourceId) ||
      prices.some((row) => row.sourceId === args.sourceId) ||
      docs.some((row) => row.sourceId === args.sourceId);
    if (used) {
      fail(
        "conflict",
        "این منبع در نرخ یا سند استفاده شده است؛ به‌جای حذف آن را غیرفعال کنید.",
      );
    }
    await ctx.db.delete(args.sourceId);
    return { ok: true };
  },
});

export const approveRateSuggestion = mutation({
  args: { suggestionId: v.id("rate_suggestions") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) fail("not_found", "پیشنهاد نرخ پیدا نشد.");
    if (suggestion.status !== "pending") {
      fail("conflict", "این پیشنهاد قبلاً بررسی شده است.");
    }
    const service = await serviceOrFail(ctx, suggestion.serviceId);
    const now = Date.now();
    await ctx.db.patch(service._id, {
      basePriceToman: suggestion.proposedPriceToman,
      priceType: suggestion.proposedPriceType,
      priceStatus: "active",
      sourceId: suggestion.sourceId,
      validFrom: now,
      validUntil: undefined,
      updatedBy: session.user._id,
      updatedAt: now,
    });
    await ctx.db.insert("price_history", {
      scope: "platform",
      serviceId: service._id,
      oldPriceToman: service.basePriceToman,
      newPriceToman: suggestion.proposedPriceToman,
      oldPriceType: service.priceType,
      newPriceType: suggestion.proposedPriceType,
      oldStatus: service.priceStatus,
      newStatus: "active",
      sourceId: suggestion.sourceId,
      note: `تأیید نرخ پیشنهادی کافی‌نت (${suggestion.cafeId})`,
      changedBy: session.user._id,
      changedAt: now,
    });
    await ctx.db.patch(args.suggestionId, {
      status: "approved",
      reviewedBy: session.user._id,
      reviewedAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const rejectRateSuggestion = mutation({
  args: { suggestionId: v.id("rate_suggestions") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) fail("not_found", "پیشنهاد نرخ پیدا نشد.");
    if (suggestion.status !== "pending") {
      fail("conflict", "این پیشنهاد قبلاً بررسی شده است.");
    }
    await ctx.db.patch(args.suggestionId, {
      status: "rejected",
      reviewedBy: session.user._id,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const restorePriceVersion = mutation({
  args: { historyId: v.id("price_history") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const row = await ctx.db.get(args.historyId);
    if (!row || row.scope !== "platform") {
      fail("not_found", "نسخه قیمت پایه پیدا نشد.");
    }
    if (row.oldPriceToman === undefined && row.oldStatus === undefined) {
      fail("validation", "این رکورد نسخه قیمت قابل بازگردانی ندارد.");
    }
    const service = await serviceOrFail(ctx, row.serviceId);
    const now = Date.now();
    const restoredStatus =
      row.oldStatus ?? (row.oldPriceToman !== undefined ? "active" : "needs_review");
    const restoredType = row.oldPriceType ?? service.priceType;
    await ctx.db.patch(service._id, {
      basePriceToman: row.oldPriceToman,
      priceType: restoredType,
      priceStatus: restoredStatus,
      validFrom: now,
      validUntil: undefined,
      updatedBy: session.user._id,
      updatedAt: now,
    });
    await ctx.db.insert("price_history", {
      scope: "platform",
      serviceId: service._id,
      oldPriceToman: service.basePriceToman,
      newPriceToman: row.oldPriceToman,
      oldPriceType: service.priceType,
      newPriceType: restoredType,
      oldStatus: service.priceStatus,
      newStatus: restoredStatus,
      sourceId: service.sourceId,
      note: "بازگردانی نرخ پایه از تاریخچه",
      changedBy: session.user._id,
      changedAt: now,
    });
    return { ok: true };
  },
});

export const seedAgentCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSiteAdmin(ctx);
    return await ensureAgentDefaults(ctx, {
      actorId: session.user._id,
      onlyIfEmpty: false,
    });
  },
});
