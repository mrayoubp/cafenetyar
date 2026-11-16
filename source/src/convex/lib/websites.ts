import { fail } from "./validation";

export const WEBSITE_ICON_KEYS = [
  "landmark",
  "scale",
  "banknote",
  "clipboard",
  "graduation",
  "briefcase",
  "car",
  "shield",
  "receipt",
  "wifi",
  "home",
  "grid",
] as const;

export type WebsiteIconKey = (typeof WEBSITE_ICON_KEYS)[number];

export const WEBSITE_TONES = ["navy", "mint", "peach", "lilac"] as const;
export type WebsiteTone = (typeof WEBSITE_TONES)[number];

export function isWebsiteIcon(value: string): value is WebsiteIconKey {
  return (WEBSITE_ICON_KEYS as readonly string[]).includes(value);
}

export function isWebsiteTone(value: string): value is WebsiteTone {
  return (WEBSITE_TONES as readonly string[]).includes(value);
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.includes(":") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  );
}

function normalizePublicHttpUrl(
  value: string,
  label: string,
  options: { stripQuery: boolean; maxLength: number },
) {
  const text = value.trim();
  if (!text) fail("validation", `${label} الزامی است.`);
  if (text.length > options.maxLength) {
    fail("validation", `${label} بیش از حد طولانی است.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    fail("validation", `${label} معتبر نیست؛ نشانی کامل را وارد کنید.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    fail("validation", `${label} باید با http یا https شروع شود.`);
  }
  if (parsed.username || parsed.password) {
    fail("validation", `${label} نباید نام کاربری یا رمز داشته باشد.`);
  }
  if (isPrivateHost(parsed.hostname)) {
    fail(
      "validation",
      `${label} باید یک دامنه عمومی اینترنتی باشد؛ نشانی‌های محلی پذیرفته نمی‌شوند.`,
    );
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  if (options.stripQuery) {
    parsed.search = "";
    parsed.hash = "";
  }
  return parsed.toString();
}

/** Normalizes a public system URL and removes tracking/query parameters. */
export function normalizeWebsiteUrl(value: string, label = "آدرس سامانه") {
  return normalizePublicHttpUrl(value, label, {
    stripQuery: true,
    maxLength: 800,
  });
}

export function normalizeOptionalWebsiteUrl(
  value: string | undefined,
  label: string,
) {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  return normalizeWebsiteUrl(text, label);
}

export function normalizeLogoUrl(value: string | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  return normalizePublicHttpUrl(text, "آدرس لوگو", {
    stripQuery: false,
    maxLength: 1200,
  });
}

export function domainLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatWebsiteCheckMessage(status: number | null, ok: boolean) {
  if (ok) return "نشانی سامانه پاسخ داد و برای استفاده ثبت شد.";
  if (status) return `نشانی سامانه پاسخ ناموفق داد (HTTP ${status}).`;
  return "بررسی نشانی سامانه انجام نشد؛ اتصال یا دامنه را بررسی کنید.";
}
