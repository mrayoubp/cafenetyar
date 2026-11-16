import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";

export const SITE_SETTINGS_KEY = "default";

export const themeValidator = v.object({
  primaryColor: v.string(),
  secondaryColor: v.string(),
  backgroundColor: v.string(),
  darkBackgroundColor: v.string(),
  buttonColor: v.string(),
  buttonTextColor: v.string(),
  fontFamily: v.union(
    v.literal("vazirmatn"),
    v.literal("tahoma"),
    v.literal("system"),
  ),
  textScale: v.number(),
  cardRadius: v.number(),
  cardStyle: v.union(
    v.literal("clay"),
    v.literal("flat"),
    v.literal("outline"),
  ),
  iconStyle: v.union(
    v.literal("rounded"),
    v.literal("circle"),
    v.literal("square"),
  ),
  backgroundImageUrl: v.union(v.string(), v.null()),
  darkModeEnabled: v.boolean(),
});

export const homeFeatureValidator = v.object({
  title: v.string(),
  description: v.string(),
  icon: v.string(),
  tone: v.string(),
  active: v.boolean(),
});

export const homeValidator = v.object({
  heroEyebrow: v.string(),
  heroTitle: v.string(),
  heroSubtitle: v.string(),
  primaryCtaLabel: v.string(),
  primaryCtaHref: v.string(),
  secondaryCtaLabel: v.string(),
  secondaryCtaHref: v.string(),
  announcementEnabled: v.boolean(),
  announcementText: v.string(),
  features: v.array(homeFeatureValidator),
  sectionOrder: v.array(v.string()),
  hiddenSections: v.array(v.string()),
});

export const siteSettingsValidator = v.object({
  theme: themeValidator,
  home: homeValidator,
});

export type SiteTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  darkBackgroundColor: string;
  buttonColor: string;
  buttonTextColor: string;
  fontFamily: "vazirmatn" | "tahoma" | "system";
  textScale: number;
  cardRadius: number;
  cardStyle: "clay" | "flat" | "outline";
  iconStyle: "rounded" | "circle" | "square";
  backgroundImageUrl: string | null;
  darkModeEnabled: boolean;
};

export type HomeFeatureCard = {
  title: string;
  description: string;
  icon: string;
  tone: string;
  active: boolean;
};

export type HomeContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  announcementEnabled: boolean;
  announcementText: string;
  features: HomeFeatureCard[];
  sectionOrder: string[];
  hiddenSections: string[];
};

export type SiteSettingsSnapshot = {
  theme: SiteTheme;
  home: HomeContent;
};

export const DEFAULT_THEME: SiteTheme = {
  primaryColor: "#087e8b",
  secondaryColor: "#dceef0",
  backgroundColor: "#f2f7f9",
  darkBackgroundColor: "#0b1822",
  buttonColor: "#087e8b",
  buttonTextColor: "#ffffff",
  fontFamily: "vazirmatn",
  textScale: 100,
  cardRadius: 16,
  cardStyle: "clay",
  iconStyle: "rounded",
  backgroundImageUrl: null,
  darkModeEnabled: true,
};

export const HOME_SECTION_KEYS = [
  "features",
  "version",
  "benefits",
  "roadmap",
  "plans",
  "cta",
] as const;

export const DEFAULT_HOME: HomeContent = {
  heroEyebrow: "نسخه ۳٫۱ · دفتر مالی، ایجنت و پشتیبانی",
  heroTitle: "همه ابزارهای کافی‌نت، در یک فضای کاری نرم",
  heroSubtitle:
    "کافی‌نت‌یار فضای کاری فارسی کافی‌نت‌داران است؛ دفتر مالی ماندگار، اخبار روز، دسترسی سریع به سامانه‌ها و دستیار هوشمند. هر کافی‌نت داده و دسترسی مستقل خودش را دارد.",
  primaryCtaLabel: "ساخت حساب کافی‌نت",
  primaryCtaHref: "/auth?mode=signup",
  secondaryCtaLabel: "آشنایی با امکانات",
  secondaryCtaHref: "#features",
  announcementEnabled: false,
  announcementText: "",
  features: [
    {
      title: "حسابداری هوشمند",
      description:
        "دفتر روزانه ماندگار، ثبت دریافت و هزینه، خلاصه روزانه و روند هفتگی؛ مخصوص هر کافی‌نت.",
      icon: "calculator",
      tone: "tile-navy",
      active: true,
    },
    {
      title: "اخبار روز",
      description:
        "اطلاعیه‌ها، نرخ‌نامه‌ها و تغییرات مهم مرتبط با کافی‌نت‌ها در یک خوراک خبری منظم.",
      icon: "newspaper",
      tone: "tile-peach",
      active: true,
    },
    {
      title: "بانک سامانه‌ها",
      description:
        "دسترسی سریع و دسته‌بندی‌شده به سامانه‌های رسمی و سرویس‌های پرکاربرد کافی‌نت‌ها.",
      icon: "globe",
      tone: "tile-mint",
      active: true,
    },
    {
      title: "ایجنت هوشمند",
      description:
        "دستیار فارسی بر پایه دانش تأییدشده؛ پاسخ مرحله‌به‌مرحله همراه با منبع و هشدار اطلاعات ناکافی.",
      icon: "bot",
      tone: "tile-lilac",
      active: true,
    },
    {
      title: "نرخ‌نامه و ماشین‌حساب",
      description:
        "نرخ پایه و اختصاصی هر کافی‌نت، تاریخچه تغییرات و محاسبه شفاف هزینه خدمات.",
      icon: "receipt",
      tone: "tile-peach",
      active: true,
    },
  ],
  sectionOrder: [...HOME_SECTION_KEYS],
  hiddenSections: [],
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsSnapshot = {
  theme: DEFAULT_THEME,
  home: DEFAULT_HOME,
};

type DefaultPage = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  sortOrder: number;
  status: "published" | "hidden";
};

export const DEFAULT_SITE_PAGES: DefaultPage[] = [
  {
    slug: "about",
    title: "درباره کافی‌نت‌یار",
    summary: "چرا کافی‌نت‌یار ساخته شد و برای چه کسانی مناسب است.",
    body:
      "کافی‌نت‌یار یک فضای کاری فارسی برای مدیریت روزمره کافی‌نت است. هدف ما این است که کارهای مالی، اخبار، سامانه‌های کاربردی، نرخ‌نامه و پشتیبانی در یک محیط روشن و قابل اعتماد جمع شوند.\n\nهر کافی‌نت فضای مستقل خودش را دارد و دسترسی کارمندان فقط با مجوزهایی که صاحب مجموعه تعیین می‌کند انجام می‌شود. اطلاعات این صفحه از پنل مدیریت سایت قابل ویرایش است.",
    sortOrder: 10,
    status: "published",
  },
  {
    slug: "guide",
    title: "راهنمای استفاده",
    summary: "از ساخت حساب تا ثبت اولین تراکنش و مدیریت کارمندان.",
    body:
      "برای شروع، با شماره موبایل حساب بسازید و اطلاعات کافی‌نت را وارد کنید. سپس از بخش کارمندان، دسترسی هر همکار را مشخص کنید.\n\nحسابداری، اخبار، بانک سامانه‌ها و نرخ‌نامه از منوی فضای کاری در دسترس هستند. برای گزارش خطا از بخش پشتیبانی تیکت بزنید و اطلاعات حساس مانند رمز یا کد بازیابی را ارسال نکنید.",
    sortOrder: 20,
    status: "published",
  },
  {
    slug: "faq",
    title: "سوالات متداول",
    summary: "پاسخ کوتاه به پرسش‌های رایج درباره حساب، داده و اشتراک.",
    body:
      "آیا داده کافی‌نت من با کافی‌نت دیگر مشترک است؟\nنه. داده‌ها در سمت سرور به کافی‌نت همان حساب محدود می‌شوند.\n\nآیا با رفرش صفحه تراکنش‌ها پاک می‌شوند؟\nنه. تراکنش‌های مالی ماندگار هستند و ابطال آن‌ها سابقه را حذف نمی‌کند.\n\nچطور دسترسی کارمند را محدود کنم؟\nاز بخش کارمندان، مجوزهای هر همکار را تعیین کنید. کنترل نهایی در سرور انجام می‌شود.",
    sortOrder: 30,
    status: "published",
  },
  {
    slug: "plans",
    title: "معرفی اشتراک‌ها",
    summary: "تفاوت پلن‌ها، امکانات و مسیر ارتقا.",
    body:
      "پلن پایه برای شروع، پلن حرفه‌ای برای کافی‌نت‌های فعال و پلن ویژه برای مجموعه‌های بزرگ‌تر طراحی شده است. قیمت جاری و امکانات هر پلن در صفحه اشتراک داخل حساب نمایش داده می‌شود.\n\nتغییر پلن اطلاعات قبلی را حذف نمی‌کند. پرداخت فقط پس از تأیید سمت سرور درگاه معتبر محسوب می‌شود.",
    sortOrder: 40,
    status: "published",
  },
  {
    slug: "support",
    title: "پشتیبانی",
    summary: "مسیرهای ارتباط با تیم کافی‌نت‌یار و نکات امنیتی.",
    body:
      "بهترین مسیر پیگیری، ثبت تیکت داخلی از حساب شماست؛ زیرا وضعیت و پاسخ‌ها در همان حساب ثبت می‌شود. برای پرسش عمومی نیز می‌توانید از صفحه تماس استفاده کنید.\n\nرمز عبور، کد بازیابی، CVV یا شماره کامل کارت را در تیکت و پیام عمومی ارسال نکنید.",
    sortOrder: 50,
    status: "published",
  },
  {
    slug: "terms",
    title: "قوانین و شرایط استفاده",
    summary: "چارچوب استفاده از سامانه و مسئولیت‌های صاحب کافی‌نت.",
    body:
      "با ساخت حساب یا استفاده از کافی‌نت‌یار، شرایط استفاده را می‌پذیرید. اطلاعات حساب و کافی‌نت باید درست و متعلق به شما باشد و مسئولیت فعالیت‌های حساب با صاحب آن است.\n\nاستفاده از سامانه برای فعالیت قانونی مجاز است. این متن پیش‌نویس است و پیش از بهره‌برداری تجاری باید با قوانین محل فعالیت تطبیق داده شود.",
    sortOrder: 60,
    status: "hidden",
  },
  {
    slug: "privacy",
    title: "سیاست حفظ حریم خصوصی",
    summary: "چه اطلاعاتی نگهداری می‌شود و چگونه قابل اصلاح است.",
    body:
      "اطلاعات حساب، کافی‌نت، کارمندان و داده‌های عملیاتی برای ارائه سرویس نگهداری می‌شوند. اطلاعات کارت بانکی کامل در سامانه ذخیره نمی‌شود.\n\nدرخواست اصلاح یا حذف داده از طریق پشتیبانی و پس از بررسی هویت انجام می‌شود. این متن پیش‌نویس است و باید با الزامات قانونی محل فعالیت و محل نگهداری داده بررسی شود.",
    sortOrder: 70,
    status: "hidden",
  },
  {
    slug: "contact",
    title: "تماس با ما",
    summary: "راه‌های ارتباطی و مسیر ثبت درخواست.",
    body:
      "برای مشکلات حساب، پرداخت، داده یا امنیت از تیکت داخلی استفاده کنید. اطلاعات تماس عمومی نیز از همین صفحه در دسترس است.\n\nزمان پاسخ‌گویی به حجم درخواست‌ها و نوع تیکت وابسته است.",
    sortOrder: 80,
    status: "published",
  },
];

type DefaultNav = {
  label: string;
  href: string;
  location: "public" | "dashboard" | "footer";
  sortOrder: number;
  isExternal: boolean;
};

export const DEFAULT_NAVIGATION: DefaultNav[] = [
  { label: "درباره ما", href: "/p/about", location: "public", sortOrder: 10, isExternal: false },
  { label: "راهنما", href: "/help", location: "public", sortOrder: 20, isExternal: false },
  { label: "اشتراک‌ها", href: "/p/plans", location: "public", sortOrder: 30, isExternal: false },
  { label: "تماس", href: "/contact", location: "public", sortOrder: 40, isExternal: false },
  { label: "سوالات متداول", href: "/p/faq", location: "footer", sortOrder: 10, isExternal: false },
  { label: "قوانین", href: "/legal/terms", location: "footer", sortOrder: 20, isExternal: false },
  { label: "حریم خصوصی", href: "/legal/privacy", location: "footer", sortOrder: 30, isExternal: false },
  { label: "راهنمای شروع", href: "/help", location: "footer", sortOrder: 40, isExternal: false },
];

export const DEFAULT_FEATURE_FLAGS = [
  {
    key: "agent",
    label: "ایجنت هوشمند",
    description: "دستیار متصل به دانش تأییدشده و نرخ‌نامه.",
    sortOrder: 10,
    monthlyLimit: 0,
  },
  {
    key: "rates",
    label: "نرخ‌نامه",
    description: "مشاهده نرخ‌ها و ماشین‌حساب خدمات.",
    sortOrder: 20,
    monthlyLimit: 0,
  },
  {
    key: "accounting",
    label: "حسابداری کامل",
    description: "ثبت تراکنش و گزارش‌های مالی.",
    sortOrder: 30,
    monthlyLimit: 0,
  },
  {
    key: "news",
    label: "اخبار و اطلاعیه",
    description: "مشاهده خوراک خبری پلتفرم.",
    sortOrder: 40,
    monthlyLimit: 0,
  },
  {
    key: "sites",
    label: "بانک سامانه‌ها",
    description: "دسترسی به فهرست سامانه‌های کاربردی.",
    sortOrder: 50,
    monthlyLimit: 0,
  },
  {
    key: "support",
    label: "پشتیبانی",
    description: "ثبت تیکت و پیگیری پاسخ‌ها.",
    sortOrder: 60,
    monthlyLimit: 0,
  },
];

export const ALLOWED_PLAN_CODES = ["basic", "pro", "premium", "trial"] as const;
export const ALLOWED_FEATURE_ROLES = ["owner", "employee", "site_admin"] as const;

function parsedObject(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function safeString(value: unknown, fallback: string, maxLength = 500) {
  return typeof value === "string" && value.trim()
    ? value.slice(0, maxLength)
    : fallback;
}

function safeInternalHref(value: unknown, fallback: string) {
  const hasControlCharacters =
    typeof value === "string" &&
    Array.from(value).some((character) => character.charCodeAt(0) < 32);
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !hasControlCharacters
    ? value.slice(0, 300)
    : fallback;
}

function safeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toLowerCase()
    : fallback;
}

function safeImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function normalizeTheme(value: unknown): SiteTheme {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const font = row.fontFamily;
  const cardStyle = row.cardStyle;
  const iconStyle = row.iconStyle;
  return {
    primaryColor: safeColor(row.primaryColor, DEFAULT_THEME.primaryColor),
    secondaryColor: safeColor(row.secondaryColor, DEFAULT_THEME.secondaryColor),
    backgroundColor: safeColor(row.backgroundColor, DEFAULT_THEME.backgroundColor),
    darkBackgroundColor: safeColor(
      row.darkBackgroundColor,
      DEFAULT_THEME.darkBackgroundColor,
    ),
    buttonColor: safeColor(row.buttonColor, DEFAULT_THEME.buttonColor),
    buttonTextColor: safeColor(row.buttonTextColor, DEFAULT_THEME.buttonTextColor),
    fontFamily:
      font === "tahoma" || font === "system" || font === "vazirmatn"
        ? font
        : DEFAULT_THEME.fontFamily,
    textScale: safeNumber(row.textScale, DEFAULT_THEME.textScale, 85, 125),
    cardRadius: safeNumber(row.cardRadius, DEFAULT_THEME.cardRadius, 6, 36),
    cardStyle:
      cardStyle === "flat" || cardStyle === "outline" || cardStyle === "clay"
        ? cardStyle
        : DEFAULT_THEME.cardStyle,
    iconStyle:
      iconStyle === "circle" || iconStyle === "square" || iconStyle === "rounded"
        ? iconStyle
        : DEFAULT_THEME.iconStyle,
    backgroundImageUrl: safeImageUrl(row.backgroundImageUrl),
    darkModeEnabled: safeBoolean(row.darkModeEnabled, DEFAULT_THEME.darkModeEnabled),
  };
}

export function normalizeHome(value: unknown): HomeContent {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawFeatures = Array.isArray(row.features) ? row.features : DEFAULT_HOME.features;
  const features = rawFeatures
    .slice(0, 12)
    .map((item) => {
      const feature =
        item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        title: safeString(feature.title, "قابلیت جدید", 80),
        description: safeString(feature.description, "", 500),
        icon: safeString(feature.icon, "sparkles", 40),
        tone: safeString(feature.tone, "tile-navy", 40),
        active: safeBoolean(feature.active, true),
      };
    })
    .filter((feature) => feature.title.trim().length > 0);
  const rawOrder = Array.isArray(row.sectionOrder) ? row.sectionOrder : [];
  const sectionOrder = HOME_SECTION_KEYS.filter((key) => rawOrder.includes(key));
  for (const key of HOME_SECTION_KEYS) {
    if (!sectionOrder.includes(key)) sectionOrder.push(key);
  }
  return {
    heroEyebrow: safeString(row.heroEyebrow, DEFAULT_HOME.heroEyebrow, 80),
    heroTitle: safeString(row.heroTitle, DEFAULT_HOME.heroTitle, 120),
    heroSubtitle: safeString(row.heroSubtitle, DEFAULT_HOME.heroSubtitle, 1000),
    primaryCtaLabel: safeString(row.primaryCtaLabel, DEFAULT_HOME.primaryCtaLabel, 40),
    primaryCtaHref: safeInternalHref(
      row.primaryCtaHref,
      DEFAULT_HOME.primaryCtaHref,
    ),
    secondaryCtaLabel: safeString(row.secondaryCtaLabel, DEFAULT_HOME.secondaryCtaLabel, 40),
    secondaryCtaHref: safeInternalHref(
      row.secondaryCtaHref,
      DEFAULT_HOME.secondaryCtaHref,
    ),
    announcementEnabled: safeBoolean(
      row.announcementEnabled,
      DEFAULT_HOME.announcementEnabled,
    ),
    announcementText:
      typeof row.announcementText === "string"
        ? row.announcementText.slice(0, 500)
        : "",
    features: features.length > 0 ? features : DEFAULT_HOME.features,
    sectionOrder: sectionOrder.length > 0 ? sectionOrder : [...HOME_SECTION_KEYS],
    hiddenSections: Array.isArray(row.hiddenSections)
      ? row.hiddenSections.filter((key): key is string =>
          typeof key === "string" && (HOME_SECTION_KEYS as readonly string[]).includes(key),
        )
      : [],
  };
}

export function normalizeSiteSettings(value: unknown): SiteSettingsSnapshot {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    theme: normalizeTheme(row.theme),
    home: normalizeHome(row.home),
  };
}

export function parseSiteSettings(raw: string | undefined): SiteSettingsSnapshot {
  return normalizeSiteSettings(parsedObject(raw));
}

/** Idempotently fills CMS-only tables without touching existing content. */
export async function ensureSiteDefaults(
  ctx: MutationCtx,
  actorId?: import("../_generated/dataModel").Id<"users">,
) {
  const now = Date.now();
  const actor = actorId ?? (await ctx.db.query("users").first())?._id;
  if (!actor) return null;
  let settings = await ctx.db
    .query("site_settings")
    .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
    .first();
  if (!settings) {
    const snapshot = JSON.stringify(DEFAULT_SITE_SETTINGS);
    const settingsId = await ctx.db.insert("site_settings", {
      key: SITE_SETTINGS_KEY,
      draft: snapshot,
      published: snapshot,
      updatedAt: now,
      updatedBy: actor,
      publishedAt: now,
    });
    settings = await ctx.db.get(settingsId);
  }

  for (const page of DEFAULT_SITE_PAGES) {
    const existing = await ctx.db
      .query("site_pages")
      .withIndex("by_slug", (q) => q.eq("slug", page.slug))
      .first();
    if (!existing) {
      await ctx.db.insert("site_pages", {
        slug: page.slug,
        title: page.title,
        summary: page.summary,
        body: page.body,
        imageUrls: [],
        sortOrder: page.sortOrder,
        status: page.status,
        draftTitle: page.title,
        draftSummary: page.summary,
        draftBody: page.body,
        draftImageUrls: [],
        draftSortOrder: page.sortOrder,
        draftStatus: page.status,
        updatedAt: now,
        updatedBy: actor,
      });
    }
  }

  const navCount = await ctx.db.query("navigation_items").take(1);
  if (navCount.length === 0) {
    for (const item of DEFAULT_NAVIGATION) {
      await ctx.db.insert("navigation_items", {
        ...item,
        isActive: true,
        updatedAt: now,
        updatedBy: actor,
      });
    }
  }

  for (const flag of DEFAULT_FEATURE_FLAGS) {
    const existing = await ctx.db
      .query("feature_flags")
      .withIndex("by_key", (q) => q.eq("key", flag.key))
      .first();
    if (!existing) {
      await ctx.db.insert("feature_flags", {
        key: flag.key,
        label: flag.label,
        description: flag.description,
        isEnabled: true,
        allowedPlans: [...ALLOWED_PLAN_CODES],
        allowedRoles: [...ALLOWED_FEATURE_ROLES],
        dailyLimit: 0,
        monthlyLimit: flag.monthlyLimit,
        sortOrder: flag.sortOrder,
        updatedAt: now,
        updatedBy: actor,
      });
    }
  }

  return settings ?? null;
}

export async function recordContentVersion(
  ctx: MutationCtx,
  args: {
    entityType: "site_settings" | "site_page" | "navigation" | "feature";
    entityKey: string;
    label: string;
    snapshot: string;
    actorId: import("../_generated/dataModel").Id<"users">;
  },
) {
  await ctx.db.insert("content_versions", {
    ...args,
    createdAt: Date.now(),
  });
}
