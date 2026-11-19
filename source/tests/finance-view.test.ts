import { expect, test } from "vitest";
import type { LedgerItem } from "../src/lib/inventory";
import {
  financeTotals,
  financeSeries,
  inPeriod,
  periodStart,
} from "../src/lib/finance-view";
import { serializeCsv } from "../src/lib/csv";
const row = (changes: Partial<LedgerItem> = {}): LedgerItem => ({
  id: "fixture",
  title: "کار آزمون",
  direction: "income",
  category: "سایر",
  method: "نقدی",
  amountToman: 100,
  note: null,
  occurredAt: Date.parse("2026-11-19T10:00:00Z"),
  operatorName: "کاربر",
  isVoided: false,
  createdAt: 0,
  ...changes,
});
test("financial periods change at midnight in Tehran, independent of the browser timezone", () => {
  const now = Date.parse("2026-11-19T20:35:00Z");
  expect(
    inPeriod(
      row({ occurredAt: Date.parse("2026-11-19T20:31:00Z") }),
      "today",
      Date.parse("2026-11-19T20:29:00Z"),
    ),
  ).toBe(false);
  expect(periodStart("today", now)).toBe(Date.parse("2026-11-19T20:30:00Z"));
  expect(
    inPeriod(
      row({ occurredAt: Date.parse("2026-11-19T20:29:59Z") }),
      "today",
      now,
    ),
  ).toBe(false);
  expect(
    inPeriod(
      row({ occurredAt: Date.parse("2026-11-19T20:30:00Z") }),
      "today",
      now,
    ),
  ).toBe(true);
});
test("dashboard totals and average omit voided entries and handle an expense-only ledger", () => {
  expect(
    financeTotals([
      row(),
      row({ amountToman: 300 }),
      row({ direction: "expense", amountToman: 40 }),
      row({ isVoided: true, amountToman: 900 }),
    ]),
  ).toMatchObject({
    income: 400,
    expense: 40,
    balance: 360,
    sales: 2,
    count: 3,
    average: 200,
    voided: 1,
  });
  expect(financeTotals([row({ direction: "expense" })])).toMatchObject({
    average: 0,
    balance: -100,
  });
});
test("the chart contains real day buckets and never includes voided or out-of-range amounts", () => {
  const now = Date.parse("2026-11-19T18:00:00Z");
  const series = financeSeries(
    [
      row(),
      row({ direction: "expense", amountToman: 30 }),
      row({ isVoided: true, amountToman: 900 }),
      row({ occurredAt: Date.parse("2026-10-01T10:00:00Z"), amountToman: 600 }),
    ],
    "week",
    now,
  );
  expect(series).toHaveLength(7);
  expect(series.reduce((n, x) => n + x.income, 0)).toBe(100);
  expect(series.reduce((n, x) => n + x.expense, 0)).toBe(30);
  expect(series.at(-1)).toMatchObject({ income: 100, expense: 30 });
});
test("the daily view uses twelve two-hour buckets without losing the first minute of the Iran day", () => {
  const now = Date.parse("2026-11-19T21:00:00Z"),
    series = financeSeries(
      [
        row({
          occurredAt: Date.parse("2026-11-19T20:30:00Z"),
          amountToman: 17,
        }),
      ],
      "today",
      now,
    );
  expect(series).toHaveLength(12);
  expect(series[0].income).toBe(17);
  expect(series.reduce((n, x) => n + x.income, 0)).toBe(17);
});
test("exported finance titles and notes cannot become spreadsheet formulas", () => {
  const csv = serializeCsv(
    ["عنوان", "مبلغ", "یادداشت"],
    [['=HYPERLINK("https://example.test")', -120, "@SUM(A1)"]],
  );
  expect(csv).toContain("\"'=HYPERLINK");
  expect(csv).toContain('"-120"');
  expect(csv).toContain('"\'@SUM(A1)"');
});
