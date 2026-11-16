import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertCafeActive, requirePermission } from "./lib/access";
import { assertPlanFeature } from "./lib/billing";
import { fail, requireText } from "./lib/validation";
import {
  PRICE_TYPE_LABELS,
  resolveServicePrice,
  validatePriceToman,
  validatePriceValidity,
} from "./lib/pricing";
import { PERMISSIONS } from "./permissions";
import { servicePriceModeValidator } from "./schema";

type UserCtx = Parameters<typeof requirePermission>[0];

async function ratesUser(ctx: UserCtx) {
  const session = await requirePermission(ctx, PERMISSIONS.RATES_VIEW);
  assertCafeActive(session.cafe);
  await assertPlanFeature(
    ctx,
    session.cafe._id,
    "rates",
    session.isOwner ? "owner" : "employee",
  );
  return session;
}

async function ratesWriter(ctx: UserCtx) {
  const session = await requirePermission(ctx, PERMISSIONS.RATES_MANAGE);
  assertCafeActive(session.cafe);
  await assertPlanFeature(
    ctx,
    session.cafe._id,
    "rates",
    session.isOwner ? "owner" : "employee",
  );
  return session;
}

function sourceView(source: Doc<"price_sources"> | undefined) {
  if (!source) return null;
  return {
    id: source._id,
    name: source.name,
    url: source.url ?? null,
    kind: source.kind,
  };
}

async function activeSource(
  ctx: UserCtx,
  sourceId: Id<"price_sources"> | undefined,
) {
  if (!sourceId) return null;
  const source = await ctx.db.get(sourceId);
  if (!source || !source.isActive) {
    fail("validation", "منبع قیمت انتخاب‌شده معتبر یا فعال نیست.");
  }
  return source;
}

export const catalog = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("service_categories")),
  },
  handler: async (ctx, args) => {
    const session = await ratesUser(ctx);
    const canManage =
      session.isOwner ||
      session.permissions.includes(PERMISSIONS.RATES_MANAGE);
    const categories = await ctx.db
      .query("service_categories")
      .withIndex("by_sort_order")
      .collect();
    const activeCategories = categories.filter((category) => category.isActive);
    const categoryIds = new Set(activeCategories.map((category) => category._id));
    const services = await ctx.db
      .query("services")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .order("asc")
      .take(500);
    const overrides = await ctx.db
      .query("cafe_service_prices")
      .withIndex("by_cafe", (q) => q.eq("cafeId", session.cafe._id))
      .collect();
    const overrideByService = new Map(
      overrides.map((row) => [row.serviceId, row]),
    );
    const sources = await ctx.db.query("price_sources").collect();
    const sourceById = new Map(sources.map((source) => [source._id, source]));
    const search = args.search
      ? args.search.trim().toLocaleLowerCase("fa").replace(/ي/g, "ی")
      : "";
    const now = Date.now();

    const items = services
      .filter((service) => categoryIds.has(service.categoryId))
      .filter((service) => !args.categoryId || service.categoryId === args.categoryId)
      .filter((service) => {
        if (!search) return true;
        return `${service.name} ${service.description} ${service.unit}`
          .toLocaleLowerCase("fa")
          .replace(/ي/g, "ی")
          .includes(search);
      })
      .map((service) => {
        const override = overrideByService.get(service._id) ?? null;
        const resolution = resolveServicePrice(service, override, now);
        const baseSource = service.sourceId
          ? sourceById.get(service.sourceId)
          : undefined;
        const overrideSource = override?.sourceId
          ? sourceById.get(override.sourceId)
          : undefined;
        const effectiveSource = resolution.status === "available"
          ? resolution.price.sourceId
            ? sourceById.get(resolution.price.sourceId)
            : undefined
          : undefined;
        return {
          id: service._id,
          name: service.name,
          description: service.description,
          unit: service.unit,
          isAddon: service.isAddon,
          categoryId: service.categoryId,
          categoryName:
            activeCategories.find((item) => item._id === service.categoryId)
              ?.name ?? "بدون دسته",
          categoryTone:
            activeCategories.find((item) => item._id === service.categoryId)
              ?.tone ?? "navy",
          base: {
            priceToman: service.basePriceToman ?? null,
            priceType: service.priceType,
            status: service.priceStatus,
            source: sourceView(baseSource),
            validFrom: service.validFrom ?? null,
            validUntil: service.validUntil ?? null,
          },
          override: override
            ? {
                priceMode: override.priceMode ?? "fixed",
                priceToman: override.priceToman ?? null,
                markupPercent: override.markupPercent ?? null,
                markupToman: override.markupToman ?? null,
                priceType: override.priceType,
                status: override.status,
                source: sourceView(overrideSource),
                validFrom: override.validFrom ?? null,
                validUntil: override.validUntil ?? null,
              }
            : null,
          effective:
            resolution.status === "available"
              ? {
                  priceToman: resolution.price.priceToman,
                  priceType: resolution.price.priceType,
                  priceMode: resolution.price.priceMode,
                  markupPercent: resolution.price.markupPercent,
                  markupToman: resolution.price.markupToman,
                  source: sourceView(effectiveSource),
                  validFrom: resolution.price.validFrom,
                  validUntil: resolution.price.validUntil,
                  isCafeOverride: resolution.price.isCafeOverride,
                  priceTypeLabel:
                    PRICE_TYPE_LABELS[resolution.price.priceType],
                }
              : null,
          effectiveStatus: resolution.status,
        };
      });

    return {
      items,
      categories: activeCategories.map((category) => ({
        id: category._id,
        name: category.name,
        description: category.description ?? null,
        icon: category.icon,
        tone: category.tone,
        count: items.filter((item) => item.categoryId === category._id).length,
      })),
      sources: sources
        .filter((source) => source.isActive)
        .map((source) => sourceView(source)),
      canManage,
      isOwner: session.isOwner,
      serverNow: now,
    };
  },
});

export const myHistory = query({
  args: { serviceId: v.optional(v.id("services")) },
  handler: async (ctx, args) => {
    const session = await ratesUser(ctx);
    const rows = args.serviceId
      ? await ctx.db
          .query("price_history")
          .withIndex("by_service_changed", (q) =>
            q.eq("serviceId", args.serviceId!),
          )
          .order("desc")
          .take(100)
      : await ctx.db
          .query("price_history")
          .withIndex("by_changed")
          .order("desc")
          .take(200);
    const visible = rows
      .filter(
        (row) =>
          row.scope === "platform" || row.cafeId === session.cafe._id,
      )
      .slice(0, 40);
    const services = await ctx.db.query("services").collect();
    const sources = await ctx.db.query("price_sources").collect();
    const users = await ctx.db.query("users").collect();
    const serviceById = new Map(services.map((item) => [item._id, item]));
    const sourceById = new Map(sources.map((item) => [item._id, item]));
    const userById = new Map(users.map((item) => [item._id, item]));
    return visible.map((row) => ({
      id: row._id,
      scope: row.scope,
      serviceId: row.serviceId,
      serviceName: serviceById.get(row.serviceId)?.name ?? "خدمت حذف‌شده",
      oldPriceToman: row.oldPriceToman ?? null,
      newPriceToman: row.newPriceToman ?? null,
      oldPriceType: row.oldPriceType ?? null,
      newPriceType: row.newPriceType ?? null,
      oldPriceMode: row.oldPriceMode ?? null,
      newPriceMode: row.newPriceMode ?? null,
      oldMarkupPercent: row.oldMarkupPercent ?? null,
      newMarkupPercent: row.newMarkupPercent ?? null,
      oldMarkupToman: row.oldMarkupToman ?? null,
      newMarkupToman: row.newMarkupToman ?? null,
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

export const mySuggestions = query({
  args: {},
  handler: async (ctx) => {
    const session = await ratesUser(ctx);
    const rows = await ctx.db
      .query("rate_suggestions")
      .withIndex("by_cafe_created", (q) => q.eq("cafeId", session.cafe._id))
      .order("desc")
      .take(20);
    const services = await ctx.db.query("services").collect();
    const serviceById = new Map(services.map((item) => [item._id, item]));
    return rows.map((row) => ({
      id: row._id,
      serviceName: serviceById.get(row.serviceId)?.name ?? "خدمت حذف‌شده",
      proposedPriceToman: row.proposedPriceToman,
      proposedPriceType: row.proposedPriceType,
      status: row.status,
      note: row.note ?? null,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt ?? null,
    }));
  },
});

export const setMyPrice = mutation({
  args: {
    serviceId: v.id("services"),
    priceMode: v.optional(servicePriceModeValidator),
    priceToman: v.optional(v.number()),
    markupPercent: v.optional(v.number()),
    markupToman: v.optional(v.number()),
    priceType: v.union(v.literal("suggested"), v.literal("custom")),
    sourceId: v.optional(v.id("price_sources")),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ratesWriter(ctx);
    const service = await ctx.db.get(args.serviceId);
    if (!service || !service.isActive) {
      fail("not_found", "این خدمت فعال نیست.");
    }
    const mode = args.priceMode ?? "fixed";
    let price: number | undefined;
    let markupPercent: number | undefined;
    let markupToman: number | undefined;
    if (mode === "fixed") {
      price = validatePriceToman(args.priceToman, "قیمت");
      if (price === undefined) fail("validation", "قیمت را وارد کنید.");
    } else if (mode === "markup_percent") {
      const value = args.markupPercent;
      if (
        value === undefined ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1000
      ) {
        fail("validation", "درصد سود باید بین ۰ تا ۱۰۰۰ باشد.");
      }
      markupPercent = Math.round(value * 100) / 100;
    } else {
      markupToman = validatePriceToman(args.markupToman, "مبلغ افزایش");
      if (markupToman === undefined) {
        fail("validation", "مبلغ افزایش را وارد کنید.");
      }
    }
    const validity = validatePriceValidity(args.validFrom, args.validUntil);
    const source = await activeSource(ctx, args.sourceId);
    const existing = await ctx.db
      .query("cafe_service_prices")
      .withIndex("by_cafe_service", (q) =>
        q.eq("cafeId", session.cafe._id).eq("serviceId", args.serviceId),
      )
      .first();
    const now = Date.now();
    const base = resolveServicePrice(service, null, now);
    const finalPrice =
      mode === "fixed"
        ? price
        : base.status === "available"
          ? mode === "markup_percent"
            ? Math.round(
                base.price.priceToman * (1 + (markupPercent ?? 0) / 100),
              )
            : Math.round(base.price.priceToman + (markupToman ?? 0))
          : undefined;
    const fields = {
      priceMode: mode,
      priceToman: mode === "fixed" ? price : undefined,
      markupPercent: mode === "markup_percent" ? markupPercent : undefined,
      markupToman: mode === "markup_toman" ? markupToman : undefined,
      priceType: mode === "fixed" ? args.priceType : ("custom" as const),
      sourceId: source?._id,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      status: "active" as const,
      updatedBy: session.user._id,
      updatedAt: now,
    };
    const modeNote =
      mode === "fixed"
        ? "نرخ ثابت"
        : mode === "markup_percent"
          ? `${markupPercent ?? 0}٪ سود روی نرخ پایه`
          : `افزودن ${markupToman ?? 0} تومان به نرخ پایه`;
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await ctx.db.insert("price_history", {
        scope: "cafe",
        cafeId: session.cafe._id,
        serviceId: args.serviceId,
        oldPriceToman: existing.priceToman,
        newPriceToman: finalPrice,
        oldPriceType: existing.priceType,
        newPriceType: fields.priceType,
        oldPriceMode: existing.priceMode ?? "fixed",
        newPriceMode: mode,
        oldMarkupPercent: existing.markupPercent,
        newMarkupPercent: markupPercent,
        oldMarkupToman: existing.markupToman,
        newMarkupToman: markupToman,
        oldStatus: existing.status,
        newStatus: "active",
        sourceId: source?._id,
        note: `به‌روزرسانی نرخ اختصاصی کافی‌نت (${modeNote})`,
        changedBy: session.user._id,
        changedAt: now,
      });
    } else {
      await ctx.db.insert("cafe_service_prices", {
        cafeId: session.cafe._id,
        serviceId: args.serviceId,
        ...fields,
        createdAt: now,
      });
      await ctx.db.insert("price_history", {
        scope: "cafe",
        cafeId: session.cafe._id,
        serviceId: args.serviceId,
        newPriceToman: finalPrice,
        newPriceType: fields.priceType,
        newPriceMode: mode,
        newMarkupPercent: markupPercent,
        newMarkupToman: markupToman,
        newStatus: "active",
        sourceId: source?._id,
        note: `ثبت نرخ اختصاصی کافی‌نت (${modeNote})`,
        changedBy: session.user._id,
        changedAt: now,
      });
    }
    return { ok: true };
  },
});

export const clearMyPrice = mutation({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const session = await ratesWriter(ctx);
    const existing = await ctx.db
      .query("cafe_service_prices")
      .withIndex("by_cafe_service", (q) =>
        q.eq("cafeId", session.cafe._id).eq("serviceId", args.serviceId),
      )
      .first();
    if (!existing) return { ok: true };
    await ctx.db.delete(existing._id);
    await ctx.db.insert("price_history", {
      scope: "cafe",
      cafeId: session.cafe._id,
      serviceId: args.serviceId,
      oldPriceToman: existing.priceToman,
      oldPriceType: existing.priceType,
      oldPriceMode: existing.priceMode ?? "fixed",
      oldMarkupPercent: existing.markupPercent,
      oldMarkupToman: existing.markupToman,
      oldStatus: existing.status,
      newStatus: "inactive",
      note: "حذف نرخ اختصاصی؛ بازگشت به نرخ پایه",
      changedBy: session.user._id,
      changedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const submitRateSuggestion = mutation({
  args: {
    serviceId: v.id("services"),
    proposedPriceToman: v.number(),
    proposedPriceType: v.union(
      v.literal("official"),
      v.literal("suggested"),
    ),
    sourceId: v.optional(v.id("price_sources")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ratesUser(ctx);
    const service = await ctx.db.get(args.serviceId);
    if (!service || !service.isActive) {
      fail("not_found", "این خدمت فعال نیست.");
    }
    const price = validatePriceToman(
      args.proposedPriceToman,
      "نرخ پیشنهادی",
    );
    if (price === undefined) fail("validation", "نرخ پیشنهادی را وارد کنید.");
    const source = await activeSource(ctx, args.sourceId);
    const note = args.note?.trim()
      ? requireText(args.note, "توضیح پیشنهاد", 3, 500)
      : undefined;
    const existing = await ctx.db
      .query("rate_suggestions")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
      .collect();
    if (
      existing.some(
        (row) =>
          row.cafeId === session.cafe._id && row.status === "pending",
      )
    ) {
      fail("conflict", "برای این خدمت قبلاً نرخ پیشنهادی ثبت کرده‌اید.");
    }
    const now = Date.now();
    await ctx.db.insert("rate_suggestions", {
      cafeId: session.cafe._id,
      serviceId: args.serviceId,
      proposedPriceToman: price,
      proposedPriceType: args.proposedPriceType,
      sourceId: source?._id,
      note,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});
