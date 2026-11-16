import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const SERVICE_CATEGORIES = [
  {
    slug: "exams",
    name: "ثبت‌نام آزمون‌ها",
    description: "آزمون‌های استخدامی، سراسری و مهارتی",
    icon: "clipboard",
    tone: "peach",
  },
  {
    slug: "government",
    name: "خدمات سامانه‌های دولتی",
    description: "خدمات الکترونیکی سازمان‌ها و وزارتخانه‌ها",
    icon: "landmark",
    tone: "navy",
  },
  {
    slug: "banking",
    name: "خدمات بانکی و مالی",
    description: "خدمات بانک‌ها و پرداخت‌های الکترونیکی",
    icon: "banknote",
    tone: "mint",
  },
  {
    slug: "insurance-tax",
    name: "خدمات بیمه و مالیات",
    description: "بیمه، مالیات و امور مرتبط با سازمان‌ها",
    icon: "shield",
    tone: "lilac",
  },
  {
    slug: "judicial",
    name: "خدمات قضایی",
    description: "خدمات الکترونیکی قوه قضاییه و دفاتر مرتبط",
    icon: "scale",
    tone: "navy",
  },
  {
    slug: "typing",
    name: "تایپ و ویرایش",
    description: "تایپ، صفحه‌آرایی و ویرایش متون",
    icon: "type",
    tone: "peach",
  },
  {
    slug: "print-copy",
    name: "پرینت و کپی",
    description: "چاپ، تکثیر و خدمات تصویربرداری",
    icon: "printer",
    tone: "mint",
  },
  {
    slug: "scan-convert",
    name: "اسکن و تبدیل فایل",
    description: "اسکن مدارک و تبدیل فرمت فایل",
    icon: "scan",
    tone: "navy",
  },
  {
    slug: "design",
    name: "طراحی و ویرایش مدارک",
    description: "طراحی فرم، رزومه و ویرایش مدارک",
    icon: "palette",
    tone: "lilac",
  },
  {
    slug: "internet",
    name: "خدمات اینترنتی و سایر خدمات",
    description: "خدمات اینترنتی، جانبی و سفارشی",
    icon: "wifi",
    tone: "navy",
  },
  {
    slug: "other",
    name: "سایر خدمات",
    description: "سایر خدمات قابل ارائه در کافی‌نت",
    icon: "grid",
    tone: "peach",
  },
] as const;

const SERVICES = [
  ["ثبت‌نام آزمون استخدامی", "exams", "ثبت‌نام و تکمیل مراحل آزمون‌های استخدامی", "نفر"],
  ["ثبت‌نام آزمون سراسری", "exams", "خدمات ثبت‌نام و ویرایش اطلاعات آزمون سراسری", "نفر"],
  ["خدمات سامانه‌های دولتی", "government", "کمک به انجام خدمات در سامانه‌های دولتی", "خدمت"],
  ["درخواست در پنجره ملی خدمات", "government", "ثبت و پیگیری درخواست در پنجره ملی خدمات", "درخواست"],
  ["خدمات بانکی و مالی", "banking", "خدمات بانکی، پرداخت و پیگیری تراکنش", "تراکنش"],
  ["خدمات بیمه و مالیات", "insurance-tax", "ثبت درخواست و پیگیری امور بیمه و مالیات", "پرونده"],
  ["خدمات قضایی", "judicial", "ثبت درخواست و پیگیری خدمات الکترونیکی قضایی", "پرونده"],
  ["تایپ و ویرایش", "typing", "تایپ متن، ویرایش و صفحه‌آرایی", "صفحه"],
  ["پرینت و کپی", "print-copy", "چاپ سیاه‌وسفید و تکثیر مدارک", "صفحه"],
  ["پرینت رنگی", "print-copy", "چاپ رنگی مدارک و تصاویر", "صفحه"],
  ["اسکن و تبدیل فایل", "scan-convert", "اسکن مدارک و تبدیل فرمت فایل", "صفحه"],
  ["طراحی و ویرایش مدارک", "design", "طراحی فرم، رزومه و ویرایش فایل", "عدد"],
  ["خدمات اینترنتی", "internet", "خدمات اینترنتی و پشتیبانی حضوری", "ساعت"],
  ["لمینت", "internet", "لمینت کردن مدارک و کارت‌ها", "عدد"],
  ["صحافی", "internet", "صحافی و منگنه‌کردن مدارک", "عدد"],
  ["ارسال پیامک", "internet", "ارسال پیامک اطلاع‌رسانی برای مشتری", "عدد"],
] as const;

const KNOWLEDGE_CATEGORIES = [
  ["آزمون‌ها و آموزش", "exams", "clipboard", "peach"],
  ["خدمات دولتی", "government", "landmark", "navy"],
  ["بانک، بیمه و مالیات", "banking", "banknote", "mint"],
  ["خدمات قضایی", "judicial", "scale", "navy"],
  ["قوانین و رویه کافی‌نت", "rules", "guide", "lilac"],
  ["نرخ‌نامه و هزینه‌ها", "rates", "receipt", "peach"],
] as const;

export async function ensureAgentDefaults(
  ctx: MutationCtx,
  options: { actorId: Id<"users">; onlyIfEmpty?: boolean },
) {
  const probeServices = await ctx.db.query("services").take(1);
  if (options.onlyIfEmpty && probeServices.length > 0) {
    return { categoriesCreated: 0, servicesCreated: 0, knowledgeCategories: 0 };
  }

  const now = Date.now();
  const existingServiceCategories = await ctx.db
    .query("service_categories")
    .withIndex("by_sort_order")
    .collect();
  const existingServiceSlugs = new Set(
    existingServiceCategories.map((item) => item.slug),
  );
  let categoriesCreated = 0;
  for (const [index, category] of SERVICE_CATEGORIES.entries()) {
    if (existingServiceSlugs.has(category.slug)) continue;
    await ctx.db.insert("service_categories", {
      ...category,
      sortOrder: index,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    categoriesCreated += 1;
  }

  const serviceCategories = await ctx.db
    .query("service_categories")
    .withIndex("by_sort_order")
    .collect();
  const serviceCategoryBySlug = new Map(
    serviceCategories.map((item) => [item.slug, item]),
  );
  const existingServices = await ctx.db.query("services").collect();
  const existingNames = new Set(existingServices.map((item) => item.name));
  let servicesCreated = 0;
  for (const [index, [name, categorySlug, description, unit]] of SERVICES.entries()) {
    if (existingNames.has(name)) continue;
    const category = serviceCategoryBySlug.get(categorySlug);
    if (!category) continue;
    await ctx.db.insert("services", {
      name,
      categoryId: category._id,
      description,
      unit,
      priceType: "suggested",
      priceStatus: "needs_review",
      isAddon: index >= 13,
      isActive: true,
      sortOrder: index,
      createdBy: options.actorId,
      updatedBy: options.actorId,
      createdAt: now,
      updatedAt: now,
    });
    servicesCreated += 1;
  }

  const existingKnowledge = await ctx.db
    .query("knowledge_categories")
    .withIndex("by_sort_order")
    .collect();
  const knowledgeSlugs = new Set(existingKnowledge.map((item) => item.slug));
  let knowledgeCategories = 0;
  for (const [index, [name, slug, icon, tone]] of KNOWLEDGE_CATEGORIES.entries()) {
    if (knowledgeSlugs.has(slug)) continue;
    await ctx.db.insert("knowledge_categories", {
      slug,
      name,
      icon,
      tone,
      sortOrder: index,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    knowledgeCategories += 1;
  }

  return { categoriesCreated, servicesCreated, knowledgeCategories };
}
