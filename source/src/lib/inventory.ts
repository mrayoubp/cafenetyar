import type { AccountingDirection } from "./accounting";
import { toLatinDigits } from "./auth";
export type CatalogItem = {
  id: string;
  title: string;
  kind: "product" | "service";
  unit: string;
  sku: string;
  priceToman: number;
  costToman: number;
  quantity: number;
  lowStock: number;
  archived: boolean;
  version: number;
};
export type EntryLine = {
  title: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
};
export type LedgerItem = {
  id: string;
  title: string;
  direction: AccountingDirection;
  category: string;
  method: string;
  amountToman: number;
  discountToman?: number;
  note: string | null;
  occurredAt: number;
  operatorName: string;
  isVoided: boolean;
  createdAt: number;
  origin?: "legacy" | "inventory";
  lines?: EntryLine[];
};
export type StockMovement = {
  id: string;
  title: string;
  unit: string;
  delta: number;
  kind: string;
  reason: string;
  createdAt: number;
};
export type AccountingData = {
  items: LedgerItem[];
  summary: {
    incomeToman: number;
    expenseToman: number;
    balanceToman: number;
    todayIncomeToman: number;
    todayExpenseToman: number;
    weekIncomeToman: number;
    weekExpenseToman: number;
    count: number;
    voidedCount: number;
    limitedTo: number;
  };
  catalog: CatalogItem[];
  movements: StockMovement[];
  canWrite: boolean;
  isOwner: boolean;
};
export type CreateEntry = {
  requestId: string;
  title: string;
  amountToman: number;
  direction: AccountingDirection;
  category: string;
  method: string;
  note?: string;
  discountToman?: number;
  lines?: {
    itemId?: string;
    title: string;
    quantity: number;
    unitPrice: number;
  }[];
};
export function inputNumber(value: string) {
  return Number(toLatinDigits(value).replace(/[,٬\s]/g, ""));
}
export function validMoney(value: number, min = 0) {
  return Number.isSafeInteger(value) && value >= min && value <= 1_000_000_000;
}

export function normalizeSearch(value: string) {
  return toLatinDigits(value)
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .trim()
    .toLowerCase();
}
