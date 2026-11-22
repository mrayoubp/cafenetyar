

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Converts Persian/Arabic digits to Latin digits. */
export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const fa = PERSIAN_DIGITS.indexOf(char);
    if (fa >= 0) return String(fa);
    return String(ARABIC_DIGITS.indexOf(char));
  });
}

/** Live input mask: digits only, trimmed to 11 characters. */
export function sanitizePhoneInput(value: string): string {
  return toLatinDigits(value)
    .replace(/\D/g, "")
    .slice(0, 11);
}

/** Normalizes user input to 09XXXXXXXXX when possible. */
export function normalizePhone(value: string): string | null {
  let phone = toLatinDigits(value).replace(/[\s\-()]/g, "").trim();
  if (phone.startsWith("+98")) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith("0098")) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith("98") && phone.length === 12)
    phone = `0${phone.slice(2)}`;
  else if (phone.startsWith("9") && phone.length === 10) phone = `0${phone}`;
  return /^09\d{9}$/.test(phone) ? phone : null;
}

/**
 * The login form keys accounts by an email-like identifier. Mobile
 * numbers are mapped to a local, non-routable address that never leaves the
 * app and is never displayed to users.
 */
export function accountEmail(phone: string): string {
  return `${phone}@phone.kafinet.local`;
}

export const PASSWORD_RULE =
  "حداقل ۸ نویسه، شامل حرف و رقم (تا ۷۲ نویسه).";

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 72 &&
    /[A-Za-z\u0600-\u06FF]/.test(password) &&
    /\d/.test(password)
  );
}

export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type ErrorData = { code?: string; message?: string };

/** Extracts a localized message from our own API. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const message = error.message.replace(/^Server Error:\s*/i, "").trim();
    if (/[\u0600-\u06FF]/.test(message)) return message;
    if (/invalid credentials/i.test(message)) {
      return "شماره موبایل یا رمز عبور درست نیست.";
    }
    if (/already exists/i.test(message)) {
      return "این شماره موبایل قبلاً ثبت شده است.";
    }
    if (/invalid password/i.test(message)) return PASSWORD_RULE;
  }
  return fallback;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone || !/^09\d{9}$/.test(phone)) return phone || "—";
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}
