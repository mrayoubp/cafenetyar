import type { Doc } from "../_generated/dataModel";
import type { ServicePriceMode, ServicePriceType } from "../schema";
import { fail } from "./validation";

export type EffectivePrice = {
  priceToman: number;
  priceType: ServicePriceType;
  priceMode: ServicePriceMode;
  markupPercent: number | null;
  markupToman: number | null;
  sourceId: Doc<"services">["sourceId"];
  validFrom: number | null;
  validUntil: number | null;
  isCafeOverride: boolean;
};

export type PriceResolution =
  | { status: "available"; price: EffectivePrice }
  | {
      status: "missing" | "needs_review" | "inactive" | "expired" | "future";
      price: null;
    };

export function validatePriceToman(value: number | undefined, label: string) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) {
    fail("validation", `${label} باید یک مبلغ معتبر و غیرمنفی باشد.`);
  }
  return Math.round(value);
}

export function validatePriceValidity(
  validFrom: number | undefined,
  validUntil: number | undefined,
) {
  if (
    validFrom !== undefined &&
    (!Number.isFinite(validFrom) || validFrom < 0)
  ) {
    fail("validation", "تاریخ شروع اعتبار معتبر نیست.");
  }
  if (
    validUntil !== undefined &&
    (!Number.isFinite(validUntil) || validUntil < 0)
  ) {
    fail("validation", "تاریخ پایان اعتبار معتبر نیست.");
  }
  if (
    validFrom !== undefined &&
    validUntil !== undefined &&
    validUntil < validFrom
  ) {
    fail("validation", "تاریخ پایان اعتبار نباید قبل از شروع باشد.");
  }
  return {
    validFrom: validFrom === undefined ? undefined : Math.trunc(validFrom),
    validUntil: validUntil === undefined ? undefined : Math.trunc(validUntil),
  };
}

function resolveBasePrice(
  service: Doc<"services">,
  now: number,
): PriceResolution {
  if (service.priceStatus === "inactive") {
    return { status: "inactive", price: null };
  }
  if (service.priceStatus === "needs_review" || service.basePriceToman === undefined) {
    return { status: "needs_review", price: null };
  }
  if (service.validFrom !== undefined && service.validFrom > now) {
    return { status: "future", price: null };
  }
  if (service.validUntil !== undefined && service.validUntil < now) {
    return { status: "expired", price: null };
  }
  return {
    status: "available",
    price: {
      priceToman: service.basePriceToman,
      priceType: service.priceType,
      priceMode: "fixed",
      markupPercent: null,
      markupToman: null,
      sourceId: service.sourceId,
      validFrom: service.validFrom ?? null,
      validUntil: service.validUntil ?? null,
      isCafeOverride: false,
    },
  };
}

/**
 * Resolves the effective price for one cafe. A cafe override always wins over
 * the platform base price, even when it is expired or marked for review; in
 * that case no price is returned instead of silently falling back. Markup
 * modes need a valid platform base price, while fixed overrides do not.
 */
export function resolveServicePrice(
  service: Doc<"services">,
  override: Doc<"cafe_service_prices"> | null,
  now: number,
): PriceResolution {
  if (!service.isActive) return { status: "inactive", price: null };
  if (!override) return resolveBasePrice(service, now);

  if (override.status === "inactive") {
    return { status: "inactive", price: null };
  }
  if (override.validFrom !== undefined && override.validFrom > now) {
    return { status: "future", price: null };
  }
  if (override.validUntil !== undefined && override.validUntil < now) {
    return { status: "expired", price: null };
  }
  if (override.status === "needs_review") {
    return { status: "needs_review", price: null };
  }

  const mode = override.priceMode ?? "fixed";
  if (mode === "fixed") {
    if (override.priceToman === undefined) {
      return { status: "needs_review", price: null };
    }
    return {
      status: "available",
      price: {
        priceToman: override.priceToman,
        priceType: override.priceType,
        priceMode: "fixed",
        markupPercent: null,
        markupToman: null,
        sourceId: override.sourceId,
        validFrom: override.validFrom ?? null,
        validUntil: override.validUntil ?? null,
        isCafeOverride: true,
      },
    };
  }

  const base = resolveBasePrice(service, now);
  if (base.status !== "available") return base;

  let finalPrice: number;
  if (mode === "markup_percent") {
    if (
      override.markupPercent === undefined ||
      !Number.isFinite(override.markupPercent) ||
      override.markupPercent < 0
    ) {
      return { status: "needs_review", price: null };
    }
    finalPrice = Math.round(
      base.price.priceToman * (1 + override.markupPercent / 100),
    );
  } else {
    if (
      override.markupToman === undefined ||
      !Number.isFinite(override.markupToman) ||
      override.markupToman < 0
    ) {
      return { status: "needs_review", price: null };
    }
    finalPrice = Math.round(base.price.priceToman + override.markupToman);
  }

  return {
    status: "available",
    price: {
      priceToman: finalPrice,
      priceType: "custom",
      priceMode: mode,
      markupPercent: mode === "markup_percent" ? override.markupPercent! : null,
      markupToman: mode === "markup_toman" ? override.markupToman! : null,
      sourceId: override.sourceId ?? base.price.sourceId,
      validFrom: override.validFrom ?? base.price.validFrom,
      validUntil: override.validUntil ?? base.price.validUntil,
      isCafeOverride: true,
    },
  };
}

export const PRICE_TYPE_LABELS: Record<ServicePriceType, string> = {
  official: "رسمی",
  suggested: "پیشنهادی",
  custom: "اختصاصی کافی‌نت",
};

export const PRICE_STATUS_LABELS = {
  active: "فعال",
  needs_review: "نیازمند بررسی و به‌روزرسانی",
  inactive: "غیرفعال",
} as const;
