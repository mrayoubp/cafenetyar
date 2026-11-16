const numberFormatter = new Intl.NumberFormat("fa-IR");

/** Persian digits with grouping separators. */
export function faNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Persian amount with the toman suffix. */
export function faToman(value: number): string {
  return `${faNumber(value)} تومان`;
}

/** Long Persian (Jalali) date used in the dashboard greeting. */
export function faToday(): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/** Short Persian date, only used for demo timestamps. */
export function faDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
  }).format(date);
}

/** Full Persian (Jalali) date with year, for account and subscription data. */
export function faDateLong(value: number | Date): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

/** Persian calendar date plus clock, used by the newsroom. */
export function faDateTime(value: number | Date): string {
  if (!value) return "زمان انتشار نامشخص";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Relative label for compact news cards. */
export function faRelativeTime(value: number, now: number): string {
  if (!value) return "زمان نامشخص";
  const seconds = Math.max(0, Math.round((now - value) / 1000));
  if (seconds < 60) return "همین حالا";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${faNumber(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${faNumber(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${faNumber(days)} روز پیش`;
  return faDateLong(value);
}

/** Short Persian clock label. */
export function faTime(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
