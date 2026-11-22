// source/src/backend/validation.ts
function fail(code, message) {
  throw new Error(message);
}

// source/src/backend/pricing.ts
function validatePriceToman(value, label) {
  if (value === void 0) return void 0;
  if (!Number.isFinite(value) || value < 0 || value > 1e12) {
    fail("validation", `${label} \u0628\u0627\u06CC\u062F \u06CC\u06A9 \u0645\u0628\u0644\u063A \u0645\u0639\u062A\u0628\u0631 \u0648 \u063A\u06CC\u0631\u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F.`);
  }
  return Math.round(value);
}
function validatePriceValidity(validFrom, validUntil) {
  if (validFrom !== void 0 && (!Number.isFinite(validFrom) || validFrom < 0)) {
    fail("validation", "\u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639 \u0627\u0639\u062A\u0628\u0627\u0631 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  }
  if (validUntil !== void 0 && (!Number.isFinite(validUntil) || validUntil < 0)) {
    fail("validation", "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u0627\u0639\u062A\u0628\u0627\u0631 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  }
  if (validFrom !== void 0 && validUntil !== void 0 && validUntil < validFrom) {
    fail("validation", "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u0627\u0639\u062A\u0628\u0627\u0631 \u0646\u0628\u0627\u06CC\u062F \u0642\u0628\u0644 \u0627\u0632 \u0634\u0631\u0648\u0639 \u0628\u0627\u0634\u062F.");
  }
  return {
    validFrom: validFrom === void 0 ? void 0 : Math.trunc(validFrom),
    validUntil: validUntil === void 0 ? void 0 : Math.trunc(validUntil)
  };
}
function resolveBasePrice(service, now) {
  if (service.priceStatus === "inactive") {
    return { status: "inactive", price: null };
  }
  if (service.priceStatus === "needs_review" || service.basePriceToman === void 0) {
    return { status: "needs_review", price: null };
  }
  if (service.validFrom !== void 0 && service.validFrom > now) {
    return { status: "future", price: null };
  }
  if (service.validUntil !== void 0 && service.validUntil < now) {
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
      isCafeOverride: false
    }
  };
}
function resolveServicePrice(service, override, now) {
  if (!service.isActive) return { status: "inactive", price: null };
  if (!override) return resolveBasePrice(service, now);
  if (override.status === "inactive") {
    return { status: "inactive", price: null };
  }
  if (override.validFrom !== void 0 && override.validFrom > now) {
    return { status: "future", price: null };
  }
  if (override.validUntil !== void 0 && override.validUntil < now) {
    return { status: "expired", price: null };
  }
  if (override.status === "needs_review") {
    return { status: "needs_review", price: null };
  }
  const mode = override.priceMode ?? "fixed";
  if (mode === "fixed") {
    if (override.priceToman === void 0) {
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
        isCafeOverride: true
      }
    };
  }
  const base = resolveBasePrice(service, now);
  if (base.status !== "available") return base;
  let finalPrice;
  if (mode === "markup_percent") {
    if (override.markupPercent === void 0 || !Number.isFinite(override.markupPercent) || override.markupPercent < 0) {
      return { status: "needs_review", price: null };
    }
    finalPrice = Math.round(
      base.price.priceToman * (1 + override.markupPercent / 100)
    );
  } else {
    if (override.markupToman === void 0 || !Number.isFinite(override.markupToman) || override.markupToman < 0) {
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
      markupPercent: mode === "markup_percent" ? override.markupPercent : null,
      markupToman: mode === "markup_toman" ? override.markupToman : null,
      sourceId: override.sourceId ?? base.price.sourceId,
      validFrom: override.validFrom ?? base.price.validFrom,
      validUntil: override.validUntil ?? base.price.validUntil,
      isCafeOverride: true
    }
  };
}
var PRICE_TYPE_LABELS = {
  official: "\u0631\u0633\u0645\u06CC",
  suggested: "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC",
  custom: "\u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A"
};
var PRICE_STATUS_LABELS = {
  active: "\u0641\u0639\u0627\u0644",
  needs_review: "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u0648 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC",
  inactive: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644"
};

// source/src/backend/knowledge.ts
var STOP_WORDS = /* @__PURE__ */ new Set([
  "\u0628\u0631\u0627\u06CC",
  "\u0627\u0632",
  "\u0628\u0647",
  "\u0628\u0627",
  "\u062F\u0631",
  "\u06A9\u0647",
  "\u0627\u06CC\u0646",
  "\u0622\u0646",
  "\u0627\u0633\u062A",
  "\u0647\u0633\u062A",
  "\u0686\u0647",
  "\u0686\u06CC",
  "\u0686\u06AF\u0648\u0646\u0647",
  "\u06A9\u062F\u0627\u0645",
  "\u0645\u06CC",
  "\u0634\u0648\u062F",
  "\u06A9\u0646\u0645",
  "\u06A9\u0646\u06CC\u062F",
  "\u0628\u0627\u06CC\u062F",
  "\u0644\u0627\u0632\u0645",
  "\u06CC\u06A9",
  "\u0648",
  "\u06CC\u0627",
  "\u0647\u0645",
  "\u0631\u0627",
  "\u062A\u0627",
  "\u0628\u0631",
  "\u06A9\u0631\u062F\u0646",
  "\u0634\u062F\u0647"
]);
function normalizeFa(value) {
  return value.replace(/ي/g, "\u06CC").replace(/ك/g, "\u06A9").replace(/[۰-۹]/g, (digit) => String("\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(digit))).toLocaleLowerCase("fa");
}
function tokenize(value) {
  return normalizeFa(value).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}
function chunkKnowledge(content, maxLength = 850) {
  const paragraphs = content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if (`${current}

${paragraph}`.length <= maxLength) {
      current = `${current}

${paragraph}`;
      continue;
    }
    chunks.push(current);
    current = paragraph;
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength * 1.4) return [chunk];
    const sentences = chunk.split(/(?<=[.!؟?])\s+/);
    const parts = [];
    let part = "";
    for (const sentence of sentences) {
      if (`${part} ${sentence}`.trim().length > maxLength && part) {
        parts.push(part);
        part = sentence;
      } else {
        part = `${part} ${sentence}`.trim();
      }
    }
    if (part) parts.push(part);
    return parts;
  });
}
function scoreKnowledgeChunk(query, title, summary, tags, chunk) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;
  const titleTokens = new Set(
    tokenize(`${title} ${summary} ${tags.join(" ")}`)
  );
  const chunkTokens = new Set(tokenize(chunk));
  let score = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 5;
    if (chunkTokens.has(token)) score += 2;
    if ([...titleTokens].some(
      (candidate) => candidate.startsWith(token) || token.startsWith(candidate)
    )) {
      score += 1;
    }
  }
  return score;
}

// source/src/backend/agent.ts
var AGENT_MODEL = "gpt-4o-mini";
var numberFormatter = new Intl.NumberFormat("fa-IR");
function faAmount(value) {
  return `${numberFormatter.format(Math.round(value))} \u062A\u0648\u0645\u0627\u0646`;
}
var PRICING_WORDS = [
  "\u0647\u0632\u06CC\u0646\u0647",
  "\u0642\u06CC\u0645\u062A",
  "\u0646\u0631\u062E",
  "\u0645\u0628\u0644\u063A",
  "\u0686\u0642\u062F\u0631",
  "\u062A\u0648\u0645\u0627\u0646",
  "\u0645\u062D\u0627\u0633\u0628\u0647",
  "\u062A\u0639\u0631\u0641\u0647"
];
function hasPricingIntent(message) {
  const normalized = normalizeFa(message);
  return PRICING_WORDS.some((word) => normalized.includes(word));
}
function extractQuantity(message, unit) {
  const normalized = normalizeFa(message).replace(/,/g, "");
  if (unit) {
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const unitMatch = normalized.match(
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escaped}`)
    );
    if (unitMatch) return clampQuantity(Number(unitMatch[1]));
  }
  const numbers = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(\S*)/g)];
  for (const number of numbers) {
    const nextToken = number[2] ?? "";
    if (/^(هزار|تومان|ریال|درصد)$/.test(nextToken)) continue;
    const value = Number(number[1]);
    if (Number.isFinite(value) && value > 0 && value <= 1e4) {
      return clampQuantity(value);
    }
  }
  return 1;
}
function clampQuantity(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(1e4, Math.max(1, Math.round(value)));
}
function matchService(message, services) {
  const tokens = tokenize(message);
  if (tokens.length === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const service of services) {
    const serviceTokens = new Set(
      tokenize(`${service.name} ${service.description}`)
    );
    let score = 0;
    for (const token of tokens) {
      if (serviceTokens.has(token)) score += 3;
      else if ([...serviceTokens].some(
        (candidate) => candidate.startsWith(token) || token.startsWith(candidate)
      )) {
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
function buildPricingResult(service, resolution, quantity, sourceName, requestedAddons = []) {
  if (resolution.status !== "available") {
    const reasons = {
      missing: "\u0646\u0631\u062E \u062B\u0628\u062A\u200C\u0634\u062F\u0647\u200C\u0627\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062E\u062F\u0645\u062A \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.",
      needs_review: "\u0646\u0631\u062E \u0627\u06CC\u0646 \u062E\u062F\u0645\u062A \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u06CC\u0627 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u0648 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0627\u0633\u062A.",
      inactive: "\u0627\u06CC\u0646 \u062E\u062F\u0645\u062A \u06CC\u0627 \u0646\u0631\u062E \u0622\u0646 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A.",
      expired: "\u0627\u0639\u062A\u0628\u0627\u0631 \u0646\u0631\u062E \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062E\u062F\u0645\u062A \u0628\u0647 \u067E\u0627\u06CC\u0627\u0646 \u0631\u0633\u06CC\u062F\u0647 \u0627\u0633\u062A.",
      future: "\u0646\u0631\u062E \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0647\u0646\u0648\u0632 \u0634\u0631\u0648\u0639 \u0627\u0639\u062A\u0628\u0627\u0631 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A."
    };
    return {
      calculation: null,
      content: `\u0628\u0631\u0627\u06CC \xAB${service.name}\xBB \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u0645 \u0645\u0628\u0644\u063A \u0642\u0637\u0639\u06CC \u0627\u0639\u0644\u0627\u0645 \u06A9\u0646\u0645\u061B ${reasons[resolution.status] ?? "\u0646\u0631\u062E \u0645\u0639\u062A\u0628\u0631\u06CC \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A."}

\u0644\u0637\u0641\u0627\u064B \u0646\u0631\u062E \u0631\u0627 \u0627\u0632 \u0645\u0646\u0628\u0639 \u0631\u0633\u0645\u06CC \u06CC\u0627 \u0645\u062F\u06CC\u0631 \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u06CC\u062F. \u0645\u0646 \u0645\u0628\u0644\u063A \u0633\u0627\u062E\u062A\u06AF\u06CC \u0627\u0639\u0644\u0627\u0645 \u0646\u0645\u06CC\u200C\u06A9\u0646\u0645.`
    };
  }
  const baseTotal = resolution.price.priceToman * quantity;
  const addons = requestedAddons.slice(0, 4).map((addon) => ({
    serviceId: addon._id,
    serviceName: addon.name,
    quantity: 1,
    unit: addon.unit,
    unitPriceToman: addon.priceToman,
    lineTotalToman: addon.priceToman
  }));
  const addonTotal = addons.reduce(
    (sum, addon) => sum + addon.lineTotalToman,
    0
  );
  const total = baseTotal + addonTotal;
  const calculation = {
    serviceId: service._id,
    serviceName: service.name,
    quantity,
    unit: service.unit,
    unitPriceToman: resolution.price.priceToman,
    lineTotalToman: baseTotal,
    totalToman: total,
    priceType: resolution.price.priceType,
    addons: addons.length > 0 ? addons : void 0,
    sourceName,
    validUntil: resolution.price.validUntil ?? void 0
  };
  const sourceLabel = sourceName ? `
\u0645\u0646\u0628\u0639 \u0646\u0631\u062E: ${sourceName}` : "";
  const addonLines = addons.map((addon) => `\u2022 ${addon.serviceName}: ${faAmount(addon.unitPriceToman)}`).join("\n");
  const validity = resolution.price.validUntil ? `
\u0627\u0639\u062A\u0628\u0627\u0631 \u0646\u0631\u062E \u062A\u0627: ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(resolution.price.validUntil))}` : "";
  return {
    content: `\u0628\u0631 \u0627\u0633\u0627\u0633 \u0646\u0631\u062E \u0641\u0639\u0627\u0644 \xAB${service.name}\xBB:

\u2022 \u0646\u0631\u062E \u0647\u0631 ${service.unit}: ${faAmount(
      resolution.price.priceToman
    )}
\u2022 \u062A\u0639\u062F\u0627\u062F: ${numberFormatter.format(quantity)} ${service.unit}
\u2022 \u0645\u0628\u0644\u063A \u062E\u062F\u0645\u062A \u0627\u0635\u0644\u06CC: ${faAmount(
      baseTotal
    )}${addons.length > 0 ? `

\u062E\u062F\u0645\u0627\u062A \u062C\u0627\u0646\u0628\u06CC \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u06CC:
${addonLines}
\u2022 \u062C\u0645\u0639 \u062E\u062F\u0645\u0627\u062A \u062C\u0627\u0646\u0628\u06CC: ${faAmount(addonTotal)}` : ""}
\u2022 \u0645\u0628\u0644\u063A \u0646\u0647\u0627\u06CC\u06CC: ${faAmount(
      total
    )}

\u0646\u0648\u0639 \u0646\u0631\u062E: ${PRICE_TYPE_LABELS[resolution.price.priceType]}${resolution.price.isCafeOverride ? " (\u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0647\u0645\u06CC\u0646 \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A)" : ""}${sourceLabel}${validity}

\u0627\u06CC\u0646 \u0645\u062D\u0627\u0633\u0628\u0647 \u0641\u0642\u0637 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0646\u0631\u062E\u200C\u0647\u0627\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647 \u0627\u0633\u062A.`,
    calculation
  };
}
function buildSystemPrompt() {
  return `\u0634\u0645\u0627 \xAB\u062F\u0633\u062A\u06CC\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062F \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631\xBB \u0647\u0633\u062A\u06CC\u062F\u061B \u06CC\u06A9 \u062F\u0633\u062A\u06CC\u0627\u0631 \u062A\u062E\u0635\u0635\u06CC \u0641\u0627\u0631\u0633\u06CC \u0628\u0631\u0627\u06CC \u0635\u0627\u062D\u0628\u0627\u0646 \u0648 \u06A9\u0627\u0631\u0645\u0646\u062F\u0627\u0646 \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A.

\u0642\u0648\u0627\u0639\u062F \u0642\u0637\u0639\u06CC:
- \u0647\u0645\u06CC\u0634\u0647 \u0641\u0627\u0631\u0633\u06CC\u060C \u0631\u0648\u0627\u0646\u060C \u0645\u0631\u062A\u0628 \u0648 \u0645\u0631\u062D\u0644\u0647\u200C\u0628\u0647\u200C\u0645\u0631\u062D\u0644\u0647 \u067E\u0627\u0633\u062E \u0628\u062F\u0647.
- \u0641\u0642\u0637 \u0627\u0632 \xAB\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\xBB \u0648 \xAB\u0646\u0631\u062E\u200C\u0647\u0627\u06CC \u0645\u0639\u062A\u0628\u0631\xBB \u06A9\u0647 \u062F\u0631 \u067E\u06CC\u0627\u0645 \u0633\u06CC\u0633\u062A\u0645 \u0622\u0645\u062F\u0647 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.
- \u0647\u06CC\u0686 \u0645\u0647\u0644\u062A\u060C \u0645\u062F\u0631\u06A9\u060C \u0645\u0631\u062D\u0644\u0647 \u062B\u0628\u062A\u200C\u0646\u0627\u0645\u060C \u0647\u0632\u06CC\u0646\u0647 \u06CC\u0627 \u0634\u0645\u0627\u0631\u0647 \u062A\u0645\u0627\u0633\u06CC \u0631\u0627 \u0627\u0632 \u062E\u0648\u062F\u062A \u0646\u0633\u0627\u0632. \u0627\u06AF\u0631 \u062F\u0631 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0646\u06CC\u0633\u062A\u060C \u0635\u0631\u06CC\u062D \u0628\u06AF\u0648 \xAB\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0642\u0637\u0639\u06CC \u0648 \u0628\u0647\u200C\u0631\u0648\u0632 \u062F\u0631 \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u0646\u0634 \u0645\u0648\u062C\u0648\u062F \u0646\u06CC\u0633\u062A\xBB \u0648 \u06A9\u0627\u0631\u0628\u0631 \u0631\u0627 \u0628\u0647 \u0645\u0646\u0628\u0639 \u0631\u0633\u0645\u06CC \u0631\u0627\u0647\u0646\u0645\u0627\u06CC\u06CC \u06A9\u0646.
- \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0631\u0633\u0645\u06CC \u0631\u0627 \u0628\u0627 \u0628\u0631\u0686\u0633\u0628 \xAB\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0631\u0633\u0645\u06CC\xBB \u0648 \u062A\u0648\u0635\u06CC\u0647 \u0639\u0645\u0648\u0645\u06CC \u0631\u0627 \u0628\u0627 \u0628\u0631\u0686\u0633\u0628 \xAB\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0639\u0645\u0648\u0645\u06CC\xBB \u062C\u062F\u0627 \u06A9\u0646. \u062A\u0648\u0635\u06CC\u0647 \u0639\u0645\u0648\u0645\u06CC \u0628\u0627\u06CC\u062F \u06A9\u0644\u06CC \u0628\u0627\u0634\u062F \u0648 \u0634\u0627\u0645\u0644 \u062C\u0632\u0626\u06CC\u0627\u062A \u0642\u0627\u0628\u0644 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u062B\u0644 \u0645\u0628\u0644\u063A \u06CC\u0627 \u0645\u0647\u0644\u062A \u0646\u0634\u0648\u062F.
- \u0647\u0631\u06AF\u0632 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631\u060C \u06A9\u062F \u06CC\u06A9\u200C\u0628\u0627\u0631\u0645\u0635\u0631\u0641\u060C CVV \u06CC\u0627 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u06A9\u0627\u0645\u0644 \u06A9\u0627\u0631\u062A \u0628\u0627\u0646\u06A9\u06CC \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0646\u06A9\u0646 \u0648 \u0627\u0632 \u06A9\u0627\u0631\u0628\u0631 \u0646\u062E\u0648\u0627\u0647 \u062B\u0628\u062A \u06A9\u0646\u062F.
- \u0647\u06CC\u0686 \u0627\u0642\u062F\u0627\u0645 \u0646\u0647\u0627\u06CC\u06CC \u0645\u062B\u0644 \u0627\u0631\u0633\u0627\u0644 \u0641\u0631\u0645 \u06CC\u0627 \u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0627\u0646\u062C\u0627\u0645 \u0646\u062F\u0647\u061B \u0641\u0642\u0637 \u0631\u0627\u0647\u0646\u0645\u0627\u06CC\u06CC \u06A9\u0646.
- \u0627\u06AF\u0631 \u0646\u0631\u062E \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A\u060C \u0645\u0628\u0644\u063A \u0627\u0639\u0644\u0627\u0645 \u0646\u06A9\u0646.
- \u062F\u0631 \u067E\u0627\u06CC\u0627\u0646 \u067E\u0627\u0633\u062E\u060C \u062F\u0631 \u0635\u0648\u0631\u062A \u0648\u062C\u0648\u062F \u0645\u0646\u0628\u0639\u060C \u06A9\u0627\u0631\u0628\u0631 \u0631\u0627 \u0628\u0647 \u0645\u0637\u0627\u0644\u0639\u0647 \u0645\u0646\u0628\u0639 \u062F\u0639\u0648\u062A \u06A9\u0646.
- \u067E\u0627\u0633\u062E \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F3\u06F5\u06F0 \u06A9\u0644\u0645\u0647 \u0628\u0627\u0634\u062F \u0648 \u0627\u0632 \u0641\u0647\u0631\u0633\u062A\u200C\u0647\u0627\u06CC \u06A9\u0648\u062A\u0627\u0647 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.`;
}
export {
  AGENT_MODEL,
  PRICE_STATUS_LABELS,
  PRICE_TYPE_LABELS,
  buildPricingResult,
  buildSystemPrompt,
  chunkKnowledge,
  extractQuantity,
  faAmount,
  hasPricingIntent,
  matchService,
  normalizeFa,
  resolveServicePrice,
  scoreKnowledgeChunk,
  tokenize,
  validatePriceToman,
  validatePriceValidity
};
