import type { Id } from "./ids";
import type { AgentCalculation } from "./api";
import { normalizeFa, tokenize } from "./knowledge";
import { PRICE_TYPE_LABELS, type PriceResolution } from "./pricing";

export const AGENT_MODEL = "gpt-4o-mini";

const numberFormatter = new Intl.NumberFormat("fa-IR");

export function faAmount(value: number) {
  return `${numberFormatter.format(Math.round(value))} تومان`;
}

const PRICING_WORDS = [
  "هزینه",
  "قیمت",
  "نرخ",
  "مبلغ",
  "چقدر",
  "تومان",
  "محاسبه",
  "تعرفه",
];

export function hasPricingIntent(message: string) {
  const normalized = normalizeFa(message);
  return PRICING_WORDS.some((word) => normalized.includes(word));
}

/** Reads the first plausible quantity, preferring a number next to the unit. */
export function extractQuantity(message: string, unit?: string) {
  const normalized = normalizeFa(message).replace(/,/g, "");
  if (unit) {
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const unitMatch = normalized.match(
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escaped}`),
    );
    if (unitMatch) return clampQuantity(Number(unitMatch[1]));
  }
  const numbers = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(\S*)/g)];
  for (const number of numbers) {
    const nextToken = number[2] ?? "";
    if (/^(هزار|تومان|ریال|درصد)$/.test(nextToken)) continue;
    const value = Number(number[1]);
    if (Number.isFinite(value) && value > 0 && value <= 10_000) {
      return clampQuantity(value);
    }
  }
  return 1;
}

function clampQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(10_000, Math.max(1, Math.round(value)));
}

export function matchService<
  T extends { id: string; name: string; description: string },
>(message: string, services: T[]): T | null {
  const tokens = tokenize(message);
  if (tokens.length === 0) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const service of services) {
    const serviceTokens = new Set(
      tokenize(`${service.name} ${service.description}`),
    );
    let score = 0;
    for (const token of tokens) {
      if (serviceTokens.has(token)) score += 3;
      else if (
        [...serviceTokens].some(
          (candidate) =>
            candidate.startsWith(token) || token.startsWith(candidate),
        )
      ) {
        score += 1;
      }
    }
    if (score > bestScore) {
      best = service;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

export function buildPricingResult(
  service: { _id: Id<"services">; name: string; unit: string },
  resolution: PriceResolution,
  quantity: number,
  sourceName: string | undefined,
  requestedAddons: {
    _id: Id<"services">;
    name: string;
    unit: string;
    priceToman: number;
  }[] = [],
): {
  content: string;
  calculation: AgentCalculation | null;
} {
  if (resolution.status !== "available") {
    const reasons: Record<string, string> = {
      missing: "نرخ ثبت‌شده‌ای برای این خدمت وجود ندارد.",
      needs_review:
        "نرخ این خدمت تأیید نشده یا نیازمند بررسی و به‌روزرسانی است.",
      inactive: "این خدمت یا نرخ آن غیرفعال شده است.",
      expired: "اعتبار نرخ ثبت‌شده برای این خدمت به پایان رسیده است.",
      future: "نرخ ثبت‌شده هنوز شروع اعتبار نشده است.",
    };
    return {
      calculation: null,
      content: `برای «${service.name}» نمی‌توانم مبلغ قطعی اعلام کنم؛ ${
        reasons[resolution.status] ?? "نرخ معتبری در دسترس نیست."
      }\n\nلطفاً نرخ را از منبع رسمی یا مدیر کافی‌نت بررسی کنید. من مبلغ ساختگی اعلام نمی‌کنم.`,
    };
  }

  const baseTotal = resolution.price.priceToman * quantity;
  const addons = requestedAddons.slice(0, 4).map((addon) => ({
    serviceId: addon._id,
    serviceName: addon.name,
    quantity: 1,
    unit: addon.unit,
    unitPriceToman: addon.priceToman,
    lineTotalToman: addon.priceToman,
  }));
  const addonTotal = addons.reduce(
    (sum, addon) => sum + addon.lineTotalToman,
    0,
  );
  const total = baseTotal + addonTotal;
  const calculation: AgentCalculation = {
    serviceId: service._id,
    serviceName: service.name,
    quantity,
    unit: service.unit,
    unitPriceToman: resolution.price.priceToman,
    lineTotalToman: baseTotal,
    totalToman: total,
    priceType: resolution.price.priceType,
    addons: addons.length > 0 ? addons : undefined,
    sourceName,
    validUntil: resolution.price.validUntil ?? undefined,
  };
  const sourceLabel = sourceName ? `\nمنبع نرخ: ${sourceName}` : "";
  const addonLines = addons
    .map((addon) => `• ${addon.serviceName}: ${faAmount(addon.unitPriceToman)}`)
    .join("\n");
  const validity = resolution.price.validUntil
    ? `\nاعتبار نرخ تا: ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(resolution.price.validUntil))}`
    : "";
  return {
    content: `بر اساس نرخ فعال «${service.name}»:\n\n• نرخ هر ${service.unit}: ${faAmount(
      resolution.price.priceToman,
    )}\n• تعداد: ${numberFormatter.format(quantity)} ${service.unit}\n• مبلغ خدمت اصلی: ${faAmount(
      baseTotal,
    )}${addons.length > 0 ? `\n\nخدمات جانبی درخواستی:\n${addonLines}\n• جمع خدمات جانبی: ${faAmount(addonTotal)}` : ""}\n• مبلغ نهایی: ${faAmount(
      total,
    )}\n\nنوع نرخ: ${PRICE_TYPE_LABELS[resolution.price.priceType]}${
      resolution.price.isCafeOverride ? " (اختصاصی همین کافی‌نت)" : ""
    }${sourceLabel}${validity}\n\nاین محاسبه فقط بر اساس نرخ‌های ثبت‌شده انجام شده است.`,
    calculation,
  };
}

export function buildSystemPrompt() {
  return `شما «دستیار هوشمند کافی‌نت‌یار» هستید؛ یک دستیار تخصصی فارسی برای صاحبان و کارمندان کافی‌نت.

قواعد قطعی:
- همیشه فارسی، روان، مرتب و مرحله‌به‌مرحله پاسخ بده.
- فقط از «اطلاعات تأییدشده» و «نرخ‌های معتبر» که در پیام سیستم آمده استفاده کن.
- هیچ مهلت، مدرک، مرحله ثبت‌نام، هزینه یا شماره تماسی را از خودت نساز. اگر در اطلاعات نیست، صریح بگو «اطلاعات قطعی و به‌روز در پایگاه دانش موجود نیست» و کاربر را به منبع رسمی راهنمایی کن.
- اطلاعات رسمی را با برچسب «اطلاعات رسمی» و توصیه عمومی را با برچسب «راهنمای عمومی» جدا کن. توصیه عمومی باید کلی باشد و شامل جزئیات قابل تغییر مثل مبلغ یا مهلت نشود.
- هرگز رمز عبور، کد یک‌بارمصرف، CVV یا اطلاعات کامل کارت بانکی درخواست نکن و از کاربر نخواه ثبت کند.
- هیچ اقدام نهایی مثل ارسال فرم یا ثبت درخواست انجام نده؛ فقط راهنمایی کن.
- اگر نرخ معتبر نیست، مبلغ اعلام نکن.
- در پایان پاسخ، در صورت وجود منبع، کاربر را به مطالعه منبع دعوت کن.
- پاسخ حداکثر ۳۵۰ کلمه باشد و از فهرست‌های کوتاه استفاده کن.`;
}
