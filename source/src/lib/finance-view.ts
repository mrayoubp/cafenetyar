import type { LedgerItem } from "./inventory";
export type FinancePeriod = "today" | "week" | "month" | "all";
export const periods: { key: FinancePeriod; label: string }[] = [
  { key: "all", label: "همهٔ زمان‌ها" },
  { key: "today", label: "امروز" },
  { key: "week", label: "۷ روز اخیر" },
  { key: "month", label: "۳۰ روز اخیر" },
];
const DAY = 86400000,
  OFFSET = 12600000;
export const iranDay = (timestamp: number) =>
  Math.floor((timestamp + OFFSET) / DAY) * DAY - OFFSET;
export function periodStart(period: FinancePeriod, now = Date.now()) {
  const today = iranDay(now);
  return period === "all"
    ? 0
    : today - (period === "week" ? 6 : period === "month" ? 29 : 0) * DAY;
}
export function inPeriod(
  item: LedgerItem,
  period: FinancePeriod,
  now = Date.now(),
) {
  return (
    item.occurredAt >= periodStart(period, now) &&
    item.occurredAt <= now + 300000 &&
    (period === "all" || item.occurredAt < iranDay(now) + DAY)
  );
}
export function financeTotals(items: LedgerItem[]) {
  const live = items.filter((x) => !x.isVoided),
    income = live.filter((x) => x.direction === "income"),
    expense = live.filter((x) => x.direction === "expense");
  const received = income.reduce((n, x) => n + x.amountToman, 0),
    spent = expense.reduce((n, x) => n + x.amountToman, 0);
  return {
    income: received,
    expense: spent,
    balance: received - spent,
    sales: income.length,
    count: live.length,
    average: income.length ? Math.round(received / income.length) : 0,
    voided: items.length - live.length,
  };
}
export function financeSeries(
  items: LedgerItem[],
  period: FinancePeriod,
  now = Date.now(),
) {
  const hourly = period === "today",
    length = hourly ? 12 : period === "month" ? 30 : period === "all" ? 14 : 7,
    step = hourly ? 7200000 : DAY;
  const start = hourly ? iranDay(now) : iranDay(now) - (length - 1) * DAY;
  return Array.from({ length }, (_, i) => {
    const from = start + i * step,
      to = from + step,
      rows = items.filter(
        (x) => !x.isVoided && x.occurredAt >= from && x.occurredAt < to,
      );
    return {
      label: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        timeZone: "Asia/Tehran",
        ...(hourly
          ? { hour: "2-digit" }
          : length > 14
            ? { day: "numeric" }
            : { weekday: "short" }),
      }).format(from),
      income: rows
        .filter((x) => x.direction === "income")
        .reduce((n, x) => n + x.amountToman, 0),
      expense: rows
        .filter((x) => x.direction === "expense")
        .reduce((n, x) => n + x.amountToman, 0),
    };
  });
}
export const financeDate = (value: number) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
export const financeTime = (value: number) =>
  new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
export const shortDocumentId = (id: string) =>
  id
    .replace(/^native:/, "")
    .slice(0, 8)
    .toUpperCase();
