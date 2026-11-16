import { ConvexError } from "convex/values";
import { isIranProvince } from "../provinces";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const fa = PERSIAN_DIGITS.indexOf(char);
    if (fa >= 0) return String(fa);
    return String(ARABIC_DIGITS.indexOf(char));
  });
}

/** Normalizes Iranian mobile numbers to 09XXXXXXXXX. Returns null if invalid. */
export function normalizePhone(input: string): string | null {
  let value = toLatinDigits(input ?? "")
    .replace(/[\s\-()]/g, "")
    .trim();
  if (value.startsWith("+98")) value = `0${value.slice(3)}`;
  else if (value.startsWith("0098")) value = `0${value.slice(4)}`;
  else if (value.startsWith("98") && value.length === 12)
    value = `0${value.slice(2)}`;
  else if (value.startsWith("9") && value.length === 10) value = `0${value}`;

  if (!/^09\d{9}$/.test(value)) return null;
  return value;
}

/** Internal account identifier; mobile numbers are never valid emails. */
export function internalEmail(phone: string): string {
  return `${phone}@phone.kafinet.local`;
}

/** Used for display only, never as a credential. */
export function maskPhone(phone: string): string {
  if (!/^09\d{9}$/.test(phone)) return phone;
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export function requireText(
  value: unknown,
  label: string,
  min: number,
  max: number,
): string {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (text.length < min) {
    fail("validation", `${label} باید حداقل ${min} نویسه باشد.`);
  }
  if (text.length > max) {
    fail("validation", `${label} نباید بیشتر از ${max} نویسه باشد.`);
  }
  return text;
}

export function requirePhone(input: unknown): string {
  const phone = normalizePhone(typeof input === "string" ? input : "");
  if (!phone) {
    fail("validation", "شماره موبایل معتبر نیست؛ نمونه درست: ۰۹۱۲۳۴۵۶۷۸۹.");
  }
  return phone;
}

export function requirePassword(value: unknown, label = "رمز عبور"): string {
  const password = typeof value === "string" ? value : "";
  if (password.length < 8) {
    fail("validation", `${label} باید حداقل ۸ نویسه باشد.`);
  }
  if (password.length > 72) {
    fail("validation", `${label} نباید بیشتر از ۷۲ نویسه باشد.`);
  }
  if (!/[A-Za-z\u0600-\u06FF]/.test(password) || !/\d/.test(password)) {
    fail("validation", `${label} باید هم حرف و هم رقم داشته باشد.`);
  }
  return password;
}

export type RegistrationInput = {
  fullName: string;
  phone: string;
  password: string;
  cafeName: string;
  province: string;
  city: string;
  address: string;
  acceptedTerms: boolean;
};

export function validateRegistration(input: {
  fullName: unknown;
  phone: unknown;
  password: unknown;
  confirmPassword?: unknown;
  cafeName: unknown;
  province: unknown;
  city: unknown;
  address: unknown;
  acceptedTerms: unknown;
}): RegistrationInput {
  if (input.acceptedTerms !== true) {
    fail("terms", "برای ساخت حساب باید قوانین و شرایط استفاده را بپذیرید.");
  }
  if (
    typeof input.confirmPassword === "string" &&
    input.confirmPassword !== input.password
  ) {
    fail("validation", "رمز عبور و تکرار آن یکسان نیستند.");
  }
  const fullName = requireText(input.fullName, "نام و نام خانوادگی", 3, 60);
  if (!fullName.includes(" ")) {
    fail("validation", "نام و نام خانوادگی را کامل وارد کنید.");
  }
  return {
    fullName,
    phone: requirePhone(input.phone),
    password: requirePassword(input.password),
    cafeName: requireText(input.cafeName, "نام کافی‌نت", 2, 80),
    province: requireProvince(input.province),
    city: requireText(input.city, "شهر", 2, 40),
    address: requireText(input.address, "آدرس کافی‌نت", 5, 200),
    acceptedTerms: true,
  };
}

export function validateCafeInput(input: {
  name: unknown;
  province: unknown;
  city: unknown;
  address: unknown;
}) {
  return {
    name: requireText(input.name, "نام کافی‌نت", 2, 80),
    province: requireProvince(input.province),
    city: requireText(input.city, "شهر", 2, 40),
    address: requireText(input.address, "آدرس کافی‌نت", 5, 200),
  };
}

export function requireProvince(input: unknown): string {
  const province = typeof input === "string" ? input.trim() : "";
  if (!isIranProvince(province)) {
    fail("validation", "استان انتخاب‌شده معتبر نیست.");
  }
  return province;
}

export function validateName(value: unknown): string {
  return requireText(value, "نام و نام خانوادگی", 3, 60);
}
