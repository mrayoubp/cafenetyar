type CsvValue = string | number | null | undefined;

/**
 * Quotes one CSV cell and neutralizes spreadsheet formulas. User-controlled
 * titles/phones must never execute when an admin opens an exported CSV.
 */
export function csvCell(value: CsvValue): string {
  const text = value === null || value === undefined ? "" : String(value);
  const dangerous =
    typeof value === "string" && /^[=+@\-\t\r]/.test(text.trimStart());
  const safe = dangerous ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeCsv(headers: string[], rows: CsvValue[][]): string {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvValue[][],
) {
  const content = serializeCsv(headers, rows);
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
