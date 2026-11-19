import { expect, test } from "vitest";
import {
  inputNumber,
  rialInputToToman,
  stockLevel,
  toRial,
  validRial,
} from "../src/lib/inventory";
test("rial inputs preserve stored ledger values through an explicit conversion", () => {
  expect(rialInputToToman("۱٬۰۰۰٬۰۰۰")).toBe(100000);
  expect(toRial(100000)).toBe(1000000);
  expect(toRial(rialInputToToman("۱۲۳٬۴۵۰"))).toBe(123450);
  expect(validRial(10000000000)).toBe(true);
});
test("rial validation never silently rounds or accepts malformed amounts", () => {
  for (const text of ["۱۲۳", "۱٫۵", "NaN", "-۱۰", "۱۰۰۰۰۰۰۰۰۱۰"])
    expect(validRial(inputNumber(text))).toBe(false);
  expect(Number.isNaN(rialInputToToman("۱۲۳"))).toBe(true);
  expect(validRial(0)).toBe(true);
});
test("stock meters show empty at zero and a bounded real quantity relative to the warning threshold", () => {
  expect(stockLevel(0, 5)).toEqual({ max: 15, percent: 0 });
  expect(stockLevel(5, 5).percent).toBeCloseTo(33.3333);
  expect(stockLevel(100, 5)).toEqual({ max: 100, percent: 100 });
  expect(stockLevel(0, 0)).toEqual({ max: 1, percent: 0 });
});
