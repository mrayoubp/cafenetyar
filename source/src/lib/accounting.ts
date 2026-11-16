export const ACCOUNTING_DIRECTIONS = ["income", "expense"] as const;
export type AccountingDirection = (typeof ACCOUNTING_DIRECTIONS)[number];

export const ACCOUNTING_CATEGORIES = [
  "شارژ و خدمات",
  "اینترنت",
  "بوفه",
  "تجهیزات",
  "حقوق و دستمزد",
  "اجاره",
  "قبوض",
  "سایر",
] as const;

export const ACCOUNTING_PAYMENT_METHODS = [
  "نقدی",
  "کارت به کارت",
  "درگاه پرداخت",
  "کیف پول",
  "سایر",
] as const;

export const ACCOUNTING_DIRECTION_LABELS: Record<AccountingDirection, string> = {
  income: "درآمد",
  expense: "هزینه",
};

export function isAccountingCategory(value: string): boolean {
  return (ACCOUNTING_CATEGORIES as readonly string[]).includes(value);
}

export function isAccountingPaymentMethod(value: string): boolean {
  return (ACCOUNTING_PAYMENT_METHODS as readonly string[]).includes(value);
}
