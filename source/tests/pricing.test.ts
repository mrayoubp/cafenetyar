import {
  buildPricingResult,
  extractQuantity,
  hasPricingIntent,
} from "../src/convex/lib/agent";
import { resolveServicePrice, type PriceResolution } from "../src/convex/lib/pricing";
import type { Doc, Id } from "../src/convex/_generated/dataModel";
import { describe, expect, test } from "vitest";

const serviceId = "services:test" as Id<"services">;
const addonId = "services:addon" as Id<"services">;

const NOW = 1_800_000_000_000;

function serviceDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: serviceId,
    _creationTime: 0,
    name: "پرینت",
    categoryId: "service_categories:test" as Id<"service_categories">,
    description: "چاپ",
    unit: "برگ",
    basePriceToman: 100_000,
    priceType: "official",
    priceStatus: "active",
    isAddon: false,
    isActive: true,
    sortOrder: 1,
    createdBy: "users:test" as Id<"users">,
    updatedBy: "users:test" as Id<"users">,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as Doc<"services">;
}

function overrideDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: "cafe_service_prices:test" as Id<"cafe_service_prices">,
    _creationTime: 0,
    cafeId: "internet_cafes:test" as Id<"internet_cafes">,
    serviceId,
    priceMode: "fixed",
    priceToman: 80_000,
    priceType: "custom",
    status: "active",
    updatedBy: "users:test" as Id<"users">,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as Doc<"cafe_service_prices">;
}

function availablePrice(priceToman: number): PriceResolution {
  return {
    status: "available",
    price: {
      priceToman,
      priceType: "cafe",
      priceMode: "fixed",
      markupPercent: null,
      markupToman: null,
      sourceId: undefined,
      validFrom: null,
      validUntil: null,
      isCafeOverride: true,
    },
  };
}

describe("assistant pricing", () => {
  test("calculates quantity and add-ons from approved prices only", () => {
    const result = buildPricingResult(
      { _id: serviceId, name: "تایپ و ویرایش", unit: "صفحه" },
      availablePrice(20_000),
      3,
      "نرخ‌نامه رسمی",
      [
        {
          _id: addonId,
          name: "پرینت رنگی",
          unit: "برگ",
          priceToman: 5_000,
        },
      ],
    );

    expect(result.calculation).toMatchObject({
      quantity: 3,
      unitPriceToman: 20_000,
      lineTotalToman: 60_000,
      totalToman: 65_000,
      priceType: "cafe",
    });
    expect(result.content).toContain("نرخ‌نامه رسمی");
  });

  test("never invents a price when the rate is not approved", () => {
    const result = buildPricingResult(
      { _id: serviceId, name: "پرینت", unit: "برگ" },
      { status: "needs_review", price: null },
      2,
      undefined,
    );

    expect(result.calculation).toBeNull();
    expect(result.content).toContain("مبلغ ساختگی اعلام نمی‌کنم");
  });

  test("detects pricing intent and reads quantities next to the unit", () => {
    expect(hasPricingIntent("هزینه پرینت چقدر است؟")).toBe(true);
    expect(hasPricingIntent("سلام، خوبی؟")).toBe(false);
    expect(extractQuantity("۵ برگ پرینت می‌خواهم", "برگ")).toBe(5);
    expect(extractQuantity("پرینت می‌خواهم", "برگ")).toBe(1);
  });
});

describe("service price resolution", () => {
  test("uses a valid platform base price and rejects expired or future rates", () => {
    expect(resolveServicePrice(serviceDoc(), null, NOW)).toMatchObject({
      status: "available",
      price: { priceToman: 100_000, isCafeOverride: false },
    });
    expect(
      resolveServicePrice(
        serviceDoc({ validUntil: NOW - 1 }),
        null,
        NOW,
      ).status,
    ).toBe("expired");
    expect(
      resolveServicePrice(
        serviceDoc({ validFrom: NOW + 1 }),
        null,
        NOW,
      ).status,
    ).toBe("future");
    expect(
      resolveServicePrice(serviceDoc({ priceStatus: "needs_review" }), null, NOW)
        .status,
    ).toBe("needs_review");
  });

  test("applies fixed, percent and amount markup overrides", () => {
    expect(resolveServicePrice(serviceDoc(), overrideDoc(), NOW)).toMatchObject({
      status: "available",
      price: { priceToman: 80_000, isCafeOverride: true },
    });
    expect(
      resolveServicePrice(
        serviceDoc(),
        overrideDoc({
          priceMode: "markup_percent",
          priceToman: undefined,
          markupPercent: 25,
        }),
        NOW,
      ),
    ).toMatchObject({ status: "available", price: { priceToman: 125_000 } });
    expect(
      resolveServicePrice(
        serviceDoc(),
        overrideDoc({
          priceMode: "markup_toman",
          priceToman: undefined,
          markupToman: 15_000,
        }),
        NOW,
      ),
    ).toMatchObject({ status: "available", price: { priceToman: 115_000 } });
  });

  test("an expired cafe override does not silently fall back to the base price", () => {
    expect(
      resolveServicePrice(
        serviceDoc(),
        overrideDoc({ validUntil: NOW - 1 }),
        NOW,
      ),
    ).toEqual({ status: "expired", price: null });
    expect(
      resolveServicePrice(
        serviceDoc(),
        overrideDoc({ validFrom: NOW + 1 }),
        NOW,
      ),
    ).toEqual({ status: "future", price: null });
  });
});
