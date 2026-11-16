import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Stable initial taxonomy; the site admin can rename or hide these later. */
const CATEGORY_SEEDS = [
  {
    slug: "official",
    name: "اطلاعیه‌های رسمی",
    description: "اطلاعیه‌ها و بیانیه‌های رسمی مرتبط با کافی‌نت‌ها.",
    tone: "navy",
  },
  {
    slug: "government",
    name: "تغییرات سامانه‌های دولتی",
    description: "تغییرات، قطعی‌ها و به‌روزرسانی سامانه‌های دولتی.",
    tone: "lilac",
  },
  {
    slug: "exams",
    name: "ثبت‌نام آزمون‌ها",
    description: "زمان‌بندی ثبت‌نام، تمدید مهلت و اعلام نتایج آزمون‌ها.",
    tone: "peach",
  },
  {
    slug: "jobs",
    name: "استخدام و جذب نیرو",
    description: "فرصت‌های استخدامی مرتبط با کافی‌نت‌ها و خدمات دیجیتال.",
    tone: "mint",
  },
  {
    slug: "banking",
    name: "خدمات بانکی و مالی",
    description: "تغییرات خدمات بانکی، پرداخت و امور مالی.",
    tone: "navy",
  },
  {
    slug: "cafe-services",
    name: "خدمات کافی‌نت‌ها",
    description: "نرخ‌نامه، تجهیزات، اینترنت و موضوعات روز کافی‌نت‌داران.",
    tone: "peach",
  },
] as const;

type Tone = (typeof CATEGORY_SEEDS)[number]["tone"];

/**
 * Seeds the global news taxonomy. Demo articles are inserted only when the
 * newsroom has no articles at all, and every one is permanently marked as a
 * sample so it can never be mistaken for a real report.
 */
export async function ensureNewsDefaults(
  ctx: MutationCtx,
  options: { actorId: Id<"users">; seedDemo: boolean },
) {
  const now = Date.now();
  const categoryIds = new Map<string, Id<"news_categories">>();

  for (const [index, seed] of CATEGORY_SEEDS.entries()) {
    const existing = await ctx.db
      .query("news_categories")
      .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
      .first();
    if (existing) {
      categoryIds.set(seed.slug, existing._id);
      continue;
    }
    const id = await ctx.db.insert("news_categories", {
      ...seed,
      sortOrder: index,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    categoryIds.set(seed.slug, id);
  }

  const existingNews = await ctx.db.query("news").first();
  if (!options.seedDemo || existingNews) {
    return {
      categories: categoryIds.size,
      seededDemo: 0,
    };
  }

  // Demo content is created only when an administrator explicitly asks for it
  // or a development deployment enables SEED_DEMO_DATA. Production must never
  // receive sample articles automatically.
  const demoSources = await ctx.db.query("news_sources").collect();
  let demoSource =
    demoSources.find((source) => source.isDemo === true) ?? null;
  if (!demoSource) {
    const sourceId = await ctx.db.insert("news_sources", {
      name: "داده نمونه (Demo)",
      kind: "manual",
      isActive: false,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    });
    demoSource = (await ctx.db.get(sourceId)) ?? null;
  }

  const demo = [
    {
      category: "official",
      title: "خبر نمونه: این مطلب فقط برای نمایش چیدمان است",
      summary:
        "این خبر واقعی نیست و صرفاً برای آزمایش کارت‌های خبری، جستجو و ذخیره‌سازی منتشر شده است.",
      urgent: true,
      pinned: true,
      offset: 1,
    },
    {
      category: "official",
      title: "اطلاعیه نمونه: جای اطلاعیه‌های فوری اینجاست",
      summary:
        "اطلاعیه‌های مهم مثل تمدید مهلت یا قطعی سامانه در این بخش با نشان فوری نمایش داده می‌شوند.",
      urgent: true,
      pinned: false,
      offset: 2,
    },
    {
      category: "government",
      title: "نمونه خبر: تغییرات سامانه‌های دولتی",
      summary:
        "یک نمونه برای نمایش دسته‌بندی تغییرات سامانه‌های دولتی؛ هیچ ادعای واقعی در این متن وجود ندارد.",
      urgent: false,
      pinned: false,
      offset: 5,
    },
    {
      category: "exams",
      title: "نمونه خبر: ثبت‌نام آزمون‌ها",
      summary:
        "این کارت نشان می‌دهد اخبار زمان‌بندی آزمون‌ها چگونه در خوراک خبری دیده می‌شوند.",
      urgent: false,
      pinned: false,
      offset: 9,
    },
    {
      category: "jobs",
      title: "نمونه خبر: استخدام و جذب نیرو",
      summary:
        "نمونه‌ای برای دسته استخدام؛ محتوای این خبر ساختگی نیست، بلکه یک متن نمایشی برچسب‌خورده است.",
      urgent: false,
      pinned: false,
      offset: 14,
    },
    {
      category: "banking",
      title: "نمونه خبر: خدمات بانکی و مالی",
      summary:
        "این مطلب برای بررسی ظاهر دسته خدمات بانکی و مالی در ماژول اخبار استفاده می‌شود.",
      urgent: false,
      pinned: false,
      offset: 20,
    },
    {
      category: "cafe-services",
      title: "نمونه خبر: خدمات کافی‌نت‌ها",
      summary:
        "نمونه نمایشی برای اخبار نرخ‌نامه، اینترنت و تجهیزات کافی‌نت. این خبر واقعی نیست.",
      urgent: false,
      pinned: false,
      offset: 27,
    },
  ] as const;

  for (const item of demo) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) continue;
    const publishedAt = now - item.offset * 60 * 60 * 1000;
    await ctx.db.insert("news", {
      title: item.title,
      summary: item.summary,
      body: [
        item.summary,
        "این رکورد یک داده نمونه (Demo) برای پیش‌نمایش سامانه خبری کافی‌نت‌یار است. برای انتشار خبر واقعی، مدیر اصلی باید از پنل مدیریت اخبار، منبع رسمی و متن خبر را ثبت کند.",
        "داده‌های نمونه را می‌توانید از پنل مدیریت اخبار حذف کنید.",
      ].join("\n\n"),
      categoryId,
      sourceId: demoSource?._id,
      sourceName: "داده نمونه (Demo)",
      publishedAt,
      isUrgent: item.urgent,
      isPinned: item.pinned,
      status: "published",
      isDemo: true,
      createdBy: options.actorId,
      createdAt: publishedAt,
      updatedAt: publishedAt,
      approvedBy: options.actorId,
      approvedAt: publishedAt,
    });
  }

  return { categories: categoryIds.size, seededDemo: demo.length };
}

/** Shared palette so admin-created categories stay visually consistent. */
export const NEWS_TONES: Tone[] = ["navy", "mint", "peach", "lilac"];

export function isNewsTone(value: string): value is Tone {
  return (NEWS_TONES as string[]).includes(value);
}
