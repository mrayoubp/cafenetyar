export const ADMIN_PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  CAFES_VIEW: "cafes.view",
  CAFES_MANAGE: "cafes.manage",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  FINANCE_VIEW: "finance.view",
  FINANCE_MANAGE: "finance.manage",
  CONTENT_VIEW: "content.view",
  CONTENT_MANAGE: "content.manage",
  AI_VIEW: "ai.view",
  AI_MANAGE: "ai.manage",
  RATES_VIEW: "rates.view",
  RATES_MANAGE: "rates.manage",
  SUPPORT_VIEW: "support.view",
  SUPPORT_MANAGE: "support.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view",
  NOTIFICATIONS_MANAGE: "notifications.manage",
} as const;

export type AdminPermission =
  (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

export const ADMIN_PERMISSION_DEFINITIONS: {
  key: AdminPermission;
  label: string;
  description: string;
}[] = [
  {
    key: ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    label: "مشاهده داشبورد",
    description: "آمار کلی پلتفرم و صف‌های عملیاتی",
  },
  {
    key: ADMIN_PERMISSIONS.CAFES_VIEW,
    label: "مشاهده کافی‌نت‌ها",
    description: "فهرست و جزئیات کافی‌نت‌ها برای پشتیبانی",
  },
  {
    key: ADMIN_PERMISSIONS.CAFES_MANAGE,
    label: "مدیریت کافی‌نت‌ها",
    description: "فعال/غیرفعال‌سازی و تغییر اشتراک کافی‌نت",
  },
  {
    key: ADMIN_PERMISSIONS.USERS_VIEW,
    label: "مشاهده کاربران",
    description: "فهرست کاربران، نقش‌ها و وضعیت حساب",
  },
  {
    key: ADMIN_PERMISSIONS.USERS_MANAGE,
    label: "مدیریت کاربران",
    description: "مسدودسازی و تخصیص نقش مدیریتی",
  },
  {
    key: ADMIN_PERMISSIONS.ROLES_MANAGE,
    label: "مدیریت نقش‌ها",
    description: "تعریف نقش و تعیین مجوزهای مدیران",
  },
  {
    key: ADMIN_PERMISSIONS.FINANCE_VIEW,
    label: "مشاهده مالی",
    description: "پلن‌ها، مشترکین، پرداخت‌ها و درآمد",
  },
  {
    key: ADMIN_PERMISSIONS.FINANCE_MANAGE,
    label: "مدیریت مالی",
    description: "قیمت‌گذاری، تخفیف، تمدید و تأیید پرداخت دستی",
  },
  {
    key: ADMIN_PERMISSIONS.CONTENT_VIEW,
    label: "مشاهده محتوا",
    description: "مشاهده اخبار و بانک سامانه‌ها",
  },
  {
    key: ADMIN_PERMISSIONS.CONTENT_MANAGE,
    label: "مدیریت محتوا",
    description: "انتشار اخبار و مدیریت بانک سامانه‌ها",
  },
  {
    key: ADMIN_PERMISSIONS.AI_VIEW,
    label: "مشاهده هوش مصنوعی",
    description: "مصرف، بازخورد و عملکرد ایجنت",
  },
  {
    key: ADMIN_PERMISSIONS.AI_MANAGE,
    label: "مدیریت هوش مصنوعی",
    description: "پایگاه دانش، اسناد و تنظیمات ایجنت",
  },
  {
    key: ADMIN_PERMISSIONS.RATES_VIEW,
    label: "مشاهده نرخ‌نامه",
    description: "نرخ‌های پایه و پیشنهادهای کافی‌نت‌ها",
  },
  {
    key: ADMIN_PERMISSIONS.RATES_MANAGE,
    label: "مدیریت نرخ‌نامه",
    description: "ثبت و تغییر نرخ خدمات و منابع قیمت",
  },
  {
    key: ADMIN_PERMISSIONS.SUPPORT_VIEW,
    label: "مشاهده پشتیبانی",
    description: "مشاهده تیکت‌ها و مکالمه کاربران",
  },
  {
    key: ADMIN_PERMISSIONS.SUPPORT_MANAGE,
    label: "مدیریت پشتیبانی",
    description: "پاسخ، اولویت‌بندی و بستن تیکت‌ها",
  },
  {
    key: ADMIN_PERMISSIONS.AUDIT_VIEW,
    label: "مشاهده گزارش رویداد",
    description: "گزارش تغییرات حساس مدیران",
  },
  {
    key: ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE,
    label: "مدیریت اعلان‌ها",
    description: "ساخت و زمان‌بندی اعلان‌های پلتفرم",
  },
  {
    key: ADMIN_PERMISSIONS.SETTINGS_MANAGE,
    label: "مدیریت تنظیمات",
    description: "تنظیمات عمومی و پیکربندی پلتفرم",
  },
];

export const ALL_ADMIN_PERMISSIONS = ADMIN_PERMISSION_DEFINITIONS.map(
  (permission) => permission.key,
);

export const ADMIN_ROLE_DEFINITIONS = [
  {
    key: "super_admin",
    name: "مدیر اصلی",
    description: "دسترسی کامل به تمام بخش‌های پلتفرم",
    isSystem: true,
    permissions: ALL_ADMIN_PERMISSIONS,
  },
  {
    key: "finance_admin",
    name: "مدیر مالی",
    description: "مدیریت پلن‌ها، پرداخت‌ها و گزارش درآمد",
    isSystem: true,
    permissions: [
      ADMIN_PERMISSIONS.DASHBOARD_VIEW,
      ADMIN_PERMISSIONS.CAFES_VIEW,
      ADMIN_PERMISSIONS.FINANCE_VIEW,
      ADMIN_PERMISSIONS.FINANCE_MANAGE,
      ADMIN_PERMISSIONS.AUDIT_VIEW,
    ],
  },
  {
    key: "content_admin",
    name: "مدیر محتوا",
    description: "مدیریت اخبار، اطلاعیه‌ها و بانک سامانه‌ها",
    isSystem: true,
    permissions: [
      ADMIN_PERMISSIONS.DASHBOARD_VIEW,
      ADMIN_PERMISSIONS.CONTENT_VIEW,
      ADMIN_PERMISSIONS.CONTENT_MANAGE,
      ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE,
      ADMIN_PERMISSIONS.AUDIT_VIEW,
    ],
  },
  {
    key: "support_admin",
    name: "مدیر پشتیبانی",
    description: "پاسخ به تیکت‌ها و مشاهده اطلاعات کافی‌نت‌ها",
    isSystem: true,
    permissions: [
      ADMIN_PERMISSIONS.DASHBOARD_VIEW,
      ADMIN_PERMISSIONS.CAFES_VIEW,
      ADMIN_PERMISSIONS.USERS_VIEW,
      ADMIN_PERMISSIONS.SUPPORT_VIEW,
      ADMIN_PERMISSIONS.SUPPORT_MANAGE,
      ADMIN_PERMISSIONS.AUDIT_VIEW,
    ],
  },
  {
    key: "technical_admin",
    name: "مدیر فنی",
    description: "مدیریت ایجنت، پایگاه دانش و نرخ‌نامه",
    isSystem: true,
    permissions: [
      ADMIN_PERMISSIONS.DASHBOARD_VIEW,
      ADMIN_PERMISSIONS.AI_VIEW,
      ADMIN_PERMISSIONS.AI_MANAGE,
      ADMIN_PERMISSIONS.RATES_VIEW,
      ADMIN_PERMISSIONS.RATES_MANAGE,
      ADMIN_PERMISSIONS.AUDIT_VIEW,
    ],
  },
] as const;

export const SUPER_ADMIN_ROLE_KEY = "super_admin";

export function isAdminPermission(value: string): value is AdminPermission {
  return (ALL_ADMIN_PERMISSIONS as string[]).includes(value);
}
