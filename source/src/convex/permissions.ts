/**
 * Permission keys shared by the Convex backend and the React client.
 * This file must stay free of server-only imports so it can be bundled in the UI.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  ACCOUNTING_VIEW: "accounting.view",
  TRANSACTIONS_WRITE: "transactions.write",
  REPORTS_VIEW: "reports.view",
  NEWS_VIEW: "news.view",
  SITES_VIEW: "sites.view",
  SITES_MANAGE: "sites.manage",
  AGENT_USE: "agent.use",
  RATES_VIEW: "rates.view",
  RATES_MANAGE: "rates.manage",
  KNOWLEDGE_MANAGE: "knowledge.manage",
  EMPLOYEES_MANAGE: "employees.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const PERMISSION_DEFINITIONS: {
  key: PermissionKey;
  label: string;
  description: string;
  available: boolean;
}[] = [
  {
    key: PERMISSIONS.DASHBOARD_VIEW,
    label: "مشاهده داشبورد",
    description: "دیدن نمای کلی، اطلاعیه‌ها و دسترسی‌های سریع.",
    available: true,
  },
  {
    key: PERMISSIONS.ACCOUNTING_VIEW,
    label: "دسترسی به حسابداری",
    description: "ورود به فضای حسابداری و مشاهده تراکنش‌ها.",
    available: true,
  },
  {
    key: PERMISSIONS.TRANSACTIONS_WRITE,
    label: "ثبت درآمد و هزینه",
    description: "افزودن تراکنش جدید در حسابداری.",
    available: true,
  },
  {
    key: PERMISSIONS.REPORTS_VIEW,
    label: "مشاهده گزارش‌های مالی",
    description: "دیدن گزارش‌ها و خلاصه‌های مالی.",
    available: true,
  },
  {
    key: PERMISSIONS.NEWS_VIEW,
    label: "دسترسی به اخبار",
    description: "مشاهده اخبار، اطلاعیه‌ها و ذخیره مطالب.",
    available: true,
  },
  {
    key: PERMISSIONS.SITES_VIEW,
    label: "سایت‌های کاربردی",
    description: "جستجو، مشاهده و ذخیره سامانه‌های پرکاربرد کافی‌نت.",
    available: true,
  },
  {
    key: PERMISSIONS.SITES_MANAGE,
    label: "مدیریت بانک سامانه‌ها",
    description: "ویژه مدیر اصلی کافی‌نت‌یار؛ برای کارمندان قابل واگذاری نیست.",
    available: false,
  },
  {
    key: PERMISSIONS.AGENT_USE,
    label: "استفاده از ایجنت هوشمند",
    description: "گفت‌وگو با دستیار هوش مصنوعی و استفاده از دانش تأییدشده.",
    available: true,
  },
  {
    key: PERMISSIONS.RATES_VIEW,
    label: "مشاهده نرخ‌نامه",
    description: "دیدن نرخ خدمات و استفاده از ماشین‌حساب کافی‌نت.",
    available: true,
  },
  {
    key: PERMISSIONS.RATES_MANAGE,
    label: "مدیریت نرخ اختصاصی",
    description: "تعیین یا تغییر نرخ خدمات برای همین کافی‌نت.",
    available: true,
  },
  {
    key: PERMISSIONS.KNOWLEDGE_MANAGE,
    label: "مدیریت پایگاه دانش",
    description: "ویژه مدیر اصلی کافی‌نت‌یار؛ برای کارمندان قابل واگذاری نیست.",
    available: false,
  },
  {
    key: PERMISSIONS.EMPLOYEES_MANAGE,
    label: "مدیریت کارمندان",
    description: "افزودن، ویرایش و کنترل دسترسی سایر کارمندان.",
    available: true,
  },
];

export const DEFAULT_EMPLOYEE_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ACCOUNTING_VIEW,
  PERMISSIONS.TRANSACTIONS_WRITE,
  PERMISSIONS.NEWS_VIEW,
  PERMISSIONS.SITES_VIEW,
  PERMISSIONS.AGENT_USE,
  PERMISSIONS.RATES_VIEW,
];

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export function permissionLabel(value: string): string {
  return (
    PERMISSION_DEFINITIONS.find((item) => item.key === value)?.label ?? value
  );
}
