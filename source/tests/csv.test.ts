import { describe, expect, test } from "vitest";
import { csvCell, serializeCsv } from "../src/lib/csv";

describe("CSV export", () => {
  test("quotes commas, quotes and line breaks safely", () => {
    expect(csvCell('name, "quoted"\nline')).toBe(
      '"name, ""quoted""\nline"',
    );
  });

  test("neutralizes spreadsheet formulas in text cells", () => {
    for (const value of [
      "=HYPERLINK(\"https://evil.example\")",
      "+1+1",
      "-2+3",
      "@SUM(A1:A2)",
      "\t=1+1",
      "\r=1+1",
      "  =1+1",
    ]) {
      expect(csvCell(value).startsWith('"\'')).toBe(true);
    }
  });

  test("does not corrupt numeric values", () => {
    expect(csvCell(-1200)).toBe('"-1200"');
    expect(serializeCsv(["amount"], [[-1200]])).toBe(
      '"amount"\r\n"-1200"',
    );
  });

  test("escapes headers and preserves columns", () => {
    expect(
      serializeCsv(
        ["نام", "شماره"],
        [["کافی‌نت, مرکزی", "09120000000"]],
      ),
    ).toBe('"نام","شماره"\r\n"کافی‌نت, مرکزی","09120000000"');
  });
});
